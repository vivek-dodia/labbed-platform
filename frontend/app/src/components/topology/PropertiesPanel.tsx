import type { ParsedNode } from "@/lib/yaml-parser";

interface Props {
  node: ParsedNode | null;
}

export default function PropertiesPanel({ node }: Props) {
  if (!node) {
    return (
      <div style={{ padding: "2rem", opacity: 0.4 }}>
        <span className="label">SELECT A NODE</span>
        <p className="footnote" style={{ marginTop: "0.5rem" }}>
          Click a node on the canvas to view its properties.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <span className="label" style={{ fontSize: "0.65rem", opacity: 0.5 }}>
        NODE PROPERTIES
      </span>

      <div style={{ marginTop: "1.5rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span className="label" style={{ fontSize: "0.6rem" }}>
            NAME
          </span>
          <p style={{ fontSize: "1.2rem", fontWeight: 400 }}>{node.name}</p>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <span className="label" style={{ fontSize: "0.6rem" }}>
            KIND
          </span>
          <p className="mono" style={{ fontSize: "0.9rem" }}>
            {node.kind}
          </p>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <span className="label" style={{ fontSize: "0.6rem" }}>
            IMAGE
          </span>
          <p className="mono" style={{ fontSize: "0.9rem" }}>
            {node.image}
          </p>
        </div>

        {node.interfaces.length > 0 && (
          <div>
            <span className="label" style={{ fontSize: "0.6rem" }}>
              INTERFACES
            </span>
            {node.interfaces.map((iface) => (
              <p
                key={iface}
                className="mono"
                style={{
                  fontSize: "0.8rem",
                  padding: "0.3rem 0",
                  borderBottom: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                {iface}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
