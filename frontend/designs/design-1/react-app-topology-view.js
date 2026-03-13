import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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
    overflow: 'hidden',
    padding: '1px',
    height: '100vh',
    width: '100vw',
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    gridTemplateRows: 'auto 1fr auto',
    gap: '1px',
    height: '100%',
    backgroundColor: '#0A0A0A',
  },
  header: {
    gridColumn: 'span 2',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '1px',
    background: '#0A0A0A',
  },
  headerInner: {
    background: '#F2F2F2',
    padding: '1vw 1.5vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorCanvas: {
    position: 'relative',
    backgroundColor: '#F2F2F2',
    backgroundImage: 'radial-gradient(#0A0A0A 0.5px, transparent 0.5px)',
    backgroundSize: '30px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  node: {
    position: 'absolute',
    width: '80px',
    height: '80px',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    background: '#F2F2F2',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'move',
    zIndex: 2,
    userSelect: 'none',
  },
  nodeActive: {
    position: 'absolute',
    width: '80px',
    height: '80px',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    background: '#0A0A0A',
    color: '#F2F2F2',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'move',
    zIndex: 2,
    userSelect: 'none',
  },
  nodeLabel: {
    fontSize: '0.7vw',
    marginTop: '4px',
    textTransform: 'uppercase',
  },
  connectionSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    background: '#0A0A0A',
  },
  sideBlock: {
    background: '#F2F2F2',
    padding: '1.5vw',
    flexGrow: 1,
    position: 'relative',
  },
  sideBlockSmall: {
    background: '#F2F2F2',
    padding: '1vw 1.5vw',
    height: 'auto',
  },
  label: {
    fontSize: '0.9vw',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  headingSm: {
    fontSize: '1.2vw',
    textTransform: 'uppercase',
    marginBottom: '1.5vw',
  },
  paramRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '1vw',
    borderBottom: '1px solid rgba(0,0,0,0.1)',
    paddingBottom: '0.5vw',
  },
  paramValue: {
    fontFamily: 'monospace',
    fontSize: '1vw',
  },
  btnAction: {
    border: '1px solid #0A0A0A',
    padding: '0.8vw',
    textAlign: 'center',
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontSize: '0.8vw',
    transition: 'all 0.2s',
    marginTop: '1vw',
  },
  btnActionDark: {
    border: '1px solid #0A0A0A',
    padding: '0.8vw',
    textAlign: 'center',
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontSize: '0.8vw',
    transition: 'all 0.2s',
    marginTop: '1vw',
    background: 'black',
    color: 'white',
  },
  gradStrip: {
    height: '100%',
    width: '20px',
    background: 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  footer: {
    gridColumn: 'span 2',
    padding: '1vw 1.5vw',
    background: '#F2F2F2',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75vw',
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
};

const NoiseCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true });
    if (!gl) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
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

    const createShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(gl.getUniformLocation(program, 'resolution'), canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={customStyles.noiseCanvas} />;
};

const ParamRow = ({ label, value }) => (
  <div style={customStyles.paramRow}>
    <span style={customStyles.label}>{label}</span>
    <span style={customStyles.paramValue}>{value}</span>
  </div>
);

const HoverButton = ({ style, children, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const baseStyle = style || customStyles.btnAction;
  const hoveredStyle = {
    ...baseStyle,
    background: style && style.background === 'black' ? '#333' : '#0A0A0A',
    color: '#F2F2F2',
  };

  return (
    <div
      style={hovered ? hoveredStyle : baseStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

const initialNodes = [
  { id: 'GW-01', top: 260, left: 360, active: false, dot: { border: '1px solid black', background: 'transparent' } },
  { id: 'RTR-MAIN', top: 160, left: 560, active: true, dot: { background: 'white' } },
  { id: 'SRV-CLUSTER', top: 410, left: 760, active: false, dot: { border: '1px solid black', background: 'transparent' } },
  { id: 'DB-L01', top: 510, left: 360, active: false, dot: { border: '1px solid black', background: 'black' } },
];

const connections = [
  { x1: 400, y1: 300, x2: 600, y2: 200 },
  { x1: 600, y1: 200, x2: 800, y2: 450 },
  { x1: 400, y1: 300, x2: 400, y2: 550 },
];

const nodeProperties = {
  'GW-01': { id: 'GW-01', type: 'Gateway', os: 'vOS 10.2.0', cpu: '2', memory: '4GB', mtu: '1500', eth0: '10.0.1.1', eth1: '192.168.2.1' },
  'RTR-MAIN': { id: 'RTR-MAIN', type: 'Core Router', os: 'vOS 12.4.1', cpu: '4', memory: '8GB', mtu: '1500', eth0: '10.0.0.1', eth1: '192.168.1.1' },
  'SRV-CLUSTER': { id: 'SRV-CLUSTER', type: 'Server Cluster', os: 'vOS 14.1.0', cpu: '16', memory: '64GB', mtu: '9000', eth0: '10.0.2.1', eth1: '192.168.3.1' },
  'DB-L01': { id: 'DB-L01', type: 'Database Layer', os: 'vOS 11.8.3', cpu: '8', memory: '32GB', mtu: '1500', eth0: '10.0.3.1', eth1: '192.168.4.1' },
};

const TopologyPage = () => {
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedNode, setSelectedNode] = useState('RTR-MAIN');
  const [zoom] = useState(100);
  const [mouseXY, setMouseXY] = useState({ x: 560, y: 200 });
  const [deployStatus, setDeployStatus] = useState('idle');
  const draggingRef = useRef(null);
  const canvasRef = useRef(null);

  const handleNodeMouseDown = (e, nodeId) => {
    e.preventDefault();
    draggingRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
    };
    setSelectedNode(nodeId);
    setNodes(prev =>
      prev.map(n => ({ ...n, active: n.id === nodeId }))
    );
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseXY({ x: e.clientX, y: e.clientY });
      if (!draggingRef.current) return;
      const { nodeId, startX, startY } = draggingRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      draggingRef.current.startX = e.clientX;
      draggingRef.current.startY = e.clientY;
      setNodes(prev =>
        prev.map(n =>
          n.id === nodeId ? { ...n, left: n.left + dx, top: n.top + dy } : n
        )
      );
    };
    const handleMouseUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDeploy = () => {
    setDeployStatus('deploying');
    setTimeout(() => setDeployStatus('done'), 2000);
    setTimeout(() => setDeployStatus('idle'), 4000);
  };

  const props = nodeProperties[selectedNode] || nodeProperties['RTR-MAIN'];

  const getNodeCenter = (node) => ({
    x: node.left + 40,
    y: node.top + 40,
  });

  const computedConnections = (() => {
    const gw = nodes.find(n => n.id === 'GW-01');
    const rtr = nodes.find(n => n.id === 'RTR-MAIN');
    const srv = nodes.find(n => n.id === 'SRV-CLUSTER');
    const db = nodes.find(n => n.id === 'DB-L01');
    if (!gw || !rtr || !srv || !db) return connections;
    const gwC = getNodeCenter(gw);
    const rtrC = getNodeCenter(rtr);
    const srvC = getNodeCenter(srv);
    const dbC = getNodeCenter(db);
    return [
      { x1: gwC.x, y1: gwC.y, x2: rtrC.x, y2: rtrC.y },
      { x1: rtrC.x, y1: rtrC.y, x2: srvC.x, y2: srvC.y },
      { x1: gwC.x, y1: gwC.y, x2: dbC.x, y2: dbC.y },
    ];
  })();

  return (
    <div style={customStyles.body}>
      <NoiseCanvas />
      <div style={customStyles.layoutGrid}>
        <header style={customStyles.header}>
          <div style={customStyles.headerInner}>
            <span style={customStyles.label}>LABBED / TOPOLOGY</span>
          </div>
          <div style={customStyles.headerInner}>
            <span style={customStyles.label}>PROJECT: ALPHA_01</span>
          </div>
          <div style={customStyles.headerInner}>
            <span style={customStyles.label}>STATUS: SIMULATING</span>
          </div>
          <div style={{ ...customStyles.headerInner, cursor: 'pointer' }}>
            <span style={customStyles.label}>(Return to Dashboard)</span>
            <svg width="20" height="10" viewBox="0 0 20 10">
              <line x1="0" y1="5" x2="18" y2="5" stroke="black" />
              <polygon points="16,2 20,5 16,8" />
            </svg>
          </div>
        </header>

        <main style={customStyles.editorCanvas} ref={canvasRef}>
          <svg style={customStyles.connectionSvg}>
            {computedConnections.map((c, i) => (
              <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="black" strokeWidth="1" />
            ))}
          </svg>

          {nodes.map((node) => (
            <div
              key={node.id}
              style={{
                ...(node.active ? customStyles.nodeActive : customStyles.node),
                top: node.top + 'px',
                left: node.left + 'px',
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  ...node.dot,
                }}
              />
              <span style={customStyles.nodeLabel}>{node.id}</span>
            </div>
          ))}

          <div style={customStyles.gradStrip} />
        </main>

        <aside style={customStyles.sidebar}>
          <div style={customStyles.sideBlockSmall}>
            <h2 style={customStyles.headingSm}>Properties</h2>
            <ParamRow label="ID" value={props.id} />
            <ParamRow label="Type" value={props.type} />
            <ParamRow label="OS" value={props.os} />
          </div>

          <div style={customStyles.sideBlock}>
            <h2 style={customStyles.headingSm}>Configuration</h2>
            <ParamRow label="CPU Cores" value={props.cpu} />
            <ParamRow label="Memory" value={props.memory} />
            <ParamRow label="MTU" value={props.mtu} />

            <div style={{ marginTop: '2vw' }}>
              <span style={customStyles.label}>(Interfaces)</span>
              <HoverButton>eth0 — {props.eth0}</HoverButton>
              <HoverButton>eth1 — {props.eth1}</HoverButton>
            </div>

            <div style={{ position: 'absolute', bottom: '1.5vw', left: '1.5vw', right: '1.5vw' }}>
              <HoverButton
                style={customStyles.btnActionDark}
                onClick={handleDeploy}
              >
                {deployStatus === 'deploying' ? 'Deploying...' : deployStatus === 'done' ? 'Deployed ✓' : 'Deploy Changes'}
              </HoverButton>
            </div>
          </div>
        </aside>

        <footer style={customStyles.footer}>
          <div>
            Figure 02: <u>Logical Topology Mapping Tool v1.0.4</u>
          </div>
          <div>
            XY: {mouseXY.x}.{mouseXY.y} | Zoom: {zoom}% | Latency: 4ms
          </div>
        </footer>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<TopologyPage />} />
      </Routes>
    </Router>
  );
};

export default App;