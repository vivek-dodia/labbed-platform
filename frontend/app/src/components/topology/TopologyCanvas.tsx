"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  parseContainerlabYAML,
  type ParsedNode,
} from "@/lib/yaml-parser";

interface Props {
  definition: string;
  selectedNode?: string | null;
  onSelectNode?: (name: string) => void;
  nodeStates?: Record<string, string>;
}

const NODE_W = 130;
const NODE_H = 44;
const PAD = 40;

// auto-layout: arrange nodes in a circle within a coordinate space
function layoutNodes(nodes: ParsedNode[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = (width - PAD * 2 - NODE_W) / 2;
  const ry = (height - PAD * 2 - NODE_H) / 2;
  const r = Math.min(rx, ry);

  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return {
      ...node,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });
}

function stateColor(state?: string) {
  switch (state) {
    case "running":
      return "var(--status-live)";
    case "exited":
    case "failed":
      return "var(--status-fail)";
    case "starting":
      return "var(--status-pending)";
    default:
      return "#0A0A0A";
  }
}

export default function TopologyCanvas({
  definition,
  selectedNode,
  onSelectNode,
  nodeStates,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setSize({ w: el.clientWidth || 800, h: el.clientHeight || 500 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const topo = useMemo(() => parseContainerlabYAML(definition), [definition]);
  const laidOut = useMemo(
    () => layoutNodes(topo.nodes, size.w, size.h),
    [topo.nodes, size.w, size.h]
  );
  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    laidOut.forEach((n) => m.set(n.name, { x: n.x, y: n.y }));
    return m;
  }, [laidOut]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 400,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(10,10,10,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(10,10,10,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "30px 30px",
        }}
      />

      {/* SVG layer: links + nodes in same coordinate space */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      >
        {/* links */}
        {topo.links.map((link, i) => {
          const a = nodeMap.get(link.a.node);
          const b = nodeMap.get(link.b.node);
          if (!a || !b) return null;
          return (
            <line
              key={`link-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#0A0A0A"
              strokeWidth="1"
              strokeDasharray="6"
            />
          );
        })}

        {/* nodes */}
        {laidOut.map((node) => {
          const selected = selectedNode === node.name;
          const state = nodeStates?.[node.name];
          const borderColor = state ? stateColor(state) : "#0A0A0A";
          const halfW = NODE_W / 2;
          const halfH = NODE_H / 2;

          return (
            <g
              key={node.name}
              onClick={() => onSelectNode?.(node.name)}
              style={{ cursor: "pointer" }}
            >
              {/* shadow */}
              <rect
                x={node.x - halfW + 2}
                y={node.y - halfH + 2}
                width={NODE_W}
                height={NODE_H}
                fill="rgba(10,10,10,0.1)"
                rx={0}
              />
              {/* box */}
              <rect
                x={node.x - halfW}
                y={node.y - halfH}
                width={NODE_W}
                height={NODE_H}
                fill="#F2F2F2"
                stroke={borderColor}
                strokeWidth={selected ? 2 : 1}
                rx={0}
              />
              {/* selection outline */}
              {selected && (
                <rect
                  x={node.x - halfW - 3}
                  y={node.y - halfH - 3}
                  width={NODE_W + 6}
                  height={NODE_H + 6}
                  fill="none"
                  stroke={borderColor}
                  strokeWidth={1}
                  strokeDasharray="4"
                  rx={0}
                />
              )}
              {/* name */}
              <text
                x={node.x}
                y={node.y - 4}
                textAnchor="middle"
                fill="#0A0A0A"
                fontSize="11"
                fontWeight="700"
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                style={{ textTransform: "uppercase" } as React.CSSProperties}
              >
                {node.name}
              </text>
              {/* meta */}
              <text
                x={node.x}
                y={node.y + 12}
                textAnchor="middle"
                fill="#0A0A0A"
                fontSize="9"
                opacity={0.5}
                fontFamily="'Courier New', monospace"
              >
                {node.kind} • {node.image.split(":")[0].split("/").pop()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
