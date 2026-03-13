// ── Auth ──
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface AuthConfigResponse {
  enableNative: boolean;
  enableGoogle: boolean;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  orgName: string;
}

export interface GoogleAuthorizeResponse {
  url: string;
  state: string;
}

// ── Organizations ──
export type OrgRole = "owner" | "admin" | "member";

export interface OrgResponse {
  uuid: string;
  name: string;
  slug: string;
  plan: string;
  maxLabs: number;
  maxWorkers: number;
  role?: OrgRole;
  createdAt: string;
}

export interface OrgMemberResponse {
  userId: string;
  email: string;
  name: string;
  role: OrgRole;
  joinedAt: string;
}

export interface CreateOrgRequest {
  name: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Users ──
export interface UserResponse {
  uuid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  isAdmin: boolean;
}

export interface UpdateUserRequest {
  displayName?: string;
  isAdmin?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ── Collections ──
export interface CollectionResponse {
  uuid: string;
  name: string;
  publicRead: boolean;
  publicDeploy: boolean;
  creatorId: string;
  createdAt: string;
}

export interface CreateCollectionRequest {
  name: string;
  publicRead: boolean;
  publicDeploy: boolean;
}

export interface UpdateCollectionRequest {
  name?: string;
  publicRead?: boolean;
  publicDeploy?: boolean;
}

export interface AddMemberRequest {
  userId: string;
  role: "editor" | "deployer" | "viewer";
}

// ── Topologies ──
export interface BindFileResponse {
  uuid: string;
  filePath: string;
  content?: string;
  createdAt: string;
}

export interface TopologyResponse {
  uuid: string;
  name: string;
  definition: string;
  collectionId: string;
  creatorId: string;
  bindFiles: BindFileResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopologyRequest {
  name: string;
  definition: string;
  collectionId: string;
}

export interface UpdateTopologyRequest {
  name?: string;
  definition?: string;
}

export interface CreateBindFileRequest {
  filePath: string;
  content: string;
}

export interface UpdateBindFileRequest {
  filePath?: string;
  content?: string;
}

// ── Labs ──
export type LabState =
  | "scheduled"
  | "deploying"
  | "running"
  | "stopping"
  | "failed"
  | "stopped";

export interface NodeResponse {
  name: string;
  kind: string;
  image: string;
  containerId: string;
  ipv4: string;
  ipv6: string;
  state: string;
}

export interface LabResponse {
  uuid: string;
  name: string;
  state: LabState;
  topologyId: string;
  creatorId: number;
  nodes: NodeResponse[];
  scheduledStart: string | null;
  scheduledEnd: string | null;
  deployedAt: string | null;
  stoppedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface CreateLabRequest {
  name: string;
  topologyId: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface UpdateLabRequest {
  name?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

// ── NOS Images ──
export interface NosImageResponse {
  uuid: string;
  name: string;
  clabKind: string;
  dockerImage: string;
  defaultUser: string;
  defaultPass: string;
  isSystem: boolean;
  createdAt: string;
}

// ── Workers ──
export type WorkerState = "online" | "offline" | "draining";

export interface WorkerResponse {
  uuid: string;
  name: string;
  address: string;
  state: WorkerState;
  lastHeartbeat: string | null;
  capacity: number;
  activeLabs: number;
  createdAt: string;
}

export interface CreateWorkerRequest {
  name: string;
  address: string;
  capacity: number;
}

export interface UpdateWorkerRequest {
  name?: string;
  address?: string;
  state?: WorkerState;
  capacity?: number;
}

// ── Lab Events ──
export interface LabEventResponse {
  event: string;
  details: string;
  createdAt: string;
}

// ── WebSocket ──
export type WSMessageType =
  | "subscribe"
  | "unsubscribe"
  | "lab:state"
  | "lab:log"
  | "lab:nodes"
  | "shell:data"
  | "shell:close"
  | "status"
  | "error";

export interface WSMessage {
  type: WSMessageType;
  channel: string;
  data?: unknown;
}
