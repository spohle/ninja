import sys
from worker import execute_render

if __name__ == "__main__":
    project, scene, frames, shared_folder = sys.argv[1:5]
    execute_render(project, scene, frames, shared_folder)
    sys.exit(0)