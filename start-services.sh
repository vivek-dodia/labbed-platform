#!/bin/bash
# Start all labbed services in tmux sessions
# Usage: ./start-services.sh [platform|worker|frontend|all]

TARGET="${1:-all}"

start_platform() {
  if tmux has-session -t platform 2>/dev/null; then
    echo "platform already running (tmux session exists)"
  else
    tmux new-session -d -s platform -c /opt/labbed/platform "./labbed-platform"
    echo "platform started in tmux session 'platform'"
  fi
}

start_worker() {
  if tmux has-session -t worker 2>/dev/null; then
    echo "worker already running (tmux session exists)"
  else
    tmux new-session -d -s worker -c /opt/labbed/worker "./labbed-worker"
    echo "worker started in tmux session 'worker'"
  fi
}

start_frontend() {
  if tmux has-session -t frontend 2>/dev/null; then
    echo "frontend already running (tmux session exists)"
  else
    tmux new-session -d -s frontend -c /opt/labbed/frontend/app "npx next dev -p 3000"
    echo "frontend started in tmux session 'frontend'"
  fi
}

case "$TARGET" in
  platform) start_platform ;;
  worker)   start_worker ;;
  frontend) start_frontend ;;
  all)
    start_platform
    start_worker
    start_frontend
    ;;
  status)
    echo "=== Service Status ==="
    for svc in platform worker frontend; do
      if tmux has-session -t $svc 2>/dev/null; then
        echo "  $svc: RUNNING"
      else
        echo "  $svc: STOPPED"
      fi
    done
    ;;
  stop)
    for svc in platform worker frontend; do
      tmux kill-session -t $svc 2>/dev/null && echo "$svc stopped" || echo "$svc not running"
    done
    ;;
  *)
    echo "Usage: $0 [platform|worker|frontend|all|status|stop]"
    ;;
esac
