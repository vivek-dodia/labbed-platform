import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

const customStyles = {
  root: {
    '--bg-color': '#F2F2F2',
    '--line-color': '#0A0A0A',
    '--text-color': '#0A0A0A',
  },
  body: {
    backgroundColor: '#0A0A0A',
    color: '#0A0A0A',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    WebkitFontSmoothing: 'antialiased',
    padding: '1px',
    overflowX: 'hidden',
    minHeight: '100vh',
  },
  noiseCanvas: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: 9999,
    mixBlendMode: 'multiply',
    opacity: 0.6,
  },
  schematicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1px',
    backgroundColor: '#0A0A0A',
    width: '100%',
  },
  cell: {
    backgroundColor: '#F2F2F2',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  headerCell: {
    gridColumn: 'span 4',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '1px',
    background: '#0A0A0A',
  },
  headerInner: {
    backgroundColor: '#F2F2F2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1vw 1.5vw',
  },
  dashboardHeader: {
    gridColumn: 'span 4',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F2',
    padding: '3vw',
  },
  h1: {
    fontSize: '5vw',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.1,
    margin: 0,
  },
  h2: {
    fontSize: '3vw',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: 0,
  },
  label: {
    fontSize: '1.1vw',
    fontWeight: 400,
    textTransform: 'uppercase',
  },
  footnote: {
    fontSize: '0.85vw',
    lineHeight: 1.4,
  },
  simCard: {
    height: '28vw',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F2',
    padding: '1vw',
  },
  cardVisual: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottom: '1px solid #0A0A0A',
    margin: '1vw -1vw 1vw -1vw',
  },
  geoNodeCluster: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    width: '60%',
    justifyContent: 'center',
  },
  nodeDot: {
    width: '0.8vw',
    height: '0.8vw',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
  },
  nodeDotActive: {
    width: '0.8vw',
    height: '0.8vw',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    background: '#0A0A0A',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5vw',
  },
  gradStrip: {
    height: '4vw',
    width: '100%',
    marginTop: '1vw',
  },
  topologyIcon: {
    width: '80%',
    height: '60%',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    position: 'relative',
  },
};

const gradHorizontal = 'linear-gradient(90deg, #d3cadd 0%, #e2a088 35%, #f4601d 65%, #206d39 100%)';
const gradVertical = 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)';

const LivePulse = ({ color }) => {
  return (
    <div
      className="live-pulse"
      style={{
        width: '8px',
        height: '8px',
        background: color || '#0A0A0A',
        borderRadius: '50%',
        animation: 'labbed-pulse 2s infinite',
      }}
    />
  );
};

const NoiseCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true });
    if (!gl) return;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    const vsSource = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const fsSource = `
      precision highp float;
      uniform vec2 resolution;
      float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
      void main() {
        float noise = random(gl_FragCoord.xy + fract(1.0));
        gl_FragColor = vec4(0.0, 0.0, 0.0, noise * 0.15);
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={customStyles.noiseCanvas} />;
};

const SimCard01 = () => {
  const nodes = [
    { active: true }, { active: true }, { active: false }, { active: true },
    { active: false }, { active: true }, { active: true }, { active: false },
  ];

  return (
    <div style={customStyles.simCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={customStyles.label}>01 / Edge_Alpha</span>
        <div style={customStyles.statusIndicator}>
          <LivePulse />
          <span style={customStyles.footnote}>LIVE</span>
        </div>
      </div>
      <div style={customStyles.cardVisual}>
        <div style={customStyles.geoNodeCluster}>
          {nodes.map((n, i) => (
            <div key={i} style={n.active ? customStyles.nodeDotActive : customStyles.nodeDot} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={customStyles.footnote}>Nodes: 64 / Virtualized</span>
        <div style={{ ...customStyles.gradStrip, background: gradHorizontal, opacity: 0.8 }} />
      </div>
    </div>
  );
};

const SimCard02 = () => {
  return (
    <div style={customStyles.simCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={customStyles.label}>02 / Core_Backbone</span>
        <div style={customStyles.statusIndicator}>
          <LivePulse color="#ccc" />
          <span style={customStyles.footnote}>STAGED</span>
        </div>
      </div>
      <div style={customStyles.cardVisual}>
        <div style={customStyles.topologyIcon} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={customStyles.footnote}>Nodes: 128 / Multi-tenant</span>
        <div style={{ ...customStyles.gradStrip, background: gradVertical, opacity: 0.8 }} />
      </div>
    </div>
  );
};

const SimCard03 = () => {
  return (
    <div style={customStyles.simCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={customStyles.label}>03 / Latency_Test</span>
        <div style={customStyles.statusIndicator}>
          <LivePulse />
          <span style={customStyles.footnote}>RUNNING</span>
        </div>
      </div>
      <div style={customStyles.cardVisual}>
        <div style={{ width: '40%', height: '40%', border: '1px solid #0A0A0A', borderRadius: '50%' }} />
        <div style={{ width: '20%', height: '20%', background: '#0A0A0A', borderRadius: '50%', position: 'absolute' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={customStyles.footnote}>Nodes: 12 / High-perf</span>
        <div style={{ ...customStyles.gradStrip, background: 'linear-gradient(90deg, #206d39, #f4601d)', opacity: 0.8 }} />
      </div>
    </div>
  );
};

const SimCard04 = ({ onClick, hovered, onMouseEnter, onMouseLeave }) => {
  return (
    <div
      style={{
        ...customStyles.simCard,
        cursor: 'pointer',
        backgroundColor: hovered ? '#0A0A0A' : '#F2F2F2',
        color: hovered ? '#F2F2F2' : '#0A0A0A',
        transition: 'background 0.2s, color 0.2s',
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={customStyles.label}>04 / New_Topology</span>
        <span style={customStyles.label}>+</span>
      </div>
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          border: `1px dashed ${hovered ? '#F2F2F2' : '#0A0A0A'}`,
          margin: '1vw 0',
          transition: 'border-color 0.2s',
        }}
      >
        <span style={customStyles.label}>(Initialize)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={customStyles.footnote}>Select blueprint to begin</span>
        <div style={{ ...customStyles.gradStrip, background: '#e0e0e0' }} />
      </div>
    </div>
  );
};

const InitializeModal = ({ onClose }) => {
  const blueprints = ['Edge Mesh', 'Star Topology', 'Ring Network', 'Hybrid Cloud'];
  const [selected, setSelected] = useState(null);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(10,10,10,0.8)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#F2F2F2',
          border: '1px solid #0A0A0A',
          padding: '3vw',
          minWidth: '30vw',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2vw' }}>
          <span style={customStyles.label}>Select Blueprint</span>
          <span
            style={{ ...customStyles.label, cursor: 'pointer' }}
            onClick={onClose}
          >
            ✕
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1vw' }}>
          {blueprints.map((bp) => (
            <div
              key={bp}
              style={{
                padding: '1vw',
                border: `1px solid #0A0A0A`,
                cursor: 'pointer',
                backgroundColor: selected === bp ? '#0A0A0A' : '#F2F2F2',
                color: selected === bp ? '#F2F2F2' : '#0A0A0A',
                transition: 'background 0.2s, color 0.2s',
                fontSize: '1.1vw',
                textTransform: 'uppercase',
              }}
              onClick={() => setSelected(bp)}
            >
              {bp}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: '2vw',
            padding: '1vw',
            border: '1px solid #0A0A0A',
            cursor: 'pointer',
            textAlign: 'center',
            fontSize: '1.1vw',
            textTransform: 'uppercase',
            backgroundColor: selected ? '#0A0A0A' : '#e0e0e0',
            color: selected ? '#F2F2F2' : '#999',
            transition: 'background 0.2s',
          }}
          onClick={() => { if (selected) onClose(); }}
        >
          {selected ? `Initialize ${selected}` : 'Select a blueprint'}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [card04Hovered, setCard04Hovered] = useState(false);
  const [headerHomeHovered, setHeaderHomeHovered] = useState(false);
  const [headerLogoutHovered, setHeaderLogoutHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes labbed-pulse {
        0% { opacity: 1; }
        50% { opacity: 0.3; }
        100% { opacity: 1; }
      }
      body {
        margin: 0;
        padding: 0;
        background-color: #0A0A0A;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={customStyles.body}>
      <NoiseCanvas />

      {showModal && <InitializeModal onClose={() => setShowModal(false)} />}

      <div style={customStyles.schematicGrid}>

        {/* Header */}
        <div style={customStyles.headerCell}>
          <div style={customStyles.headerInner}>
            <span style={customStyles.label}>LABBED</span>
          </div>
          <div
            style={{
              ...customStyles.headerInner,
              cursor: 'pointer',
              backgroundColor: headerHomeHovered ? '#0A0A0A' : '#F2F2F2',
              color: headerHomeHovered ? '#F2F2F2' : '#0A0A0A',
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseEnter={() => setHeaderHomeHovered(true)}
            onMouseLeave={() => setHeaderHomeHovered(false)}
          >
            <span style={customStyles.label}>← (Home)</span>
          </div>
          <div style={customStyles.headerInner}>
            <span style={customStyles.label}>(Active Sessions: 04)</span>
          </div>
          <div
            style={{
              ...customStyles.headerInner,
              cursor: 'pointer',
              backgroundColor: headerLogoutHovered ? '#0A0A0A' : '#F2F2F2',
              color: headerLogoutHovered ? '#F2F2F2' : '#0A0A0A',
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseEnter={() => setHeaderLogoutHovered(true)}
            onMouseLeave={() => setHeaderLogoutHovered(false)}
          >
            <span style={customStyles.label}>(Logout)</span>
            <svg width="15" height="15" viewBox="0 0 15 15">
              <line x1="2" y1="13" x2="13" y2="2" stroke="currentColor" strokeWidth="1" />
              <polygon points="8,1 14,1 14,7" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Dashboard Header */}
        <div style={customStyles.dashboardHeader}>
          <h1 style={customStyles.h1}>ACTIVE SIMULATIONS</h1>
          <div style={{ textAlign: 'right' }}>
            <span style={customStyles.label}>System Load: 14%</span>
            <br />
            <span style={customStyles.footnote}>Global Node Distribution: Operational</span>
          </div>
        </div>

        {/* Sim Card 01 */}
        <SimCard01 />

        {/* Sim Card 02 */}
        <SimCard02 />

        {/* Sim Card 03 */}
        <SimCard03 />

        {/* Sim Card 04 */}
        <SimCard04
          onClick={() => setShowModal(true)}
          hovered={card04Hovered}
          onMouseEnter={() => setCard04Hovered(true)}
          onMouseLeave={() => setCard04Hovered(false)}
        />

        {/* Telemetry Stream */}
        <div
          style={{
            ...customStyles.cell,
            gridColumn: 'span 2',
            height: '12vw',
            padding: '1.5vw',
          }}
        >
          <span style={customStyles.label}>(Telemetry Stream)</span>
          <div style={{ ...customStyles.footnote, marginTop: '1vw', fontFamily: 'monospace' }}>
            [14:22:01] Edge_Alpha: Packet loss 0.002%<br />
            [14:22:04] Core_Backbone: Snapshot synchronization complete<br />
            [14:22:09] Latency_Test: Jitter threshold exceeded on Node_04
          </div>
        </div>

        {/* Network Health Index */}
        <div
          style={{
            ...customStyles.cell,
            gridColumn: 'span 2',
            height: '12vw',
            background: gradHorizontal,
            padding: '1.5vw',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', color: 'white' }}>
            <span style={customStyles.label}>Network Health Index</span>
            <h2 style={customStyles.h2}>99.84%</h2>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            ...customStyles.cell,
            gridColumn: 'span 4',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            minHeight: '6vw',
            padding: '1vw',
          }}
        >
          <div style={customStyles.footnote}>
            Status: <u>All Systems Nominal</u><br />
            Cluster ID: LAB-992-PX
          </div>
          <div style={{ ...customStyles.footnote, textAlign: 'right' }}>
            Last Sync: 2024.05.22 14:22:11 UTC<br />
            User: admin_root
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;