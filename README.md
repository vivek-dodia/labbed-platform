# Labbed

Cloud-native platform for deploying and managing containerlab network labs. Multi-tenant, org-scoped, with real-time WebSocket updates.

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

**Platform** — Central API server. Handles authentication, organizations, users, collections, topologies, labs, and worker management. Stores state in PostgreSQL. Exposes a WebSocket endpoint for real-time updates (lab state changes, deployment logs, shell relay).

**Worker** — Agent that runs on Docker hosts. Registers with the platform on startup, sends periodic heartbeats, and executes containerlab operations (deploy, destroy, inspect, exec). Reports results back to the platform via HTTP callbacks. Streams deployment logs in real-time.

**Frontend** — Next.js 15 app with React Flow topology visualization, interactive terminal with per-node persistence, packet capture, config diff, bulk commands, and full API documentation. Features a tiered auto-layout engine that arranges nodes by role (routers → servers → clients).

## Multi-Tenancy

Labbed uses **Organizations** as the top-level tenant boundary. Every resource (collection, topology, lab, worker) belongs to an organization.

### How it works

- Users self-register via `POST /api/v1/auth/signup`, which creates both a user account and a personal organization
- Users can create additional organizations and invite members
- All data-plane API requests require an `X-Org-ID` header identifying the target organization
- The platform validates org membership before processing the request
- Resources are scoped to their org — users in org A cannot see or modify org B's resources
- Platform admins can access any organization for administrative purposes

### Org roles

| Role | Permissions |
|------|-------------|
| `owner` | Full control, manage members, delete org |
| `admin` | Manage resources, manage members |
| `member` | Create and manage own resources |

### Request flow

```
Client Request
  │
  ├── Authorization: Bearer <JWT>     → AuthRequired middleware (validates user)
  ├── X-Org-ID: <org-uuid>           → OrgContext middleware (validates membership)
  │
  └── Handler
       ├── List operations → scoped to org via OrgID
       └── Individual operations → ownership check (resource.OrgID == request org)
```

## How Deploy Works

1. User clicks **Deploy** in the frontend
2. Frontend `POST /api/v1/labs/{id}/deploy` with `X-Org-ID` header
3. Platform selects an available worker, loads the topology YAML + bind files, and sends a deploy request to the worker
4. Worker writes topology to disk, calls `containerlab.Deploy()` via the Go library
5. Worker pushes deployment logs, status updates (`deploying` → `running`), and node info back to the platform
6. Platform broadcasts updates via WebSocket — frontend receives them in real-time

Destroy follows the same pattern in reverse.

## Terminal / Shell Relay

The frontend terminal sends commands via WebSocket to the platform, which proxies them to the worker's `/api/v1/labs/exec` endpoint. The worker runs `docker exec` on the target container and returns the output.

Channel format: `shell:{labUuid}:{nodeName}`

The shell relay is also used for non-interactive operations:
- **Ping / Traceroute** — runs `ping -c 4` or `traceroute` to a target node IP
- **Bulk commands** — executes the same command on all nodes in parallel
- **Config fetch** — runs `vtysh -c 'show running-config'` on FRR nodes for config diff
- **Packet capture** — runs `tcpdump` via `nsenter` on the host (no install needed in containers), with BPF filter support and configurable packet count
- **Routing table** — runs `vtysh -c 'show ip route'` on router nodes

Terminal output is persisted per-node in a `Map<string, string[]>` ref, so switching between nodes preserves scroll history. Command history supports up/down arrow navigation with deduplication.

## Features

### Platform
- **Organization-based multi-tenancy** — full data isolation between orgs
- **Self-service signup** — creates user + personal org in one step
- **JWT + Google OAuth2** — native email/password login and Google SSO
- **RBAC** — owner/admin/member roles per organization
- **Real-time updates** — WebSocket broadcasts for lab state, node info, deployment logs
- **Deployment log streaming** — worker pushes log lines → platform broadcasts via WS
- **Lab cloning** — `POST /labs/:id/clone` duplicates a lab config
- **Topology validation** — `POST /topologies/validate` checks YAML structure before deploy
- **Lab event history** — audit trail of state transitions and deployments
- **Paginated responses** — `{data, total, limit, offset}` wrapper on list endpoints
- **Orphaned lab cleanup** — background goroutine marks stuck labs as failed after timeout
- **Rate limiting** — 20 req/min per IP on auth endpoints
- **Configurable CORS** — origin whitelist for API and WebSocket
- **Worker health monitoring** — stale workers auto-marked offline after missed heartbeats

### Frontend
- **Topology visualization** — React Flow canvas with auto-layout, draggable nodes, and interactive MiniMap
- **Tiered node layout** — routers on top, servers in middle, clients on bottom (auto-classified by name, kind, and image)
- **Node status dots** — colored 8px circles on each node (green=running, red=failed, yellow=deploying, gray=stopped)
- **Hover edge labels** — hover over connections to see interface names (e.g. `eth1 ↔ eth2 · SNIFF`)
- **Link-click packet capture** — click any link to open a tcpdump sniffer with BPF filter support and configurable packet count
- **Interactive terminal** — WebSocket shell relay to running containers with per-node buffer persistence
- **Command history** — up/down arrow navigation through previous commands, deduplication, 100-entry limit
- **Terminal clear** — clear button resets terminal output and per-node buffer
- **Quick commands** — context-aware command buttons (FRR: show routes/BGP/OSPF, DHCP/DNS: leases/zones, Linux: ip addr/route)
- **Tabbed bottom panel** — TERMINAL | LOGS | EVENTS | YAML | BULK CMD tabs in a collapsible dark panel
- **Deployment logs** — real-time log streaming during deploy/destroy via WebSocket
- **Events timeline** — audit trail of lab state transitions with relative timestamps, auto-refreshes every 10s
- **YAML viewer** — syntax-highlighted topology definition with color-coded keys, values, comments, and line numbers
- **Bulk command execution** — run a command on all nodes in parallel, results displayed per-node with status
- **Uptime timer** — live HH:MM:SS counter since deployment, displayed in the header when lab is running
- **Clone button** — one-click lab cloning with automatic navigation to the new lab
- **Copy-to-clipboard** — click to copy IPv4 addresses and container IDs with "COPIED" feedback
- **Ping test** — select a target node and run `ping -c 4` via shell relay, shows PASS/FAIL with output
- **Traceroute** — run traceroute to any node with IPv4, output displayed inline
- **Config diff** — fetch running config via `vtysh -c 'show running-config'`, compare against startup bind file with added/removed line highlighting
- **WS connection indicator** — real-time WebSocket status dot (green/yellow/red) with label in the header
- **Full-screen canvas** — topology fills the viewport, terminal slides in on node selection
- **Settings page** — profile, organization member management, password change
- **API documentation** — interactive docs with curl examples, response previews, and try-it modal
- **Lab management** — deploy, destroy, clone, delete with real-time state updates

## Project Structure

```
/opt/labbed/
├── docker-compose.yaml          # PostgreSQL + platform + worker
├── platform/                    # Platform API
│   ├── main.go                  # Wiring & startup
│   ├── internal/
│   │   ├── auth/                # JWT middleware, org context middleware
│   │   ├── config/              # Viper-based config
│   │   ├── domain/
│   │   │   ├── user/            # Auth, JWT, user CRUD
│   │   │   ├── organization/    # Org CRUD, membership, signup, quotas
│   │   │   ├── collection/      # Topology grouping (org-scoped)
│   │   │   ├── topology/        # Topology definitions + bind files (org-scoped)
│   │   │   ├── lab/             # Lab lifecycle, events, cloning (org-scoped)
│   │   │   └── worker/          # Worker registration + health (org-scoped)
│   │   ├── ws/                  # WebSocket hub (real-time updates, shell relay)
│   │   ├── workerclient/        # HTTP client for platform → worker calls
│   │   └── seed/                # Sample topology templates + default org
│   └── go.mod
├── worker/                      # Worker agent
│   ├── main.go
│   ├── internal/
│   │   ├── config/              # Worker config
│   │   ├── api/                 # HTTP handlers (deploy/destroy/inspect/exec)
│   │   ├── clab/                # Containerlab library wrapper
│   │   └── platformclient/      # HTTP client for worker → platform callbacks
│   └── go.mod
└── frontend/app/                # Next.js frontend
    ├── src/
    │   ├── app/                 # App Router pages
    │   │   ├── labs/[id]/       # Lab detail (topology canvas + terminal)
    │   │   ├── topologies/      # Topology list + editor
    │   │   ├── collections/     # Collection management
    │   │   ├── settings/        # Profile, org, security settings
    │   │   ├── docs/            # Interactive API documentation
    │   │   ├── admin/           # User + worker admin panels
    │   │   └── login/           # Auth (native + Google OAuth2)
    │   ├── components/
    │   │   ├── topology/        # TopologyCanvas (React Flow + tiered layout)
    │   │   ├── layout/          # AppShell, navigation
    │   │   └── ui/              # StatusBadge, Pill, Modal, etc.
    │   ├── hooks/               # useAuth, useWebSocket, useShellInput
    │   ├── lib/                 # API client, YAML parser
    │   └── types/               # TypeScript type definitions
    └── package.json
```

Each domain follows the same pattern: `entity.go`, `repository.go`, `service.go`, `handler.go`, `routes.go`.

## API Routes

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/signup` | Self-service registration (creates user + org) |
| POST | `/api/v1/auth/login` | Login (email/password) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/config` | Auth provider config |

### Authenticated (JWT, no org context)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/users` | User management |
| GET/POST | `/api/v1/organizations` | Org CRUD |
| GET | `/api/v1/organizations/:id/members` | List org members |
| POST | `/api/v1/organizations/:id/members` | Add org member |
| DELETE | `/api/v1/organizations/:id/members/:userId` | Remove org member |

### Org-Scoped (JWT + X-Org-ID header)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/collections` | Collection CRUD |
| GET/POST | `/api/v1/topologies` | Topology CRUD |
| POST | `/api/v1/topologies/validate` | Validate topology YAML |
| GET/POST | `/api/v1/labs` | Lab CRUD (paginated, filterable by state) |
| POST | `/api/v1/labs/:id/deploy` | Deploy a lab |
| POST | `/api/v1/labs/:id/destroy` | Destroy a lab |
| POST | `/api/v1/labs/:id/clone` | Clone a lab |
| POST | `/api/v1/labs/:id/capture` | Packet capture on a node interface |
| GET | `/api/v1/labs/:id/events` | Lab event history |
| GET/POST | `/api/v1/workers` | Worker management (admin) |
| GET | `/ws?token=...` | WebSocket connection |

### Internal (Worker ↔ Platform)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/internal/workers/register` | Worker registration |
| POST | `/api/internal/workers/heartbeat` | Worker heartbeat |
| POST | `/api/internal/labs/status` | Lab state callback |
| POST | `/api/internal/labs/nodes` | Node info callback |
| POST | `/api/internal/labs/logs` | Deployment log streaming |

### Worker API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/labs/deploy` | Deploy containers |
| POST | `/api/v1/labs/destroy` | Destroy containers |
| POST | `/api/v1/labs/inspect` | Inspect running lab |
| POST | `/api/v1/labs/exec` | Execute command in container |
| POST | `/api/v1/labs/capture` | Packet capture via nsenter + tcpdump |
| GET | `/health` | Worker health check |

## Database Models

```
Organization ──< OrganizationMember >── User
     │
     ├── Collection ──< CollectionMember >── User
     │       │
     │       └── Topology ──< BindFile
     │
     ├── Lab ──< LabNode
     │    │
     │    └──< LabEvent
     │
     └── Worker
```

All org-scoped entities (Collection, Topology, Lab, Worker) have an `OrgID` foreign key.

## Tests

```bash
# Backend — run all tests (requires CGO for SQLite)
CGO_ENABLED=1 go test ./... -count=1

# Run org middleware tests
CGO_ENABLED=1 go test ./internal/auth/ -v

# Run org service + isolation tests
CGO_ENABLED=1 go test ./internal/domain/organization/ -v

# Frontend — run all tests (vitest)
cd frontend/app
bun run test
```

**Backend test coverage:**
- Org context middleware — header validation, auth checks, membership, platform admin bypass, role helpers
- Org service — signup, create, membership CRUD, quota checks, slug generation
- Cross-domain isolation — collection/topology/lab/worker scoping verified between two separate orgs

**Frontend test coverage (128 tests):**
- Lab detail utilities — shortName, formatUptime, timeAgo, isRouterNode, getCommandsForImage, computeLineDiff, tcpdump command construction, capture side selection, command history
- Topology canvas — getStatusColor, classifyNode (router/server/client by name, kind, image), LinkEndpoint type
- API types — LabEventResponse, LabResponse, NodeResponse, BindFileResponse, PaginatedResponse, WSMessageType
- YAML parser — parseContainerlabYAML, node extraction, link parsing, edge cases
- YAML highlighting — line classification (key, value, comment, list), value type detection
- WebSocket status — WSConnectionStatus type, status-to-color/label mapping

## Tech Stack

- **Backend**: Go 1.23, Gin, GORM, gorilla/websocket
- **Database**: PostgreSQL 16 (primary), SQLite (dev option)
- **Container orchestration**: containerlab v0.73.0 (Go library)
- **Frontend**: Next.js 15, TypeScript, React Flow (@xyflow/react), bun
- **Auth**: JWT (access 30m + refresh 30d), Google OAuth2, org membership validation

## Supported Network OS

| NOS | Image | containerlab Kind | Notes |
|-----|-------|-------------------|-------|
| FRRouting (FRR) 10.3.1 | `quay.io/frrouting/frr:10.3.1` | `linux` | Native container, no KVM needed |
| Alpine Linux 3.20 | `alpine:3.20` | `linux` | Native container, no KVM needed |
| dnsmasq (DHCP/DNS) | `alpine:3.20` + dnsmasq | `linux` | Native container, no KVM needed |
| MikroTik RouterOS CHR 7.20.8 | `vrnetlab/mikrotik_routeros:7.20.8` | `mikrotik_ros` | vrnetlab (QEMU), requires KVM |

### vrnetlab Images (KVM required)

RouterOS CHR and other vendor NOS images use [vrnetlab](https://github.com/srl-labs/vrnetlab) — QEMU VMs packaged as Docker containers. These require `/dev/kvm` on the host (bare-metal or VM with nested virtualization).

**Building RouterOS CHR:**
```bash
git clone https://github.com/srl-labs/vrnetlab && cd vrnetlab/mikrotik/routeros
# Download CHR VMDK from https://mikrotik.com/download (CHR tab)
wget https://download.mikrotik.com/routeros/7.20.8/chr-7.20.8.vmdk.zip
unzip chr-7.20.8.vmdk.zip
make docker-image
# Result: vrnetlab/mikrotik_routeros:7.20.8
```

**RouterOS interface mapping:** `eth0` → `ether1` (management, reserved), `eth1` → `ether2` (first data port), etc.

**Default credentials:** `admin:admin`

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

### First steps

1. Login with admin credentials to get a JWT
2. Note the default org UUID from `GET /api/v1/organizations`
3. Include `X-Org-ID: <org-uuid>` header on all resource requests
4. Browse sample topologies in the "Sample Labs" collection
5. Deploy a lab and watch real-time updates via WebSocket

## Configuration

All config is via environment variables (prefix `LABBED_` for platform, `LABBED_WORKER_` for worker) or YAML config files.

### Platform
| Variable | Default | Description |
|----------|---------|-------------|
| `LABBED_SERVER_PORT` | `8080` | API port |
| `LABBED_SERVER_PLATFORM_URL` | `http://localhost:8080` | Callback URL for workers |
| `LABBED_SERVER_CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `LABBED_DATABASE_DRIVER` | `postgres` | `postgres` or `sqlite` |
| `LABBED_DATABASE_HOST` | `localhost` | DB host |
| `LABBED_AUTH_JWT_SECRET` | `change-me-in-production` | JWT signing key |
| `LABBED_AUTH_ADMIN_EMAIL` | `admin@labbed.local` | Default admin email |
| `LABBED_AUTH_ADMIN_PASSWORD` | `admin` | Default admin password |
| `LABBED_AUTH_GOOGLE_ENABLED` | `false` | Enable Google OAuth2 |
| `LABBED_AUTH_GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `LABBED_AUTH_GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `LABBED_AUTH_GOOGLE_REDIRECT_URI` | — | OAuth redirect URI |

### Worker
| Variable | Default | Description |
|----------|---------|-------------|
| `LABBED_WORKER_NAME` | `worker-1` | Worker display name |
| `LABBED_WORKER_PORT` | `8081` | Worker API port |
| `LABBED_WORKER_PLATFORM_URL` | `http://localhost:8080` | Platform URL |
| `LABBED_WORKER_PLATFORM_SECRET` | `change-me` | Shared auth secret |
| `LABBED_WORKER_WORK_DIR` | `/tmp/labbed-worker` | Topology file storage |
| `LABBED_WORKER_MAX_CONCURRENT_LABS` | `0` (unlimited) | Max concurrent labs |
