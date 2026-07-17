"""
AgriNexus AI — Model Hot-Reload Watcher
Monitors leaf_disease_efficientnet.pth for changes.
When training saves new weights, auto-restarts the Docker backend
so the live app picks them up immediately — zero manual steps needed.
"""
import os
import sys
import time
import subprocess

WEIGHTS_PATH = os.path.join(
    os.path.dirname(__file__),
    "app", "services", "leaf_disease_efficientnet.pth"
)
CONTAINER_NAME = "agrinexus-backend-1"
POLL_INTERVAL = 5  # seconds between checks

def get_mtime():
    try:
        return os.path.getmtime(WEIGHTS_PATH)
    except FileNotFoundError:
        return None

def restart_container():
    print(f"\n🔄  New weights detected — restarting {CONTAINER_NAME}...", flush=True)
    result = subprocess.run(
        ["docker", "restart", CONTAINER_NAME],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"✅  {CONTAINER_NAME} restarted successfully. App is live with new model.", flush=True)
    else:
        print(f"❌  Docker restart failed: {result.stderr}", flush=True)

def main():
    print("=" * 55, flush=True)
    print("  AgriNexus Model Hot-Reload Watcher", flush=True)
    print(f"  Watching: {WEIGHTS_PATH}", flush=True)
    print(f"  Poll interval: {POLL_INTERVAL}s", flush=True)
    print("=" * 55, flush=True)

    last_mtime = get_mtime()
    if last_mtime:
        print(f"📦  Current weights mtime: {time.ctime(last_mtime)}", flush=True)
    else:
        print("⚠️   Weights file not found yet — will restart when it appears.", flush=True)

    print("\n👀  Watching for changes... (Ctrl+C to stop)\n", flush=True)

    while True:
        time.sleep(POLL_INTERVAL)
        current_mtime = get_mtime()

        if current_mtime is None:
            continue  # file not yet created, keep waiting

        if last_mtime is None or current_mtime > last_mtime:
            # File appeared or was updated
            restart_container()
            last_mtime = current_mtime
            print(f"\n👀  Watching for further changes...\n", flush=True)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nWatcher stopped.", flush=True)
        sys.exit(0)
