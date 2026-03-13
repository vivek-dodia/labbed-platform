import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

const customStyles = {
  root: {
    '--bg-color': '#F2F2F2',
    '--line-color': '#0A0A0A',
    '--text-color': '#0A0A0A',
    '--grad-horizontal': 'linear-gradient(90deg, #d3cadd 0%, #e2a088 35%, #f4601d 65%, #206d39 100%)',
    '--grad-vertical': 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
  },
  schematicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1px',
    backgroundColor: '#0A0A0A',
    minHeight: '100vh',
    width: '100%',
  },
  headerCell: {
    gridColumn: 'span 4',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '1px',
    backgroundColor: '#0A0A0A',
  },
  headerInner: {
    backgroundColor: '#F2F2F2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1vw 1.5vw',
  },
  headerInnerDark: {
    backgroundColor: '#0A0A0A',
    color: '#F2F2F2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1vw 1.5vw',
  },
  cell: {
    backgroundColor: '#F2F2F2',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  gradVStrip: {
    background: 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
    width: '100%',
    height: '100%',
  },
  gradHStrip: {
    background: 'linear-gradient(90deg, #d3cadd 0%, #e2a088 35%, #f4601d 65%, #206d39 100%)',
    width: '100%',
    height: '4vw',
    gridColumn: 'span 4',
  },
  h1: {
    fontSize: '5vw',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.1,
  },
  h2: {
    fontSize: '1.8vw',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  label: {
    fontSize: '1.2vw',
    fontWeight: 400,
  },
  footnote: {
    fontSize: '0.85vw',
    lineHeight: 1.4,
  },
  arrowIcon: {
    width: '1.2vw',
    height: '1.2vw',
  },
  geoCircleOutline: {
    width: '4vw',
    aspectRatio: '1',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoInnerDot: {
    width: '10%',
    height: '10%',
    background: '#0A0A0A',
    borderRadius: '50%',
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
    const fsSource = `precision highp float; uniform vec2 resolution; float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); } void main() { float noise = random(gl_FragCoord.xy); gl_FragColor = vec4(0.0, 0.0, 0.0, noise * 0.2); }`;

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

const ArrowRight = () => (
  <svg style={customStyles.arrowIcon} viewBox="0 0 10 10">
    <polygon points="0,0 10,5 0,10" fill="black" />
  </svg>
);

const NavItem = ({ children }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: hovered ? '0.8vw 0 0.8vw 0.5vw' : '0.8vw 0',
        borderBottom: '0.5px solid rgba(10,10,10,0.2)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s',
        background: hovered ? 'rgba(0,0,0,0.03)' : 'transparent',
        fontSize: '0.85vw',
        lineHeight: 1.4,
      }}
    >
      {children}
    </a>
  );
};

const SectionCard = ({ number, title, items, footer }) => (
  <div style={{ ...customStyles.cell, ...{ padding: '1.5vw' } }}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <span style={customStyles.label}>{number}</span>
      <h2 style={{ ...customStyles.h2, margin: '1vw 0' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, i) => (
          <NavItem key={i}>
            <span>{item}</span>
            <ArrowRight />
          </NavItem>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: '2vw' }}>
        {footer}
      </div>
    </div>
  </div>
);

const HomePage = () => {
  const navigate = useNavigate();
  const [btnHovered, setBtnHovered] = React.useState(false);
  const [loginHovered, setLoginHovered] = React.useState(false);

  return (
    <div
      style={{
        backgroundColor: '#0A0A0A',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        padding: '1px',
        overflowX: 'hidden',
        minHeight: '100vh',
      }}
    >
      <NoiseCanvas />
      <div style={customStyles.schematicGrid}>

        {/* Header */}
        <div style={customStyles.headerCell}>
          <div
            style={{
              ...customStyles.headerInner,
              backgroundColor: btnHovered ? '#0A0A0A' : '#F2F2F2',
              color: btnHovered ? '#F2F2F2' : '#0A0A0A',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            onClick={() => navigate('/')}
          >
            <span style={customStyles.label}>LABBED</span>
          </div>
          <div style={customStyles.headerInner}>
            <span style={customStyles.label}>(Platform)</span>
          </div>
          <div style={customStyles.headerInnerDark}>
            <span style={customStyles.label}>(Documentation)</span>
          </div>
          <div
            style={{
              ...customStyles.headerInner,
              backgroundColor: loginHovered ? '#0A0A0A' : '#F2F2F2',
              color: loginHovered ? '#F2F2F2' : '#0A0A0A',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={() => setLoginHovered(true)}
            onMouseLeave={() => setLoginHovered(false)}
          >
            <span style={customStyles.label}>(Login)</span>
            <svg style={customStyles.arrowIcon} viewBox="0 0 20 10">
              <line x1="0" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth="1" />
              <polygon points="16,2 20,5 16,8" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Hero Section */}
        <div
          style={{
            ...customStyles.cell,
            gridColumn: 'span 3',
            borderBottom: '1px solid #0A0A0A',
            padding: '3vw',
          }}
        >
          <h1 style={customStyles.h1}>
            SYSTEM<br />INDEX
          </h1>
          <div style={{ marginTop: '2vw', width: '40%' }}>
            <span style={customStyles.footnote}>
              v.2.4.0 Technical manual for the orchestration of virtualized network topologies and stateful simulation environments.
            </span>
          </div>
        </div>

        <div style={{ ...customStyles.cell, gridColumn: 'span 1' }}>
          <div style={customStyles.gradVStrip} />
        </div>

        {/* Section 01: Configuration */}
        <SectionCard
          number="01"
          title="CONFIGURATION"
          items={['Topology Schema', 'Node Parameters', 'YAML Validation']}
          footer={
            <div style={customStyles.geoCircleOutline}>
              <div style={customStyles.geoInnerDot} />
            </div>
          }
        />

        {/* Section 02: Simulation */}
        <SectionCard
          number="02"
          title="SIMULATION"
          items={['Integrity Tests', 'Traffic Generators', 'Latency Injection']}
          footer={
            <div style={{ display: 'flex', gap: '0.5vw' }}>
              <div style={{ width: '1vw', height: '1vw', background: '#0A0A0A', borderRadius: '50%' }} />
              <div style={{ width: '1vw', height: '1vw', border: '1px solid #0A0A0A', borderRadius: '50%' }} />
              <div style={{ width: '1vw', height: '1vw', border: '1px solid #0A0A0A', borderRadius: '50%' }} />
            </div>
          }
        />

        {/* Section 03: Deployment */}
        <SectionCard
          number="03"
          title="DEPLOYMENT"
          items={['Live State Sync', 'Container Runtime', 'Failover Logic']}
          footer={
            <svg width="4vw" height="2vw">
              <line x1="0" y1="10" x2="100" y2="10" stroke="black" strokeWidth="1" />
              <polygon points="35,5 45,10 35,15" fill="black" />
            </svg>
          }
        />

        {/* Section 04: API Reference */}
        <SectionCard
          number="04"
          title="API REFERENCE"
          items={['Authentication', 'Endpoints Index', 'Webhooks']}
          footer={
            <div
              style={{
                height: '3vw',
                border: '1px solid #0A0A0A',
                width: '100%',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '30%',
                  background: '#0A0A0A',
                }}
              />
            </div>
          }
        />

        {/* Gradient horizontal strip */}
        <div style={customStyles.gradHStrip} />

        {/* Footer Left */}
        <div
          style={{
            ...customStyles.cell,
            gridColumn: 'span 2',
            padding: '1vw',
          }}
        >
          <div style={customStyles.footnote}>
            SECTION: INDEX_ROOT<br />
            STATUS: SYNCHRONIZED [OK]<br />
            LAST MODIFIED: 2024.05.12
          </div>
        </div>

        {/* Footer Right */}
        <div
          style={{
            ...customStyles.cell,
            gridColumn: 'span 2',
            padding: '1vw',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ ...customStyles.footnote, textAlign: 'right' }}>
            LABBED DOCUMENTATION SYSTEM<br />
            ENCRYPTED ACCESS ONLY
          </div>
        </div>

      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </Router>
  );
};

export default App;