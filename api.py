import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import UploadFile, File
from redis import Redis
from rq import Queue
from rq.job import Job
from pydantic import BaseModel
import shutil
import datetime
import zipfile
import subprocess
import re
import json
import uuid

from worker import execute_render

app = FastAPI(title="Render Farm API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ensure the folder exists so FastAPI doesnt crash
os.makedirs("/render_data/output", mode=0x777, exist_ok=True) 
app.mount("/outputs", StaticFiles(directory="/render_data/output"), name="outputs")

# connect to Redis Container (docker auto routes hostname "redis" to the correct container)
redis_conn = Redis(host="redis", port=6379)
tasks_queue = Queue("render_queue", connection=redis_conn)

CHUNK_SIZE = 5

# define what a render job looks like
class RenderJob(BaseModel):
    project: str
    scene_file: str
    start_frame: int
    end_frame: int


@app.delete("/projects/{project_name}")
async def delete_project(project_name: str) -> dict:
    project_path = Path("/render_data") / f"{project_name}.zip"
    if not project_path.exists():
        return {"error": f"Project {project_name} not found!"}

    project_path.unlink()

    project_dir_path = Path("/render_data") / f"{project_name}"
    if project_dir_path.exists():
        shutil.rmtree(project_dir_path)

    return {"message": f"Project {project_name} deleted"}

@app.get("/projects")
async def list_projects():
    storage_path = Path("/render_data")
    if not storage_path.exists():
        return {"assets": []}

    files = [f for f in storage_path.glob("*.zip")]
    names = [f.name for f in files]
    mods = [datetime.datetime.fromtimestamp(f.stat().st_mtime).astimezone() for f in files]

    return {"projects": zip(names, mods)}

@app.get("/projects/{project_name}/shots")
async def list_project_shots(project_name: str) -> list:
    storage_path = Path("/render_data")
    project_path = storage_path / project_name
    if not project_path.exists():
        return [] 
    
    scenes_path = project_path / "scenes"
    if not scenes_path.exists():
        return [] 

    blend_files = [f.name for f in scenes_path.glob('*.blend')]
    mods = [datetime.datetime.fromtimestamp(f.stat().st_mtime).astimezone() for f in scenes_path.glob('*.blend')]

    project_output_path = storage_path / "output" / project_name
    num_renders = {}
    if project_output_path.exists():
        for b in blend_files:
            name = b.replace('.blend', '')
            name_path = project_output_path / name
            if not name_path.exists(): continue
            
            count = len([x for x in name_path.iterdir() if x.is_dir()])
            num_renders[b] = count

    render_counts = [num_renders.get(b, 0) for b in blend_files]

    # read in the metadata which has the start and end frames
    metadata_path = project_path / "scenes_metadata.json"
    frame_data = []
    if metadata_path.exists():
        with open(metadata_path, "r") as f:
            meta_data = json.load(f)

        frame_data = []
        for b in blend_files:
            print(f"{b=}")
            blend_frame_data = meta_data.get(b.replace('.blend', ''), {'start':0, 'end':0})
            print(f"{blend_frame_data=}")
            frame_data.append(blend_frame_data)


    return list(zip(blend_files, mods, render_counts, frame_data))

def _create_metadata(dst_path: Path) -> None:
    scenes_path = dst_path / "scenes"
    if not scenes_path.exists(): return

    py_cmd = "import bpy; s=bpy.context.scene; print(f'FRAMES:{s.frame_start}-{s.frame_end}')"

    blend_data = {}
    blends = [f for f in scenes_path.glob('*.blend')]
    for blend_path in blends:
        result = subprocess.run(
            ["blender", "-b", str(blend_path), "--python-expr", py_cmd],
            capture_output=True, text=True, timeout=30
        )
        
        # Parse the output (e.g., "FRAMES:1-250")
        match = re.search(r"FRAMES:(\d+-\d+)", result.stdout)
        if match:
            actual_frames = match.group(1)
            start, end = actual_frames.split('-')
            blend_data[blend_path.stem] = {"start": int(start), "end": int(end)}
            
    data_json_path = dst_path / "scenes_metadata.json"
    with open(data_json_path, "w") as f:
        json.dump(blend_data, f, indent=4)


@app.post("/upload")
async def upload_project(file: UploadFile = File(...)):
    if not file or not file.filename or not file.filename.endswith('.zip'):
        return {"status": "error", "filename": ""}

    dest_path = Path("/render_data") / file.filename

    with dest_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if dest_path.exists():
        dest_dir_path = Path("/render_data") / file.filename.replace('.zip', '')
        if dest_dir_path.exists():
            shutil.rmtree(dest_dir_path)
        dest_dir_path.mkdir()

        with zipfile.ZipFile(dest_path, 'r') as zip_ref:
            zip_ref.extractall(dest_dir_path)

        _create_metadata(dest_dir_path)

    return {"status": "success", "filename": file.filename}

@app.get("/renders/{project}/{scene_name}/{job_id}/log")
async def get_render_log(project: str, scene_name: str, job_id: str) -> dict:
    clean_name = scene_name.replace('.blend', '')
    scene_dir = Path(f"/render_data/output/{project}/{clean_name}")

    if not scene_dir.exists():
        return {"log": f"Scene dir does not exist: {scene_dir}", "status": "pending"}

    job_dirs = [d for d in scene_dir.glob(f"{job_id}__*") if d.is_dir()]
    if not job_dirs:
        return {"log": "2: Waiting for render to start...", "status": "pending"}

    target_dir = job_dirs[0]
    log_file_path = target_dir / "render.log"

    if not log_file_path.exists():
        return {"log": "Log file initializing...", "status": "pending"}

    try:
        with open(log_file_path, "r") as f:
            content = f.read()
        return {"log": content, "status": "success"}
    except Exception as e:
        return {"log": f"Error reading log: {str(e)}", "status":"error"}


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    child_ids = redis_conn.smembers(f"members:{job_id}")
    for c_id in child_ids:
        child_job = tasks_queue.fetch_job(c_id.decode())
        if child_job:
            child_job.delete()
    
    redis_conn.delete(f"members:{job_id}")
    redis_conn.delete(f"metadata:{job_id}")

    return {"status": "success", "message": f"Deleted job {job_id} and its children"}

# new endpoint to get rendered frames for the scene
@app.get("/renders/{project}/{scene_name}/{job_id}")
async def get_rendered_frames(project: str, scene_name: str, job_id: str) -> dict:
    clean_name = scene_name.replace(".blend", "")
    scene_dir = Path(f"/render_data/output/{project}/{clean_name}")

    if not scene_dir.exists():
        return {"frames": [], "message": f"Scene Dir not found: {scene_dir}"}

    all_job_id_matching_dirs = [d for d in scene_dir.iterdir() if d.is_dir() and d.name.startswith(job_id)]
    if not all_job_id_matching_dirs:
        return {"frames": [], "message": f"Job ID Dir not found: {job_id}"}

    job_id_dir: Path = all_job_id_matching_dirs[0]
    if not job_id_dir.exists():
        return {"frames": [], "message": f"Job ID Dir not found: {job_id_dir}"}

    # grab all png files and sort them
    frames = [f.name for f in job_id_dir.glob("*.png")]
    frames.sort()

    # construct the full public urls so react can display them
    frame_urls = [f"http://localhost:8000/outputs/{project}/{clean_name}/{job_id_dir.name}/{f}" for f in frames]

    return {
        "project": project,
        "scene": clean_name,
        "folder": job_id_dir.name,
        "frames": frame_urls,
        "total": len(frame_urls)
    }

def _chunk_range(start: int, end: int) -> list:
    start = int(start)
    end = int(end)

    output = []
    current = start
    while current < end:
        c_start = current
        c_end = c_start + CHUNK_SIZE
        if c_end>=end: c_end = end

        output.append([c_start, c_end])
        current = c_end + 1

    return output


@app.post("/jobs/submit")
async def submit_job(job: RenderJob) -> dict:
    parent_id = f"parent-{uuid.uuid4()}"
    # Define the timestamped folder name ONCE here
    timestamp = datetime.datetime.now().strftime("%Y_%m_%d__%H_%M_%S")
    folder_name = f"{parent_id}__{timestamp}"
    
    frame_chunks = _chunk_range(job.start_frame, job.end_frame)
    child_job_ids = []
    
    for start, end in frame_chunks:
        frames = f"{start}:{end}"
        job_instance = tasks_queue.enqueue(
            execute_render, 
            job.project, 
            job.scene_file, 
            frames, 
            folder_name, # Pass the shared timestamped folder name to the worker
            job_id=f"child-{uuid.uuid4()}",
            meta={'parent_id': parent_id},
            result_ttl=-1
        )
        child_job_ids.append(job_instance.id)

    redis_conn.sadd(f"members:{parent_id}", *child_job_ids)
    
    # Store the folder_name in metadata so the counter can find it later
    redis_conn.hset(f"metadata:{parent_id}", mapping={
            "project": job.project,
            "scene": job.scene_file,
            "total_frames": (job.end_frame-job.start_frame) + 1,
            "status": "STARTED",
            "folder_name": folder_name,
            "started_at": datetime.datetime.utcnow().isoformat()
    })

    return {"parent_id": parent_id, "folder": folder_name}

@app.get("/jobs/job/{job_id}")
async def get_job_status(job_id: str) -> dict:
    # ask rq for the status of a specific job
    job_instance = tasks_queue.fetch_job(job_id)
    if not job_instance:
        return {"error": "Job not found"}
    
    return {
        "job_id": job_instance.id,
        "status": job_instance.get_status(), # "QUEUED", "STARTED", "FINISHED", "FAILED"
        "result": job_instance.result,
        "started_at": job_instance.started_at.isoformat() if job_instance.started_at else None,
        "ended_at": job_instance.ended_at.isoformat() if job_instance.ended_at else None,
    }

def count_rendered_frames(project: str, scene: str, meta: dict) -> int:
    project = project.replace('.zip', '')
    scene = scene.replace('.blend', '')
    
    # Get the shared folder name we saved in metadata
    folder_name = meta.get('folder_name')
    if not folder_name: 
        return 0

    job_dir = Path(f"/render_data/output/{project}/{scene}/{folder_name}")
    if not job_dir.exists(): 
        return 0
    
    # Counts all frames from all workers contributing to this parent
    return len(list(job_dir.glob('*.png')))

@app.get("/jobs/")
async def list_all_jobs() -> dict:
    parent_keys = redis_conn.keys("metadata:parent-*")
    jobs_data = []

    for key in parent_keys:
        p_id = key.decode().replace("metadata:", "")
        meta_bytes = redis_conn.hgetall(key)
        meta_decoded = {k.decode(): v.decode() for k, v in meta_bytes.items()}

        # 1. ADD THIS LOGIC: Check all child tasks for this parent
        child_ids = redis_conn.smembers(f"members:{p_id}")
        all_done = True
        for c_id in child_ids:
            t = tasks_queue.fetch_job(c_id.decode())
            # If any child is missing or not finished, the parent is still "STARTED"
            if not t or t.get_status() != 'finished':
                all_done = False
                break

        # 2. SATISFY THE MOCK: Use the parent ID for the folder lookup
        class MockJob:
            def __init__(self, id_str):
                self.id = id_str
        mock_job = MockJob(p_id) 

        # 3. NOW all_done is defined and safe to use
        jobs_data.append({
            "job_id": p_id,
            "project": meta_decoded.get('project'),
            "scene": meta_decoded.get('scene'),
            "status": "FINISHED" if all_done else "STARTED",
            "rendered_frames": count_rendered_frames(
                meta_decoded.get('project'), 
                meta_decoded.get('scene'), 
                meta_decoded # Pass the whole dict
            ),
            "frames": f"1-{meta_decoded.get('total_frames')}"
        })
    
    return {'jobs': jobs_data}
