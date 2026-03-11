# Labbed

Cloud-native platform for deploying and managing containerlab network labs.

## Architecture

Labbed has three components:

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Frontend   │──────>│   Platform   │──────>│    Worker     │
│  (Next.js)   │  HTTP │  (Go / Gin)  │  HTTP │  (Go / clab) │
│  port 3000   │       │  port 8080   │       │  port 8081   │
└──────────────┘       └──────┬───────┘       └──────┬───────┘
                              │                      │
                         PostgreSQL            Docker / containerlab
```

**Platform** — Central API server. Handles authentication, users, collections, topologies, labs, and worker management. Stores state in PostgreSQL. Exposes a WebSocket endpoint for real-time updates.

**Worker** — Agent that runs on Docker hosts. Registers with the platform on startup, sends periodic heartbeats, and executes containerlab operations (deploy, destroy, inspect, exec). Reports results back to the platform via HTTP callbacks.

**Frontend** — Next.js 15 app with a brutalist/schematic design. Provides dashboard, topology editor, lab management, and an in-browser terminal for running commands on lab nodes.

## How Deploy Works

1. User clicks **Deploy** in the frontend
2. Frontend `POST /api/v1/labs/{id}/deploy`
3. Platform selects an available worker, loads the topology YAML + bind files, and sends a deploy request to the worker
4. Worker writes topology to disk, calls `containerlab.Deploy()` via the Go library
5. Worker pushes status updates (`deploying` -> `running`) and node info back to the platform via `/api/internal/labs/status` and `/api/internal/labs/nodes`
6. Frontend polls or receives WebSocket updates to reflect the new state

Destroy follows the same pattern in reverse.

## Terminal / Shell Relay

The frontend terminal sends commands via WebSocket to the platform, which proxies them to the worker's `/api/v1/labs/exec` endpoint. The worker runs `docker exec` on the target container and returns the output.

Channel format: `shell:{labUuid}:{nodeName}`

## Project Structure

```
/opt/labbed/
├── docker-compose.yaml          # PostgreSQL + platform + worker
├── platform/                    # Platform API
│   ├── main.go                  # Wiring & startup
│   ├── internal/
│   │   ├── config/              # Viper-based config
│   │   ├── domain/
│   │   │   ├── user/            # Auth, JWT, user CRUD
│   │   │   ├── collection/      # Multi-tenancy boundary
│   │   │   ├── topology/        # Topology definitions + bind files
│   │   │   ├── lab/             # Lab lifecycle (create/deploy/destroy)
│   │   │   └── worker/          # Worker registration + health
│   │   ├── ws/                  # WebSocket hub (real-time updates, shell relay)
│   │   ├── workerclient/        # HTTP client for platform -> worker calls
│   │   └── seed/                # Sample topology templates
│   └── go.mod
├── worker/                      # Worker agent
│   ├── main.go
│   ├── internal/
│   │   ├── config/              # Worker config
│   │   ├── api/                 # HTTP handlers (deploy/destroy/inspect/exec)
│   │   ├── clab/                # Containerlab library wrapper
│   │   └── platformclient/      # HTTP client for worker -> platform callbacks
│   └── go.mod
└── frontend/app/                # Next.js frontend
    ├── src/
    │   ├── app/                 # App Router pages
    │   │   ├── page.tsx         # Dashboard
    │   │   ├── login/           # Login page
    │   │   ├── labs/[id]/       # Lab detail (topology canvas, terminal)
    │   │   ├── topologies/      # Topology list + detail + create
    │   │   └── collections/     # Collection management
    │   ├── components/
    │   │   ├── lab/             # TerminalPanel (with quick commands)
    │   │   ├── topology/        # TopologyCanvas (SVG, auto-layout)
    │   │   └── ui/              # ArrowButton, StatusDot, MatrixTable, etc.
    │   ├── hooks/               # useAuth, useWebSocket
    │   ├── lib/                 # API client, YAML parser
    │   └── types/               # TypeScript type definitions
    └── package.json
```

## API Routes

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login (email/password) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/config` | Auth provider config |

### Authenticated (JWT)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/users` | User management |
| GET/POST | `/api/v1/collections` | Collection CRUD |
| GET/POST | `/api/v1/topologies` | Topology CRUD |
| GET/POST | `/api/v1/labs` | Lab CRUD |
| POST | `/api/v1/labs/:id/deploy` | Deploy a lab |
| POST | `/api/v1/labs/:id/destroy` | Destroy a lab |
| GET | `/api/v1/workers` | List workers |
| GET | `/ws?token=...` | WebSocket connection |

### Internal (Worker <-> Platform)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/internal/workers/register` | Worker registration |
| POST | `/api/internal/workers/heartbeat` | Worker heartbeat |
| POST | `/api/internal/labs/status` | Lab state callback |
| POST | `/api/internal/labs/nodes` | Node info callback |

### Worker API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/labs/deploy` | Deploy containers |
| POST | `/api/v1/labs/destroy` | Destroy containers |
| POST | `/api/v1/labs/inspect` | Inspect running lab |
| POST | `/api/v1/labs/exec` | Execute command in container |
| GET | `/health` | Worker health check |

## Tech Stack

- **Backend**: Go 1.23, Gin, GORM, gorilla/websocket
- **Database**: PostgreSQL 16 (primary), SQLite (dev option)
- **Container orchestration**: containerlab v0.73.0 (Go library)
- **Frontend**: Next.js 15, TypeScript, bun
- **Auth**: JWT (access + refresh tokens)

## Target NOS

- FRRouting (FRR) 10.3.1
- Alpine Linux 3.20
- dnsmasq (DHCP/DNS)

## Quick Start (Dev)

```bash
# Start PostgreSQL
docker compose up -d postgres

# Start platform (terminal 1)
cd platform
LABBED_AUTH_JWT_SECRET=dev-secret go run main.go

# Start worker (terminal 2)
cd worker
LABBED_WORKER_PLATFORM_SECRET=change-me-in-production go run main.go

# Start frontend (terminal 3)
cd frontend/app
bun install
bun run dev
```

Default credentials: `admin@labbed.local` / `admin`

## Configuration

All config is via environment variables (prefix `LABBED_` for platform, `LABBED_WORKER_` for worker) or YAML config files.

### Platform
| Variable | Default | Description |
|----------|---------|-------------|
| `LABBED_SERVER_PORT` | `8080` | API port |
| `LABBED_SERVER_PLATFORM_URL` | `http://localhost:8080` | Callback URL for workers |
| `LABBED_DATABASE_DRIVER` | `postgres` | `postgres` or `sqlite` |
| `LABBED_DATABASE_HOST` | `localhost` | DB host |
| `LABBED_AUTH_JWT_SECRET` | `change-me-in-production` | JWT signing key |
| `LABBED_AUTH_ADMIN_EMAIL` | `admin@labbed.local` | Default admin email |
| `LABBED_AUTH_ADMIN_PASSWORD` | `admin` | Default admin password |

### Worker
| Variable | Default | Description |
|----------|---------|-------------|
| `LABBED_WORKER_NAME` | `worker-1` | Worker display name |
| `LABBED_WORKER_PORT` | `8081` | Worker API port |
| `LABBED_WORKER_PLATFORM_URL` | `http://localhost:8080` | Platform URL |
| `LABBED_WORKER_PLATFORM_SECRET` | `change-me` | Shared auth secret |
| `LABBED_WORKER_WORK_DIR` | `/tmp/labbed-worker` | Topology file storage |
| `LABBED_WORKER_MAX_CONCURRENT_LABS` | `0` (unlimited) | Max concurrent labs |
