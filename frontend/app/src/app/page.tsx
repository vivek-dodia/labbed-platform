"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ArrowButton from "@/components/ui/ArrowButton";
import StatusDot from "@/components/ui/StatusDot";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { LabResponse, WorkerResponse } from "@/types/api";

function StatCell({
  label,
  value,
  dark,
}: {
  label: string;
  value: string | number;
  dark?: boolean;
}) {
  return (
    <Cell dark={dark} style={{ padding: "2rem" }}>
      <span className="label" style={{ fontSize: "0.65rem", opacity: 0.6 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "2.5rem",
          fontWeight: 200,
          marginTop: "0.5rem",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </Cell>
  );
}

function LabCard({ lab }: { lab: LabResponse }) {
  return (
    <Link href={`/labs/${lab.uuid}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Cell
        style={{
          padding: "1.5rem",
          cursor: "pointer",
          minHeight: 160,
          justifyContent: "space-between",
          transition: "background-color 0.15s",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <StatusDot state={lab.state} />
            <span className="label" style={{ fontSize: "0.65rem" }}>
              {lab.state.toUpperCase()}
            </span>
          </div>
          <p style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.3rem" }}>
            {lab.name}
          </p>
          <p className="footnote" style={{ opacity: 0.5 }}>
            {lab.nodes?.length || 0} nodes
          </p>
        </div>
        <p
          className="mono footnote"
          style={{ opacity: 0.3, fontSize: "0.65rem" }}
        >
          {lab.uuid.slice(0, 8)}
        </p>
      </Cell>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [workers, setWorkers] = useState<WorkerResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    Promise.all([
      api.get<LabResponse[]>("/api/v1/labs").catch(() => []),
      user.isAdmin
        ? api.get<WorkerResponse[]>("/api/v1/workers").catch(() => [])
        : Promise.resolve([]),
    ]).then(([l, w]) => {
      setLabs(l);
      setWorkers(w);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div
        style={{
          backgroundColor: "#0A0A0A",
          minHeight: "100vh",
          padding: 1,
        }}
      >
        <SchematicGrid>
          <Cell span={4} style={{ padding: "3vw", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
            <span className="label" style={{ opacity: 0.4 }}>LOADING SYSTEM DATA...</span>
          </Cell>
        </SchematicGrid>
      </div>
    );
  }

  const runningLabs = labs.filter((l) => l.state === "running").length;
  const activeNodes = labs
    .filter((l) => l.state === "running")
    .reduce((sum, l) => sum + (l.nodes?.length || 0), 0);
  const onlineWorkers = workers.filter((w) => w.state === "online").length;

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      <SchematicGrid>
        <Header
          navItems={[
            { label: "(Topologies)", href: "/topologies" },
            { label: "(Collections)", href: "/collections" },
          ]}
        />

        {/* Hero */}
        <Cell span={3} style={{ padding: "3vw" }}>
          <h1
            style={{
              fontSize: "5vw",
              fontWeight: 400,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              lineHeight: 1.1,
            }}
          >
            ACTIVE
            <br />
            SIMULATIONS
          </h1>
          <div style={{ marginTop: "4vw", maxWidth: "40vw" }}>
            <p className="label">01 / DASHBOARD</p>
            <p className="footnote" style={{ marginTop: "1vw" }}>
              Monitor and manage running network lab instances. Deploy new
              simulations from topology templates or create custom environments.
            </p>
          </div>
        </Cell>
        <Cell
          style={{
            background:
              "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)",
          }}
        />

        {/* Stats */}
        <StatCell label="LABS RUNNING" value={runningLabs} />
        <StatCell label="TOTAL LABS" value={labs.length} />
        <StatCell label="ACTIVE NODES" value={activeNodes} dark />
        <StatCell
          label="WORKERS ONLINE"
          value={user?.isAdmin ? onlineWorkers : "—"}
        />

        {/* Lab cards */}
        {labs.length > 0 ? (
          <div
            style={{
              gridColumn: "span 4",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1px",
              backgroundColor: "#0A0A0A",
            }}
          >
            {labs.slice(0, 8).map((lab) => (
              <LabCard key={lab.uuid} lab={lab} />
            ))}
            {/* pad empty cells */}
            {labs.length < 4 &&
              Array.from({ length: 4 - Math.min(labs.length, 4) }).map(
                (_, i) => <Cell key={`empty-${i}`} style={{ minHeight: 160 }} />
              )}
          </div>
        ) : (
          <Cell span={4} style={{ padding: "3rem", alignItems: "center" }}>
            <p className="footnote" style={{ opacity: 0.4 }}>
              No labs found. Create one from a topology template.
            </p>
          </Cell>
        )}

        {/* Quick actions */}
        <div
          style={{
            gridColumn: "span 4",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px",
            backgroundColor: "#0A0A0A",
          }}
        >
          <Cell style={{ padding: "1.5rem" }}>
            <ArrowButton
              label="Browse Topologies"
              onClick={() => router.push("/topologies")}
            />
          </Cell>
          <Cell style={{ padding: "1.5rem" }}>
            <ArrowButton
              label="Manage Collections"
              onClick={() => router.push("/collections")}
            />
          </Cell>
          <Cell style={{ padding: "1.5rem" }}>
            <ArrowButton
              label={user?.isAdmin ? "Admin Panel" : "API Reference"}
              onClick={() =>
                router.push(user?.isAdmin ? "/admin/workers" : "/docs")
              }
            />
          </Cell>
        </div>

        <Footer />
      </SchematicGrid>
    </div>
  );
}
