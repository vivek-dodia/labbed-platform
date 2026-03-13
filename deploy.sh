#!/bin/bash
# Deploy to DO droplet by pulling pre-built images from GHCR
# Usage: ./deploy.sh [platform|worker|frontend|nginx|all]
#
# Pipeline: push to main → GH Actions builds images → this script pulls & restarts

set -e

SERVER="134.122.115.238"
SSH_KEY="/root/.ssh/labbed_do"
SSH="ssh -i $SSH_KEY root@$SERVER"
COMPOSE="docker compose -f /opt/labbed/docker-compose.prod.yaml"

COMPONENT=${1:-all}

# Sync compose + nginx config to server
echo "Syncing config files..."
scp -i $SSH_KEY docker-compose.prod.yaml root@$SERVER:/opt/labbed/
scp -i $SSH_KEY nginx/default.conf root@$SERVER:/opt/labbed/nginx/

pull_and_restart() {
    local service=$1
    local image=$2
    echo "Pulling $service..."
    $SSH "docker pull $image"
    echo "Restarting $service..."
    $SSH "$COMPOSE up -d --no-deps $service"
}

case $COMPONENT in
    platform)
        pull_and_restart platform ghcr.io/vivek-dodia/labbed-platform:latest
        ;;
    worker)
        pull_and_restart worker ghcr.io/vivek-dodia/labbed-worker:latest
        ;;
    frontend)
        pull_and_restart frontend ghcr.io/vivek-dodia/labbed-frontend:latest
        ;;
    nginx)
        $SSH "$COMPOSE up -d --no-deps nginx"
        ;;
    all)
        echo "Pulling all images..."
        $SSH "docker pull ghcr.io/vivek-dodia/labbed-platform:latest && \
              docker pull ghcr.io/vivek-dodia/labbed-worker:latest && \
              docker pull ghcr.io/vivek-dodia/labbed-frontend:latest"
        echo "Starting all services..."
        $SSH "$COMPOSE up -d"
        ;;
    down)
        $SSH "$COMPOSE down"
        ;;
    logs)
        $SSH "$COMPOSE logs -f --tail=50"
        ;;
    status)
        $SSH "$COMPOSE ps"
        ;;
    *)
        echo "Usage: ./deploy.sh [platform|worker|frontend|nginx|all|down|logs|status]"
        exit 1
        ;;
esac

echo "Done! http://$SERVER"
