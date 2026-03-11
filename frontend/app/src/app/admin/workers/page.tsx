"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MatrixTable from "@/components/ui/MatrixTable";
import StatusDot from "@/components/ui/StatusDot";
import ArrowButton from "@/components/ui/ArrowButton";
import Modal from "@/components/ui/Modal";
import SchematicInput from "@/components/ui/SchematicInput";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { WorkerResponse } from "@/types/api";

export default function WorkersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.isAdmin) { router.push("/"); return; }
    api.get<WorkerResponse[]>("/api/v1/workers")
      .then(setWorkers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  async function handleCreate() {
    if (!name.trim() || !address.trim()) return;
    setCreating(true);
    try {
      const w = await api.post<WorkerResponse>("/api/v1/workers", {
        name,
        address,
        capacity: parseInt(capacity) || 10,
      });
      setWorkers((prev) => [w, ...prev]);
      setShowCreate(false);
      setName("");
      setAddress("");
    } finally {
      setCreating(false);
    }
  }

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return "never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      <SchematicGrid>
        <Header
          navItems={[
            { label: "(Dashboard)", href: "/" },
            { label: "(Users)", href: "/admin/users" },
          ]}
        />

        <Cell span={3} style={{ padding: "3vw" }}>
          <h1 style={{ fontSize: "5vw", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.1 }}>
            WORKER
            <br />
            FLEET
          </h1>
          <div style={{ marginTop: "4vw", maxWidth: "40vw" }}>
            <p className="label">SYS / ADMINISTRATION</p>
            <p className="footnote" style={{ marginTop: "1vw" }}>
              Monitor worker agents, their capacity, and heartbeat status. Workers
              self-register and send heartbeats every 15 seconds.
            </p>
          </div>
        </Cell>
        <Cell style={{ background: "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)" }} />

        <div style={{ gridColumn: "span 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1px", backgroundColor: "#0A0A0A" }}>
          <Cell span={3} style={{ padding: "1rem 1.5rem", flexDirection: "row", alignItems: "center" }}>
            <span className="label" style={{ opacity: 0.5 }}>
              {workers.filter((w) => w.state === "online").length} ONLINE / {workers.length} TOTAL
            </span>
          </Cell>
          <Cell style={{ padding: "1rem" }}>
            <ArrowButton label="+ Register Worker" onClick={() => setShowCreate(true)} />
          </Cell>
        </div>

        {loading ? (
          <Cell span={4} style={{ padding: "3rem", alignItems: "center" }}>
            <span className="label" style={{ opacity: 0.4 }}>LOADING...</span>
          </Cell>
        ) : (
          <MatrixTable
            headers={["NAME", "ADDRESS", "STATE", "HEARTBEAT", "CAPACITY", "ACTIVE"]}
            columnTemplate="1.5fr 1.5fr 0.8fr 1fr 0.6fr 0.6fr"
            rows={workers.map((w) => [
              <span key="n" style={{ fontWeight: 500 }}>{w.name}</span>,
              <span key="a" className="mono" style={{ fontSize: "0.75rem" }}>{w.address}</span>,
              <div key="s" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <StatusDot state={w.state} />
                <span className="label" style={{ fontSize: "0.65rem" }}>{w.state.toUpperCase()}</span>
              </div>,
              <span key="h" className="mono" style={{ fontSize: "0.75rem", opacity: 0.5 }}>{timeAgo(w.lastHeartbeat)}</span>,
              <span key="c">{w.capacity}</span>,
              <span key="al" style={{ fontWeight: 700 }}>{w.activeLabs}</span>,
            ])}
          />
        )}

        <Footer />
      </SchematicGrid>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="REGISTER WORKER">
        <SchematicInput label="WORKER_NAME" placeholder="worker-01" value={name} onChange={(e) => setName(e.target.value)} />
        <SchematicInput label="ADDRESS" placeholder="http://10.0.0.5:8081" value={address} onChange={(e) => setAddress(e.target.value)} />
        <SchematicInput label="CAPACITY" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <ArrowButton label={creating ? "Registering..." : "Register"} onClick={handleCreate} disabled={creating} />
      </Modal>
    </div>
  );
}
