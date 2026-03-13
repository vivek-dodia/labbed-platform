import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

const customStyles = {
  root: {
    '--bg-color': '#F2F2F2',
    '--line-color': '#0A0A0A',
    '--text-color': '#0A0A0A',
    '--grad-vertical': 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
    '--font-main': "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  body: {
    backgroundColor: '#0A0A0A',
    color: '#0A0A0A',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    WebkitFontSmoothing: 'antialiased',
    overflowX: 'hidden',
    padding: '1px',
    minHeight: '100vh',
  },
  schematicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1px',
    backgroundColor: '#0A0A0A',
    minHeight: '100vh',
    width: '100%',
  },
  cell: {
    backgroundColor: '#F2F2F2',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  padLg: { padding: '3vw' },
  padMd: { padding: '1.5vw' },
  padSm: { padding: '1vw' },
  h1: {
    fontSize: '4vw',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.1,
    margin: 0,
    padding: 0,
  },
  h2: {
    fontSize: '1.8vw',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: 0,
    padding: 0,
  },
  label: {
    fontSize: '1.1vw',
    fontWeight: 400,
    textTransform: 'uppercase',
  },
  footnote: {
    fontSize: '0.8vw',
    lineHeight: 1.4,
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
  navActive: {
    fontStyle: 'italic',
    textDecoration: 'underline',
  },
  statusIndicator: {
    width: '2.5vw',
    height: '2.5vw',
    border: '1px solid #0A0A0A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1vw',
    fontSize: '1vw',
  },
  statusPass: {
    background: '#0A0A0A',
    color: '#F2F2F2',
  },
  latencyChart: {
    width: '100%',
    height: '120px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
    marginTop: '2vw',
  },
  latencyBar: {
    flex: 1,
    background: '#0A0A0A',
    minHeight: '2px',
  },
  topoDiffContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1px',
    background: '#0A0A0A',
    height: '100%',
  },
  diffPanel: {
    backgroundColor: '#F2F2F2',
    padding: '1.5vw',
    display: 'flex',
    flexDirection: 'column',
  },
  geoSchematic: {
    border: '1px solid #0A0A0A',
    aspectRatio: '1',
    margin: '1vw 0',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCircle: {
    width: '1.5vw',
    height: '1.5vw',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    position: 'absolute',
  },
  diffLine: {
    position: 'absolute',
    height: '1px',
    background: '#0A0A0A',
    transformOrigin: 'left center',
  },
  tag: {
    border: '1px solid #0A0A0A',
    padding: '0.2vw 0.5vw',
    fontSize: '0.7vw',
    display: 'inline-block',
    marginBottom: '0.5vw',
  },
  btnCell: {
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
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
          float noise = random(gl_FragCoord.xy);
          gl_FragColor = vec4(0.0, 0.0, 0.0, noise * 0.2);
      }
    `;

    function createShader(gl, type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.useProgram(program);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
        mixBlendMode: 'multiply',
        opacity: 0.6,
      }}
    />
  );
};

const Header = ({ onReturnToHub }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={customStyles.headerCell}>
      <div style={customStyles.headerInner}>
        <span style={customStyles.label}>LABBED</span>
      </div>
      <div style={customStyles.headerInner}>
        <span style={{ ...customStyles.label, ...customStyles.navActive }}>(Simulation)</span>
      </div>
      <div style={customStyles.headerInner}>
        <span style={customStyles.label}>(Integrity Reports)</span>
      </div>
      <div
        style={{
          ...customStyles.headerInner,
          ...customStyles.btnCell,
          backgroundColor: hovered ? '#0A0A0A' : '#F2F2F2',
          color: hovered ? '#F2F2F2' : '#0A0A0A',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onReturnToHub}
      >
        <span style={customStyles.label}>(Return to Hub)</span>
      </div>
    </div>
  );
};

const TestCell = ({ tag, status, label, detail }) => {
  return (
    <div style={{ ...customStyles.cell, ...customStyles.padMd }}>
      <div style={customStyles.tag}>{tag}</div>
      <div
        style={{
          ...customStyles.statusIndicator,
          ...(status === 'P' ? customStyles.statusPass : {}),
        }}
      >
        {status}
      </div>
      <span style={customStyles.label}>{label}</span>
      <div style={{ ...customStyles.footnote, marginTop: '1vw' }}>{detail}</div>
    </div>
  );
};

const LatencyChartCell = () => {
  const bars = [20, 35, 30, 55, 80, 45, 90, 60, 25, 10, 30, 70, 85, 40, 20];
  return (
    <div style={{ ...customStyles.cell, ...customStyles.padMd, gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={customStyles.label}>(Packet Flow Analysis)</span>
        <span style={customStyles.footnote}>Nodes 01-24 Trace</span>
      </div>
      <div style={customStyles.latencyChart}>
        {bars.map((h, i) => (
          <div key={i} style={{ ...customStyles.latencyBar, height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
};

const TopologyDiff = () => {
  return (
    <div style={{ ...customStyles.cell, gridColumn: 'span 4' }}>
      <div style={customStyles.topoDiffContainer}>
        <div style={customStyles.diffPanel}>
          <span style={customStyles.label}>(A) Baseline Config</span>
          <div style={customStyles.geoSchematic}>
            <div style={{ ...customStyles.nodeCircle, top: '20%', left: '20%' }} />
            <div style={{ ...customStyles.nodeCircle, top: '20%', right: '20%' }} />
            <div style={{ ...customStyles.nodeCircle, bottom: '20%', left: '20%' }} />
            <div style={{ ...customStyles.nodeCircle, bottom: '20%', right: '20%' }} />
            <div style={{ ...customStyles.diffLine, width: '50%', top: '28%', left: '25%' }} />
            <div style={{ ...customStyles.diffLine, width: '50%', bottom: '28%', left: '25%' }} />
          </div>
          <div style={customStyles.footnote}>
            L2/L3 Standard Meshing.<br />No redundancy enabled.
          </div>
        </div>
        <div style={{ ...customStyles.diffPanel, borderLeft: '1px solid #0A0A0A' }}>
          <span style={customStyles.label}>(B) Optimized Topology</span>
          <div style={customStyles.geoSchematic}>
            <div style={{ ...customStyles.nodeCircle, top: '20%', left: '20%' }} />
            <div style={{ ...customStyles.nodeCircle, top: '20%', right: '20%' }} />
            <div style={{ ...customStyles.nodeCircle, bottom: '20%', left: '20%' }} />
            <div style={{ ...customStyles.nodeCircle, bottom: '20%', right: '20%' }} />
            <div
              style={{
                ...customStyles.nodeCircle,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#0A0A0A',
              }}
            />
            <div style={{ ...customStyles.diffLine, width: '50%', top: '28%', left: '25%' }} />
            <div style={{ ...customStyles.diffLine, width: '50%', bottom: '28%', left: '25%' }} />
            <div
              style={{
                ...customStyles.diffLine,
                width: '40%',
                top: '25%',
                left: '25%',
                transform: 'rotate(45deg)',
              }}
            />
            <div
              style={{
                ...customStyles.diffLine,
                width: '40%',
                top: '25%',
                right: '25%',
                transform: 'rotate(135deg)',
              }}
            />
          </div>
          <div style={customStyles.footnote}>
            Star-Mesh Hybrid.<br />Central routing node introduced (+1).
          </div>
        </div>
      </div>
    </div>
  );
};

const BGPRibCell = () => {
  const entries = [
    { route: '10.0.0.1/32 [110/2]', status: 'OK', border: true },
    { route: '172.16.0.0/16 [20/0]', status: 'OK', border: true },
    { route: '192.168.1.0/24 [*]', status: 'DROPPED', border: true },
    { route: '0.0.0.0/0 [1/0]', status: 'OK', border: false },
  ];
  return (
    <div style={{ ...customStyles.cell, ...customStyles.padMd }}>
      <span style={customStyles.label}>(BGP Rib Entries)</span>
      <div style={{ marginTop: '1vw' }}>
        {entries.map((entry, i) => (
          <div
            key={i}
            style={{
              ...customStyles.footnote,
              borderBottom: entry.border ? '1px solid #0A0A0A' : 'none',
              padding: '0.5vw 0',
            }}
          >
            {entry.route} - {entry.status}
          </div>
        ))}
      </div>
    </div>
  );
};

const IntegrityScoreCell = () => {
  return (
    <div style={{ ...customStyles.cell, ...customStyles.padMd, gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h2 style={customStyles.h2}>Integrity Score: 88.4</h2>
        <div style={{ width: '100%', marginTop: '2vw' }}>
          <svg viewBox="0 0 400 20" preserveAspectRatio="none" style={{ width: '100%' }}>
            <line x1="0" y1="10" x2="390" y2="10" stroke="black" strokeWidth="1" />
            <polygon points="385,5 400,10 385,15" fill="black" />
            <rect x="0" y="5" width="350" height="10" fill="black" />
          </svg>
        </div>
        <div style={{ ...customStyles.footnote, marginTop: '1vw' }}>
          Simulation validated against IEEE 802.1Q specs. No packet leaks detected.
        </div>
      </div>
    </div>
  );
};

const SimulationPage = ({ onReturnToHub }) => {
  return (
    <div style={customStyles.schematicGrid}>
      <Header onReturnToHub={onReturnToHub} />

      <div
        style={{
          ...customStyles.cell,
          ...customStyles.padLg,
          gridColumn: 'span 4',
          borderBottom: '1px solid #0A0A0A',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={customStyles.h1}>SIMULATION REPORT: 0x8F2</h1>
          <span style={customStyles.label}>ID: 992-ALPHA-DELTA</span>
        </div>
      </div>

      <TestCell
        tag="TEST_A: CONVERGENCE"
        status="P"
        label="Protocol Sync"
        detail={
          <>
            OSPF state full on all 12 nodes.<br />
            Convergence time: 142ms.
          </>
        }
      />
      <TestCell
        tag="TEST_B: LATENCY"
        status="F"
        label="Jitter Variance"
        detail={
          <>
            Spike detected in Segment C.<br />
            Deviation: +42.4%.
          </>
        }
      />
      <LatencyChartCell />

      <TopologyDiff />

      <div
        style={{
          ...customStyles.cell,
          ...customStyles.padMd,
          background: 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
        }}
      />
      <BGPRibCell />
      <IntegrityScoreCell />

      <div
        style={{
          ...customStyles.cell,
          ...customStyles.padSm,
          gridColumn: 'span 4',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          minHeight: '8vw',
        }}
      >
        <div style={customStyles.footnote}>
          Report Generated: 2024.05.21 // 14:22:01 UTC<br />
          Data Density: 4.2 MB/s // Telemetry active
        </div>
        <div style={{ ...customStyles.footnote, textAlign: 'right' }}>
          (Sim.Engine) v2.4.1<br />
          Verification: [SIGNED_HASH_SHA256]
        </div>
      </div>
    </div>
  );
};

const HubPage = ({ onNavigate }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={customStyles.schematicGrid}>
      <div style={customStyles.headerCell}>
        <div style={customStyles.headerInner}>
          <span style={customStyles.label}>LABBED</span>
        </div>
        <div style={customStyles.headerInner}>
          <span style={customStyles.label}>(Hub)</span>
        </div>
        <div style={customStyles.headerInner}>
          <span style={customStyles.label}>(Projects)</span>
        </div>
        <div style={customStyles.headerInner}>
          <span style={customStyles.label}>(Settings)</span>
        </div>
      </div>
      <div
        style={{
          ...customStyles.cell,
          ...customStyles.padLg,
          gridColumn: 'span 4',
          borderBottom: '1px solid #0A0A0A',
        }}
      >
        <h1 style={customStyles.h1}>LABBED HUB</h1>
      </div>
      <div
        style={{
          ...customStyles.cell,
          ...customStyles.padMd,
          gridColumn: 'span 2',
          cursor: 'pointer',
          backgroundColor: hovered ? '#0A0A0A' : '#F2F2F2',
          color: hovered ? '#F2F2F2' : '#0A0A0A',
          transition: 'all 0.2s',
          minHeight: '20vw',
          justifyContent: 'center',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onNavigate}
      >
        <div style={customStyles.tag}>SIMULATION_REPORT</div>
        <h2 style={{ ...customStyles.h2, marginTop: '1vw' }}>Report 0x8F2</h2>
        <div style={{ ...customStyles.footnote, marginTop: '1vw' }}>Click to view simulation results.</div>
      </div>
      <div style={{ ...customStyles.cell, ...customStyles.padMd, gridColumn: 'span 2', minHeight: '20vw' }}>
        <div style={customStyles.tag}>INTEGRITY_REPORT</div>
        <h2 style={{ ...customStyles.h2, marginTop: '1vw' }}>Report 0x4A1</h2>
        <div style={{ ...customStyles.footnote, marginTop: '1vw' }}>Pending analysis.</div>
      </div>
      <div style={{ ...customStyles.cell, ...customStyles.padSm, gridColumn: 'span 4', minHeight: '6vw', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={customStyles.footnote}>System Status: NOMINAL</div>
        <div style={{ ...customStyles.footnote, textAlign: 'right' }}>(Labbed) v1.0.0</div>
      </div>
    </div>
  );
};

const App = () => {
  const [view, setView] = useState('simulation');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { overflow-x: hidden; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={customStyles.body}>
      <NoiseCanvas />
      {view === 'hub' ? (
        <HubPage onNavigate={() => setView('simulation')} />
      ) : (
        <SimulationPage onReturnToHub={() => setView('hub')} />
      )}
    </div>
  );
};

export default App;