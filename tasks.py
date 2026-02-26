import subprocess
import os
from pathlib import Path
from datetime import datetime
from rq import get_current_job
from rq.job import Job

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

def execute_render(scene_file: str, frames: str):
    print(f"starting render for {scene_file} (Frames: {frames}...")

    start_frame, end_frame = frames.split("-")

    # docker-compose mounts the shared folder to /render_data
    blend_path = f"/render_data/{scene_file}"

    if not os.path.exists(blend_path):
        error_msg = f"ERROR: {blend_path} not found"
        print(error_msg)
        return error_msg

    blend_name = Path(blend_path).stem
    output_dir = f"/render_data/output/{blend_name}"
    
    output_dir_path = create_named_output_dir(output_dir)
    output_path = f"{output_dir_path}/frame.####"

    os.makedirs(output_dir, exist_ok=True)

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

