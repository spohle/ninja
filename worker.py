import subprocess
import os
from pathlib import Path
from datetime import datetime
from rq import get_current_job
from rq.job import Job
import zipfile
import tempfile
import re

def create_named_output_dir(output_dir: str) -> Path | None:
    output_dir_path = Path(output_dir)
    output_dir_path.mkdir(parents=True, exist_ok=True)

    job = get_current_job()
    if job is None: 
        return None

    now = datetime.now()
    # we are prefixing the subdir with the job id
    final_path = output_dir_path / f'{job.id}__{now.strftime("%Y_%m_%d__%H_%M_%S")}'
    final_path.mkdir(parents=True, exist_ok=True)

    return final_path

def get_frame_range(scene_path: Path) -> list:
    py_cmd = "import bpy; s=bpy.context.scene; print(f'FRAMES:{s.frame_start}-{s.frame_end}')"
    result = subprocess.run(
        ["blender", "-b", str(scene_path), "--python-expr", py_cmd],
        capture_output=True, text=True
    )

    match = re.search(r"FRAMES:(\d+-\d+)", result.stdout)
    if match:
        actual_frames = match.group(1)
        return actual_frames.split('-')
    else:
        return [None, None]

def execute_render(project: str, scene_file: str, frames: str, shared_folder: str) -> str:    
    project = project.replace('.zip', '')
    start_frame, end_frame = frames.split(":")
    clean_scene_name = scene_file.replace('.blend', '')

    # All workers drop frames into this one shared timestamped folder
    output_dir = Path(f"/render_data/output/{project}/{clean_scene_name}/{shared_folder}")
    output_dir.mkdir(exist_ok=True, parents=True)

    output_path = f"{output_dir}/frame.####"

    command = [
        "blender", "-b", str(Path("/render_data") / project / "scenes" / scene_file),
        "-o", output_path,
        "-s", start_frame, "-e", end_frame, "-a"
    ]

    log_file_path = output_dir / "render.log"

    try:
        with open(log_file_path, "w") as log_file:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            if process.stdout:
                for line in process.stdout:
                    print(line, end="")
                    log_file.write(line)
                    log_file.flush()
            process.wait()

        if process.returncode == 0:
            print("Render completed successfully")
            return f"RENDER_SUCCESS"
        else:
            print(f"Render failed with return code {process.returncode}")
            return f"RENDER_FAILED: Return code: {process.returncode}"

    except subprocess.CalledProcessError as e:
        print(f"Render failed! Error: {e}")
        return f"RENDER_FAILED: {e.stderr}"

