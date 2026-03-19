import { useReducer, useMemo, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { NosImageResponse } from "@/types/api";
import type { BuilderState, BuilderNode, BuilderLink, Scenario } from "@/lib/yaml-generator";

// ── Actions ──

type Action =
  | { type: "ADD_NODE"; nosImage: NosImageResponse; position: { x: number; y: number } }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "UPDATE_NODE"; nodeId: string; changes: Partial<Pick<BuilderNode, "name" | "nosImageId" | "clabKind" | "dockerImage" | "exec">> }
  | { type: "ADD_LINK"; sourceNodeId: string; targetNodeId: string }
  | { type: "REMOVE_LINK"; linkId: string }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_COLLECTION"; collectionId: string }
  | { type: "SET_SCENARIO"; scenario: Scenario }
  | { type: "UPDATE_POSITION"; nodeId: string; position: { x: number; y: number } }
  | { type: "LOAD_STATE"; state: BuilderState };

// ── Category detection ──

const ROUTER_KINDS = new Set(["mikrotik_ros", "openwrt", "freebsd", "frr"]);
const HOST_IMAGES = ["labbed-host"];
const SERVICE_IMAGES = ["kea", "coredns", "nginx"];

function getNodeCategory(nosImage: NosImageResponse): "router" | "host" | "svc" {
  if (ROUTER_KINDS.has(nosImage.clabKind)) return "router";
  const imgLower = nosImage.dockerImage.toLowerCase();
  if (imgLower.includes("gobgp") || imgLower.includes("frr") || imgLower.includes("bird")) return "router";
  if (HOST_IMAGES.some((h) => imgLower.includes(h))) return "host";
  if (SERVICE_IMAGES.some((s) => imgLower.includes(s))) return "svc";
  // Fallback: check kind
  if (nosImage.clabKind === "linux") {
    if (HOST_IMAGES.some((h) => imgLower.includes(h))) return "host";
    return "svc";
  }
  return "router";
}

// ── Helpers ──

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
}

function isNameUnique(name: string, nodes: BuilderNode[], excludeId?: string): boolean {
  return !nodes.some((n) => n.name === name && n.id !== excludeId);
}

// ── Reducer ──

function builderReducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case "ADD_NODE": {
      const category = getNodeCategory(action.nosImage);
      const counter = state.nextNodeCounters[category] || 1;
      const name = `${category}${counter}`;
      const nodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newNode: BuilderNode = {
        id: nodeId,
        name,
        nosImageId: action.nosImage.uuid,
        clabKind: action.nosImage.clabKind,
        dockerImage: action.nosImage.dockerImage,
        interfaces: [],
        exec: [],
        position: action.position,
      };
      return {
        ...state,
        nodes: [...state.nodes, newNode],
        nextNodeCounters: {
          ...state.nextNodeCounters,
          [category]: counter + 1,
        },
        nextIfaceCounters: {
          ...state.nextIfaceCounters,
          [nodeId]: 1,
        },
      };
    }

    case "REMOVE_NODE": {
      const linksToRemove = state.links.filter(
        (l) => l.sourceNodeId === action.nodeId || l.targetNodeId === action.nodeId,
      );
      // Clean interfaces from connected nodes
      let updatedNodes = state.nodes;
      for (const link of linksToRemove) {
        const otherId = link.sourceNodeId === action.nodeId ? link.targetNodeId : link.sourceNodeId;
        const otherIface = link.sourceNodeId === action.nodeId ? link.targetIface : link.sourceIface;
        updatedNodes = updatedNodes.map((n) =>
          n.id === otherId
            ? { ...n, interfaces: n.interfaces.filter((i) => i !== otherIface) }
            : n,
        );
      }
      return {
        ...state,
        nodes: updatedNodes.filter((n) => n.id !== action.nodeId),
        links: state.links.filter(
          (l) => l.sourceNodeId !== action.nodeId && l.targetNodeId !== action.nodeId,
        ),
      };
    }

    case "UPDATE_NODE": {
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== action.nodeId) return n;
          const changes = { ...action.changes };
          if (changes.name !== undefined) {
            const sanitized = sanitizeName(changes.name);
            if (!sanitized || !isNameUnique(sanitized, state.nodes, n.id)) {
              delete changes.name;
            } else {
              changes.name = sanitized;
            }
          }
          return { ...n, ...changes };
        }),
      };
    }

    case "ADD_LINK": {
      if (action.sourceNodeId === action.targetNodeId) return state;
      // Check for duplicate link
      const exists = state.links.some(
        (l) =>
          (l.sourceNodeId === action.sourceNodeId && l.targetNodeId === action.targetNodeId) ||
          (l.sourceNodeId === action.targetNodeId && l.targetNodeId === action.sourceNodeId),
      );
      if (exists) return state;

      const srcCounter = state.nextIfaceCounters[action.sourceNodeId] || 1;
      const tgtCounter = state.nextIfaceCounters[action.targetNodeId] || 1;
      const srcIface = `eth${srcCounter}`;
      const tgtIface = `eth${tgtCounter}`;

      const newLink: BuilderLink = {
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sourceNodeId: action.sourceNodeId,
        sourceIface: srcIface,
        targetNodeId: action.targetNodeId,
        targetIface: tgtIface,
      };

      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id === action.sourceNodeId) return { ...n, interfaces: [...n.interfaces, srcIface] };
          if (n.id === action.targetNodeId) return { ...n, interfaces: [...n.interfaces, tgtIface] };
          return n;
        }),
        links: [...state.links, newLink],
        nextIfaceCounters: {
          ...state.nextIfaceCounters,
          [action.sourceNodeId]: srcCounter + 1,
          [action.targetNodeId]: tgtCounter + 1,
        },
      };
    }

    case "REMOVE_LINK": {
      const link = state.links.find((l) => l.id === action.linkId);
      if (!link) return state;
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id === link.sourceNodeId) return { ...n, interfaces: n.interfaces.filter((i) => i !== link.sourceIface) };
          if (n.id === link.targetNodeId) return { ...n, interfaces: n.interfaces.filter((i) => i !== link.targetIface) };
          return n;
        }),
        links: state.links.filter((l) => l.id !== action.linkId),
      };
    }

    case "SET_NAME":
      return { ...state, name: action.name };

    case "SET_COLLECTION":
      return { ...state, collectionId: action.collectionId };

    case "SET_SCENARIO":
      return { ...state, scenario: action.scenario };

    case "UPDATE_POSITION":
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.nodeId ? { ...n, position: action.position } : n,
        ),
      };

    case "LOAD_STATE":
      return action.state;

    default:
      return state;
  }
}

// ── Initial state ──

export function createInitialState(): BuilderState {
  return {
    name: "",
    collectionId: "",
    scenario: "static",
    nodes: [],
    links: [],
    nextNodeCounters: {},
    nextIfaceCounters: {},
  };
}

// ── Hook ──

export function useBuilderState() {
  const [state, dispatch] = useReducer(builderReducer, undefined, createInitialState);

  const rfNodes: Node[] = useMemo(
    () =>
      state.nodes.map((n) => ({
        id: n.id,
        type: "builder",
        position: n.position,
        data: {
          label: n.name,
          kind: n.clabKind,
          image: n.dockerImage.split(":")[0].split("/").pop() || "",
        },
      })),
    [state.nodes],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      state.links.map((l) => {
        const srcNode = state.nodes.find((n) => n.id === l.sourceNodeId);
        const tgtNode = state.nodes.find((n) => n.id === l.targetNodeId);
        const sPos = srcNode?.position || { x: 0, y: 0 };
        const tPos = tgtNode?.position || { x: 0, y: 0 };
        const dx = tPos.x - sPos.x;
        const dy = tPos.y - sPos.y;

        let sourceHandle: string;
        let targetHandle: string;
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy > 0) { sourceHandle = "bs"; targetHandle = "tt"; }
          else { sourceHandle = "ts"; targetHandle = "bt"; }
        } else {
          if (dx > 0) { sourceHandle = "rs"; targetHandle = "lt"; }
          else { sourceHandle = "ls"; targetHandle = "rt"; }
        }

        return {
          id: l.id,
          source: l.sourceNodeId,
          target: l.targetNodeId,
          sourceHandle,
          targetHandle,
          type: "hover",
          data: {
            sourceIface: l.sourceIface,
            targetIface: l.targetIface,
          },
          style: { stroke: "rgba(0,0,0,0.25)", strokeWidth: 1.5 },
        };
      }),
    [state.links, state.nodes],
  );

  const addNode = useCallback(
    (nosImage: NosImageResponse, position: { x: number; y: number }) =>
      dispatch({ type: "ADD_NODE", nosImage, position }),
    [],
  );

  const removeNode = useCallback(
    (nodeId: string) => dispatch({ type: "REMOVE_NODE", nodeId }),
    [],
  );

  const updateNode = useCallback(
    (nodeId: string, changes: Partial<Pick<BuilderNode, "name" | "nosImageId" | "clabKind" | "dockerImage" | "exec">>) =>
      dispatch({ type: "UPDATE_NODE", nodeId, changes }),
    [],
  );

  const addLink = useCallback(
    (sourceNodeId: string, targetNodeId: string) =>
      dispatch({ type: "ADD_LINK", sourceNodeId, targetNodeId }),
    [],
  );

  const removeLink = useCallback(
    (linkId: string) => dispatch({ type: "REMOVE_LINK", linkId }),
    [],
  );

  const setName = useCallback(
    (name: string) => dispatch({ type: "SET_NAME", name }),
    [],
  );

  const setCollection = useCallback(
    (collectionId: string) => dispatch({ type: "SET_COLLECTION", collectionId }),
    [],
  );

  const setScenario = useCallback(
    (scenario: Scenario) => dispatch({ type: "SET_SCENARIO", scenario }),
    [],
  );

  const updatePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) =>
      dispatch({ type: "UPDATE_POSITION", nodeId, position }),
    [],
  );

  const loadState = useCallback(
    (newState: BuilderState) => dispatch({ type: "LOAD_STATE", state: newState }),
    [],
  );

  return {
    state,
    rfNodes,
    rfEdges,
    addNode,
    removeNode,
    updateNode,
    addLink,
    removeLink,
    setName,
    setCollection,
    setScenario,
    updatePosition,
    loadState,
  };
}
