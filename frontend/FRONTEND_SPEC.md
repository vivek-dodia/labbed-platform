# Labbed Frontend Specification

> Next.js app using Design 1's visual language (schematic/brutalist) with full feature coverage.
> This spec defines every page, component, and API contract needed to build the frontend.

---

## Design System

### Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#F2F2F2` | Cell backgrounds, input backgrounds |
| `--ink` | `#0A0A0A` | Text, borders, grid lines, fills |
| `--surface` | `#EBEBEB` | Table headers, secondary surfaces |
| `--accent-gradient-1` | `linear-gradient(180deg, #2b9d88, #c1755f 40%, #f6539f 75%, #fff)` | Vertical accent strips |
| `--accent-gradient-2` | `linear-gradient(90deg, #d3cadd, #e2a088 35%, #f4601d 65%, #206d39)` | Horizontal footer/divider strips |
| `--status-live` | `#2b9d88` | Running/live indicators |
| `--status-fail` | `#f6539f` | Failed/error indicators |
| `--status-pending` | `#c1755f` | Deploying/pending indicators |

### Typography

| Token | Style |
|-------|-------|
| `h1` | Helvetica Neue, 5vw, weight 400, uppercase, tracking 0.08em, line-height 1.1 |
| `h2` | Helvetica Neue, 2vw, weight 400, uppercase, tracking 0.05em |
| `label` | Helvetica Neue, 0.75rem, uppercase, tracking 0.02em |
| `mono` | 'Space Mono' or 'Courier New', monospace — terminal/code contexts |
| `footnote` | Helvetica Neue, 0.85vw, line-height 1.4 |

All UI labels are **UPPERCASE**. Body/description text is sentence case.

### Grid System

The core layout is a **4-column CSS grid** with `gap: 1px` and `background: #0A0A0A` (the gap color creates the grid lines). Each cell has `background: #F2F2F2`.

```css
.schematic-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background-color: #0A0A0A;
  width: 100%;
  min-height: 100vh;
}
.cell {
  background-color: #F2F2F2;
  position: relative;
}
```

Cells span columns with `grid-column: span N`. Nested sub-grids use the same 1px-gap pattern.

### WebGL Noise Overlay

Fixed-position `<canvas>` covering the viewport with `mix-blend-mode: multiply`, `opacity: 0.6`, `pointer-events: none`, `z-index: 9999`. Renders static grain via a fragment shader. This is a global component on every page.

### Interaction Patterns

| Pattern | Behavior |
|---------|----------|
| **Arrow Button** | Border `1px solid #0A0A0A`, on hover: bg inverts to `#0A0A0A`, text to `#F2F2F2`, SVG arrow color flips |
| **Cell Hover** | Subtle background shift to `#EBEBEB` (optional per-cell) |
| **Status Indicator** | 12px circle, filled = active, 1px line at 0.3 opacity = inactive |
| **Gradient Strip** | 8vw height gradient bar used as section divider |
| **Modal** | Fixed overlay `rgba(10,10,10,0.8)`, centered card with `#F2F2F2` bg, 1px border |

---

## Global Layout

Every authenticated page shares this structure:

```
+-----------------------------------------------------+
| HEADER (span 4)                                      |
| [LABBED] | [nav item] | [nav item] | [dark section] |
+-----------------------------------------------------+
| PAGE CONTENT (span 4, varies per page)               |
|                                                      |
+-----------------------------------------------------+
| GRADIENT FOOTER (span 4, accent-gradient-2, 8vw)    |
+-----------------------------------------------------+
| STATUS BAR (span 4)                                  |
| Section: ... | System Status: [Ready] — V.04.22     |
+-----------------------------------------------------+
```

### Header Component

4-column sub-grid inside `grid-column: span 4`:
- Cell 1: `LABBED` brand (label style) — links to `/`
- Cell 2-3: Navigation items (label style) — page-dependent
- Cell 4: Dark cell (`#0A0A0A` bg, `#F2F2F2` text) — contextual action or user info

### Footer Component

- Gradient divider: `accent-gradient-2`, height 8vw, `grid-column: span 4`
- Status bar: `grid-column: span 4`, flex row, space-between, footnote style

---

## Pages

---

### 1. LOGIN — `/login`

**Purpose**: Authentication entry point. No header/footer shell.

**Layout** (4-column grid):

```
+----------------------------------+-----------+
| HERO SECTION (span 3)           | GRADIENT  |
| "NETWORK                        | STRIP     |
|  SIMULATION                     | (span 1)  |
|  PLATFORM"                      | vertical  |
|                                 | accent-1  |
| 01 / AUTHENTICATION             |           |
| "Secure access to your lab..."  |           |
+----------------------------------+-----------+
| LOGIN FORM (span 2)  | VISUAL (span 2)     |
| [circle visual]       | [empty cell or       |
| ORG_ID input          |  secondary info]     |
| EMAIL input           |                      |
| PASSWORD input        |                      |
| [→ Authenticate]      |                      |
+----------------------------------+-----------+
| GRADIENT FOOTER (span 4)                    |
+-----------+-----------+-----------+----------+
| Status bar (span 4)                          |
+----------------------------------------------+
```

**API Contract**:
```
POST /api/v1/auth/login
Request:  { "email": string, "password": string }
Response: { "accessToken": string, "refreshToken": string, "user": UserResponse }
```

**State**: `email`, `password`, `error`, `loading`

**Behavior**:
- On success: store tokens (httpOnly cookie or localStorage), redirect to `/`
- On error: display error in footnote style below form
- Token refresh: `POST /api/v1/auth/refresh { "refreshToken": string }` → `{ "accessToken": string }`

---

### 2. DASHBOARD (Landing) — `/`

**Purpose**: Overview of user's labs and quick actions.

**Header nav**: `[LABBED] | [TOPOLOGIES] | [COLLECTIONS] | [USER: email ↘]`

**Layout**:

```
+----------------------------------+-----------+
| HERO (span 3)                   | ACCENT    |
| "ACTIVE                         | (span 1)  |
| SIMULATIONS"                    | gradient  |
|                                 |           |
| 01 / DASHBOARD                  |           |
| "Monitor and manage running..." |           |
+----------------------------------+-----------+
| STATS GRID (span 4)                         |
| 4 cells: Labs Running | Labs Total |        |
|          Nodes Active | Workers Online      |
+----------------------------------------------+
| LAB CARDS (span 4)                           |
| 4-column sub-grid of LabCard components      |
| Each card = 1 cell                           |
+----------------------------------------------+
| QUICK ACTIONS (span 4)                       |
| [→ New Lab] [→ Browse Templates] [→ Docs]   |
+----------------------------------------------+
```

**Components**:

#### StatCell
```
Props: { label: string, value: string | number, accent?: boolean }
Renders: cell with label (footnote) and value (h2 style)
If accent=true, dark bg with light text
```

#### LabCard
```
Props: { lab: LabResponse }
Renders:
- Status indicator (colored circle: live=#2b9d88, stopped=#c1755f, failed=#f6539f)
- Lab name (label style)
- Topology name (footnote)
- State badge (uppercase)
- Node count
- Created/deployed time
- Click → navigates to /labs/:uuid
```

**API Contracts**:
```
GET /api/v1/labs
Response: LabResponse[]

GET /api/v1/workers        (admin only — for worker count stat)
Response: WorkerResponse[]
```

**Data shape — LabResponse**:
```json
{
  "uuid": "string",
  "name": "string",
  "state": "scheduled | deploying | running | stopping | failed | stopped",
  "topologyId": "string",
  "creatorId": 0,
  "nodes": [{ "name": "", "kind": "", "image": "", "containerId": "", "ipv4": "", "ipv6": "", "state": "" }],
  "scheduledStart": "datetime | null",
  "scheduledEnd": "datetime | null",
  "deployedAt": "datetime | null",
  "stoppedAt": "datetime | null",
  "errorMessage": "string | null",
  "createdAt": "datetime"
}
```

---

### 3. TOPOLOGIES LIST — `/topologies`

**Purpose**: Browse and manage topology templates.

**Header nav**: `[LABBED] | [DASHBOARD] | [COLLECTIONS] | [+ NEW TOPOLOGY]`

**Layout**:

```
+----------------------------------+-----------+
| HERO (span 3)                   | ACCENT    |
| "TOPOLOGY                        | (span 1) |
|  LIBRARY"                        |          |
| 02 / TEMPLATES                   |          |
+----------------------------------+-----------+
| FILTER BAR (span 4)                         |
| Collection: [dropdown] | Search: [input]    |
+----------------------------------------------+
| TOPOLOGY TABLE (span 4)                     |
| Comparison-matrix style table:              |
| NAME | COLLECTION | NODES | CREATED | →     |
| row per topology                            |
+----------------------------------------------+
```

**API Contracts**:
```
GET /api/v1/topologies
Response: TopologyResponse[]

GET /api/v1/collections
Response: CollectionResponse[]
```

**Data shape — TopologyResponse**:
```json
{
  "uuid": "string",
  "name": "string",
  "definition": "string (YAML)",
  "collectionId": "string",
  "creatorId": "string",
  "bindFiles": [{ "uuid": "", "filePath": "", "createdAt": "" }],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

**Data shape — CollectionResponse**:
```json
{
  "uuid": "string",
  "name": "string",
  "publicRead": true,
  "publicDeploy": false,
  "creatorId": "string",
  "createdAt": "datetime"
}
```

---

### 4. TOPOLOGY EDITOR — `/topologies/:id`

**Purpose**: View/edit a topology definition, manage bind files, launch a lab from it.

**Header nav**: `[LABBED] | [← TOPOLOGIES] | [TOPOLOGY NAME] | [DEPLOY →]`

**Layout**:

```
+----------------------------------+-----------+
| CANVAS (span 3)                 | PROPS     |
| Visual node graph               | PANEL     |
| - Nodes rendered as positioned  | (span 1)  |
| boxes with labels               |           |
| - SVG lines for links           | Selected  |
| - Click node to select          | node info |
| - Dot-grid background           | Name      |
|                                 | Kind      |
|                                 | Image     |
|                                 | Interfaces|
+----------------------------------+-----------+
| DEFINITION EDITOR (span 2) | BIND FILES (2)|
| YAML editor (monospace)    | File list      |
| Shows topology.definition  | + Add File btn |
| Editable textarea          | Click to edit  |
+----------------------------------+-----------+
| ACTIONS BAR (span 4)                        |
| [→ Save Changes] [→ Deploy as Lab]          |
| [→ Export YAML] [→ Delete Topology]          |
+----------------------------------------------+
```

**Components**:

#### TopologyCanvas
```
Props: { definition: string, selectedNode: string | null, onSelectNode: fn }
Parses YAML definition to extract nodes and links.
Renders:
- Dot-grid background (CSS background-image)
- Positioned node boxes (absolute positioning within relative container)
- SVG connection lines between linked nodes
- Click handler on nodes
```

#### PropertiesPanel
```
Props: { node: ParsedNode | null }
Shows selected node details:
- Name, kind, image
- Interface list with endpoint mappings
- IP addresses if assigned
```

#### YAMLEditor
```
Props: { value: string, onChange: fn }
Monospace textarea, full-width, with line numbers (optional).
```

#### BindFileList
```
Props: { files: BindFileResponse[], topologyId: string, onRefresh: fn }
Lists files, click to view/edit content in a modal.
"+ Add File" button opens create modal.
```

**API Contracts**:
```
GET    /api/v1/topologies/:id              → TopologyResponse
PUT    /api/v1/topologies/:id              ← { name?, definition? }  → TopologyResponse
DELETE /api/v1/topologies/:id              → 204

POST   /api/v1/topologies/:id/files        ← { filePath, content }   → BindFileResponse
PATCH  /api/v1/topologies/:id/files/:fid   ← { filePath?, content? } → BindFileResponse
DELETE /api/v1/topologies/:id/files/:fid   → 204

POST   /api/v1/labs                        ← { name, topologyId }    → LabResponse
```

---

### 5. COLLECTIONS — `/collections`

**Purpose**: Manage collections (tenancy boundaries) and their members.

**Header nav**: `[LABBED] | [DASHBOARD] | [TOPOLOGIES] | [+ NEW COLLECTION]`

**Layout**:

```
+----------------------------------+-----------+
| HERO (span 3)                   | ACCENT    |
| "COLLECTIONS"                    | (span 1) |
| 04 / ORGANIZATION               |          |
+----------------------------------+-----------+
| COLLECTION LIST (span 4)                    |
| Matrix-style table:                         |
| NAME | VISIBILITY | CREATED | MEMBERS | →   |
+----------------------------------------------+
```

**Clicking a collection** opens an inline expanded row or navigates to `/collections/:id`:

```
+----------------------------------------------+
| COLLECTION DETAIL (span 4)                   |
| Name (editable) | Public Read toggle |       |
| Public Deploy toggle                         |
+----------------------------------------------+
| MEMBERS TABLE (span 4)                       |
| EMAIL | ROLE | [Remove]                      |
| [+ Add Member] form at bottom               |
+----------------------------------------------+
| TOPOLOGIES IN COLLECTION (span 4)            |
| Filtered topology list                       |
+----------------------------------------------+
```

**API Contracts**:
```
GET    /api/v1/collections                    → CollectionResponse[]
POST   /api/v1/collections                    ← { name, publicRead, publicDeploy }
GET    /api/v1/collections/:id                → CollectionResponse
PUT    /api/v1/collections/:id                ← { name?, publicRead?, publicDeploy? }
DELETE /api/v1/collections/:id                → 204
POST   /api/v1/collections/:id/members        ← { userId, role }
DELETE /api/v1/collections/:id/members/:uid   → 204
```

---

### 6. LAB DETAIL — `/labs/:id`

**Purpose**: Live lab view with topology visualization, terminal access, and controls.

**Header nav**: `[LABBED] | [← DASHBOARD] | [LAB NAME] | [● LIVE — state badge (dark cell)]`

**Layout**:

```
+----------------------------------+-----------+
| LAB INFO (span 3)               | CONTROLS  |
| Lab name (h1)                   | (span 1)  |
| State: RUNNING                  | [→ Stop]  |
| Topology: "BGP Triangle"        | [→ Destroy]|
| Deployed: 2h ago                | [→ Redeploy]|
| Nodes: 4 active                 |           |
+----------------------------------+-----------+
| TOPOLOGY CANVAS (span 3)        | TERMINAL  |
| Same TopologyCanvas component   | (span 1)  |
| but nodes show live state:      |           |
| - Green outline = running       | Dark bg   |
| - Red outline = exited          | #0A0A0A   |
| - Pulsing border = starting     |           |
| Click node → opens terminal     | Mono font |
| to that node                    | WebSocket |
|                                 | shell     |
+----------------------------------+-----------+
| NODE TABLE (span 4)                         |
| Matrix-style: NAME|KIND|IMAGE|IP|STATE      |
| Each row clickable → selects node           |
+----------------------------------------------+
```

**Components**:

#### TerminalPanel
```
Props: { labUuid: string, nodeName: string }
Dark cell (#0A0A0A bg, #F2F2F2 text, mono font).
Connects via WebSocket:
  1. Subscribe: { type: "subscribe", channel: "shell:{labUuid}:{nodeName}" }
  2. Send input: { type: "shell:data", channel: "...", data: { input: "show ip bgp\n" } }
  3. Receive output: { type: "shell:data", channel: "...", data: { output: "..." } }
Renders terminal output with scrollback buffer.
Input line at bottom with prompt.
Status bar: "CONNECTED VIA WEBSOCKET" + latency indicator.
```

#### LiveNodeOverlay
```
Extends TopologyCanvas nodes with:
- State-based border color (running=green, exited=red, starting=pulsing)
- Click to select → populates TerminalPanel
```

**API Contracts**:
```
GET  /api/v1/labs/:id                → LabResponse (includes nodes[])
POST /api/v1/labs/:id/deploy         → { message: string }
POST /api/v1/labs/:id/destroy        → { message: string }
GET  /api/v1/labs/:id/nodes          → NodeResponse[]
```

**WebSocket**:
```
Connect: ws://host/ws?token={accessToken}

Subscribe to lab state:
→ { "type": "subscribe", "channel": "lab:{uuid}" }
← { "type": "lab:state", "channel": "lab:{uuid}", "data": LabResponse }

Subscribe to node updates:
→ { "type": "subscribe", "channel": "lab:{uuid}:nodes" }
← { "type": "lab:nodes", "channel": "...", "data": NodeResponse[] }

Shell session:
→ { "type": "subscribe", "channel": "shell:{labUuid}:{nodeName}" }
→ { "type": "shell:data", "channel": "shell:...", "data": { "input": "..." } }
← { "type": "shell:data", "channel": "shell:...", "data": { "output": "..." } }
← { "type": "shell:close", "channel": "shell:..." }
```

---

### 7. ADMIN: WORKERS — `/admin/workers`

**Purpose**: Monitor worker fleet (admin only).

**Header nav**: `[LABBED] | [DASHBOARD] | [USERS] | [ADMIN PANEL (dark)]`

**Layout**:

```
+----------------------------------+-----------+
| HERO (span 3)                   | ACCENT    |
| "WORKER                         | (span 1) |
|  FLEET"                         |          |
| SYS / ADMINISTRATION            |          |
+----------------------------------+-----------+
| WORKER TABLE (span 4)                       |
| Matrix: NAME|ADDRESS|STATE|HEARTBEAT|       |
|         CAPACITY|ACTIVE LABS                |
| State indicators:                           |
| ● online (green) ● offline (grey)          |
| ● draining (amber)                         |
+----------------------------------------------+
```

**API Contract**:
```
GET    /api/v1/workers          → WorkerResponse[]
POST   /api/v1/workers          ← { name, address, capacity }
PUT    /api/v1/workers/:id      ← { name?, address?, state?, capacity? }
DELETE /api/v1/workers/:id      → 204
```

**Data shape — WorkerResponse**:
```json
{
  "uuid": "string",
  "name": "string",
  "address": "string",
  "state": "online | offline | draining",
  "lastHeartbeat": "datetime | null",
  "capacity": 0,
  "activeLabs": 0,
  "createdAt": "datetime"
}
```

---

### 8. ADMIN: USERS — `/admin/users`

**Purpose**: User management (admin only).

**Header nav**: `[LABBED] | [DASHBOARD] | [WORKERS] | [ADMIN PANEL (dark)]`

**Layout**:

```
+----------------------------------------------+
| HERO (span 3) + ACCENT (span 1)             |
| "USER REGISTRY"                              |
+----------------------------------------------+
| USER TABLE (span 4)                          |
| Matrix: EMAIL|DISPLAY NAME|ROLE|CREATED      |
| Role: ADMIN badge or MEMBER                  |
| [+ Create User] button                      |
+----------------------------------------------+
```

**API Contracts**:
```
GET    /api/v1/users                 → UserResponse[]  (admin)
POST   /api/v1/users                 ← { email, password, displayName, isAdmin }
PUT    /api/v1/users/:id             ← { displayName?, isAdmin? }
DELETE /api/v1/users/:id             → 204
```

---

### 9. PROFILE — `/profile`

**Purpose**: Current user settings, password change.

**Header nav**: standard + `[YOUR ACCOUNT (dark)]`

**Layout**:

```
+----------------------------------------------+
| HERO (span 3) + ACCENT (span 1)             |
| "ACCOUNT PARAMETERS"                         |
+----------------------------------------------+
| PROFILE FORM (span 2) | SECURITY (span 2)   |
| Display Name input    | Current Password     |
| Email (read-only)     | New Password         |
| [→ Update Profile]    | [→ Change Password]  |
+----------------------------------------------+
```

**API Contracts**:
```
GET /api/v1/users/me                    → UserResponse
PUT /api/v1/users/:id                   ← { displayName }
PUT /api/v1/users/:id/password          ← { currentPassword, newPassword }
```

---

### 10. API DOCS — `/docs`

**Purpose**: Interactive API reference (public, no auth required for viewing).

**Header nav**: `[LABBED] | [DASHBOARD] | [TOPOLOGIES] | [API REFERENCE (dark)]`

**Layout**:

```
+----------------------------------------------+
| HERO (span 4)                                |
| "API REFERENCE"                              |
| 05 / DEVELOPER ACCESS                       |
+----------------------------------------------+
| DOCS CONTENT (span 4)                        |
| 3-column sub-grid:                           |
| [NAV SIDEBAR (1fr)] [ENDPOINTS (2fr)]       |
|                      [CODE EXAMPLES (1fr)]   |
+----------------------------------------------+
```

**Components**:

#### EndpointBlock
```
Props: { method: string, path: string, description: string, requestBody?: object, responseBody?: object }
Renders:
- Method tag (colored: GET=#2b9d88, POST=#c1755f, DELETE=#f6539f, PUT=#d3cadd)
- Path in mono font
- Description in footnote
- Expandable request/response schema
```

#### CodeExample
```
Props: { method: string, path: string, body?: object, response?: object }
Renders dark terminal-style block (#0A0A0A bg):
- curl command with syntax coloring
- JSON response with key/value coloring
```

#### TryItPanel
```
Props: { method: string, path: string, bodySchema?: object }
Modal with:
- Auth token input
- Request body JSON editor (if POST/PUT)
- Send button → makes actual API call
- Response display in terminal block
```

The docs page content is statically defined from the API contracts above. Group endpoints by resource:
1. Authentication (login, refresh, config)
2. Users (me, update, password)
3. Collections (CRUD + members)
4. Topologies (CRUD + bind files)
5. Labs (CRUD + deploy/destroy + nodes)
6. Workers (admin — CRUD)
7. WebSocket (connection, channels, message types)

---

## Shared Components Reference

### ArrowButton
```
Props: { label: string, onClick: fn, inverted?: boolean }
The signature interaction element. Border button with right-arrow SVG.
Hover: inverts colors (bg ↔ text).
```

### MatrixTable
```
Props: { headers: string[], rows: ReactNode[][] }
Reusable comparison-matrix component.
Header row: #EBEBEB bg, label style.
Body rows: #F2F2F2 bg, footnote style, 1px bottom border.
```

### StatusDot
```
Props: { state: string }
12px circle. Maps state to color:
- running/online → #2b9d88 (filled)
- stopped/offline → #0A0A0A at 0.3 opacity
- deploying/draining → #c1755f (filled)
- failed → #f6539f (filled)
```

### GradientStrip
```
Props: { direction: 'horizontal' | 'vertical', height?: string }
Renders the accent gradient as a decorative divider.
```

### CircleVisual
```
Props: { size?: string }
Decorative element: outer circle (1px border) with inner filled circle (60%).
Used on form sections and hero areas.
```

### Modal
```
Props: { open: boolean, onClose: fn, title: string, children: ReactNode }
Fixed overlay with centered card. X button top-right.
Follows schematic style (1px border, #F2F2F2 bg).
```

### NoiseOverlay
```
No props. Global component rendered once at app root.
WebGL canvas, fixed position, full viewport.
```

### SchematicInput
```
Props: { label: string, ...inputProps }
Styled input: transparent bg, bottom border only, uppercase label above.
```

---

## Next.js App Structure

```
src/
  app/
    layout.tsx              ← Root layout: NoiseOverlay + global styles
    page.tsx                ← Dashboard (/)
    login/page.tsx          ← Login
    topologies/
      page.tsx              ← Topologies list
      [id]/page.tsx         ← Topology editor
    collections/
      page.tsx              ← Collections list
      [id]/page.tsx         ← Collection detail
    labs/
      [id]/page.tsx         ← Lab detail + terminal
    admin/
      workers/page.tsx      ← Worker fleet
      users/page.tsx        ← User management
    profile/page.tsx        ← User profile
    docs/page.tsx           ← API docs
  components/
    layout/
      Header.tsx
      Footer.tsx
      SchematicGrid.tsx
      NoiseOverlay.tsx
    ui/
      ArrowButton.tsx
      MatrixTable.tsx
      StatusDot.tsx
      GradientStrip.tsx
      CircleVisual.tsx
      Modal.tsx
      SchematicInput.tsx
      Pill.tsx
    topology/
      TopologyCanvas.tsx     ← Node graph renderer
      PropertiesPanel.tsx
      YAMLEditor.tsx
      BindFileList.tsx
    lab/
      TerminalPanel.tsx      ← WebSocket terminal
      LiveNodeOverlay.tsx
      NodeTable.tsx
    docs/
      EndpointBlock.tsx
      CodeExample.tsx
      TryItPanel.tsx
  lib/
    api.ts                   ← API client (fetch wrapper with auth)
    ws.ts                    ← WebSocket client (connect, subscribe, send)
    auth.ts                  ← Token storage, refresh logic
    yaml-parser.ts           ← Parse containerlab YAML → nodes/links
  hooks/
    useAuth.ts               ← Auth context + token refresh
    useLabs.ts               ← Lab data fetching + WebSocket state sync
    useWebSocket.ts          ← WebSocket connection management
  types/
    api.ts                   ← TypeScript types matching all DTOs
```

---

## Auth Flow

```
1. User visits any page
2. Middleware checks for valid accessToken
   - If missing/expired → redirect to /login
3. Login page: POST /api/v1/auth/login
   - Store accessToken + refreshToken
   - Redirect to /
4. On 401 from any API call:
   - Try POST /api/v1/auth/refresh with refreshToken
   - If success: retry original request with new accessToken
   - If fail: redirect to /login
5. Logout: clear tokens, redirect to /login
```

---

## WebSocket Integration

```typescript
// lib/ws.ts
class LabWebSocket {
  private ws: WebSocket;
  private subscriptions: Map<string, (data: any) => void>;

  connect(token: string) {
    this.ws = new WebSocket(`ws://${host}/ws?token=${token}`);
  }

  subscribe(channel: string, callback: (data: any) => void) {
    this.subscriptions.set(channel, callback);
    this.ws.send(JSON.stringify({ type: 'subscribe', channel }));
  }

  unsubscribe(channel: string) {
    this.subscriptions.delete(channel);
    this.ws.send(JSON.stringify({ type: 'unsubscribe', channel }));
  }

  sendShellInput(channel: string, input: string) {
    this.ws.send(JSON.stringify({ type: 'shell:data', channel, data: { input } }));
  }
}
```

**Auto-reconnect**: on disconnect, exponential backoff (1s, 2s, 4s, max 30s). Re-subscribe to all active channels on reconnect.

---

## API Client

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch(path, options); // retry
    redirectToLogin();
  }

  if (!res.ok) throw new ApiError(res.status, await res.json());
  if (res.status === 204) return null as T;
  return res.json();
}
```

---

## Route Protection

| Route | Auth Required | Admin Required |
|-------|:------------:|:--------------:|
| `/login` | No | No |
| `/docs` | No | No |
| `/` | Yes | No |
| `/topologies` | Yes | No |
| `/topologies/:id` | Yes | No |
| `/collections` | Yes | No |
| `/collections/:id` | Yes | No |
| `/labs/:id` | Yes | No |
| `/profile` | Yes | No |
| `/admin/workers` | Yes | Yes |
| `/admin/users` | Yes | Yes |
