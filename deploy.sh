#!/bin/bash
# Deploy local changes to DO droplet
# Usage: ./deploy.sh [platform|worker|frontend|all]

set -e

SERVER="134.122.115.238"
SSH_KEY="/root/.ssh/labbed_do"
SSH="ssh -i $SSH_KEY root@$SERVER"

COMPONENT=${1:-all}

echo "Pushing to git..."
git push origin main 2>/dev/null

echo "Pulling on server..."
$SSH "cd /opt/labbed && git pull"

rebuild_platform() {
    echo "Building platform..."
    $SSH "cd /opt/labbed/platform && /usr/local/go/bin/go build -o labbed-platform . && pkill -f labbed-platform; sleep 1; cd /opt/labbed/platform && LABBED_SERVER_PLATFORM_URL=http://$SERVER:8080 nohup ./labbed-platform > /tmp/platform.log 2>&1 &"
    sleep 2
    echo "Platform restarted"
}

rebuild_worker() {
    echo "Building worker..."
    $SSH "cd /opt/labbed/worker && /usr/local/go/bin/go build -o labbed-worker . && pkill -f labbed-worker; sleep 1; cd /opt/labbed/worker && LABBED_WORKER_PLATFORM_URL=http://$SERVER:8080 LABBED_WORKER_PLATFORM_SECRET=change-me-in-production nohup ./labbed-worker > /tmp/worker.log 2>&1 &"
    sleep 2
    echo "Worker restarted"
}

rebuild_frontend() {
    echo "Restarting frontend..."
    $SSH "cd /opt/labbed/frontend/app && export PATH=/root/.bun/bin:\$PATH && pkill -f 'next dev'; sleep 1; rm -rf .next && nohup bun run dev --hostname 0.0.0.0 > /tmp/frontend.log 2>&1 &"
    sleep 4
    echo "Frontend restarted"
}

case $COMPONENT in
    platform)  rebuild_platform ;;
    worker)    rebuild_worker ;;
    frontend)  rebuild_frontend ;;
    all)
        rebuild_platform
        rebuild_worker
        rebuild_frontend
        ;;
    *)
        echo "Usage: ./deploy.sh [platform|worker|frontend|all]"
        exit 1
        ;;
esac

echo "Done! http://$SERVER"
