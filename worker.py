import subprocess
import os
from pathlib import Path
from datetime import datetime
from rq import get_current_job
from rq.job import Job
import zipfile
import tempfile

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

def execute_render(project: str, scene_file: str, frames: list):
    print(f"starting render for {project}|{scene_file} (Frames: {frames}...")

    start_frame, end_frame = frames.split("-")

    full_scene_path = Path("/render_data") / project / "scenes" / f"{scene_file}.blend"
    if not full_scene_path.exists():
        print(f"Could not find scene file: {full_scene_path}")
        return(f"Could not find scene file: {full_scene_path}")

    output_dir = Path(f"/render_data/output/{project}{scene_file}")
    output_dir.mkdir(exist_ok=True)

    output_dir_path = create_named_output_dir(str(output_dir))
    output_path = f"{output_dir_path}/frame.####"

    os.makedirs(output_dir, exist_ok=True)
    
    blend_path = full_scene_path

    command = [
        "blender",
        "-b", blend_path,
        "-o", output_path,
        "-s", start_frame,
        "-e", end_frame,
        "-a", # render animation
        "--log", "*"
    ]

    log_file_path = output_dir_path / "render.log"

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

