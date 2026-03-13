import React, { useState, useEffect, useRef } from 'react';

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
    minHeight: '100vh',
  },
  cell: {
    backgroundColor: '#F2F2F2',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  padLg: { padding: '3vw' },
  padMd: { padding: '1.5vw' },
  padSm: { padding: '1vw' },
  h1: { fontSize: '5vw', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.1 },
  h2: { fontSize: '2vw', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.05em' },
  label: { fontSize: '1.1vw', textTransform: 'uppercase', letterSpacing: '0.02em' },
  footnote: { fontSize: '0.85vw', lineHeight: 1.4 },
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
  headerInnerDark: {
    backgroundColor: '#0A0A0A',
    color: '#F2F2F2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1vw 1.5vw',
  },
  heroSection: { gridColumn: 'span 3' },
  sideAccent: {
    gridColumn: 'span 1',
    background: 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
  },
  comparisonMatrix: {
    gridColumn: 'span 4',
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '1px',
    backgroundColor: '#0A0A0A',
  },
  matrixHeader: {
    backgroundColor: '#EBEBEB',
    padding: '1vw 1.5vw',
    borderBottom: '1px solid #0A0A0A',
  },
  matrixCell: {
    backgroundColor: '#F2F2F2',
    padding: '1vw 1.5vw',
    borderBottom: '1px solid #0A0A0A',
    display: 'flex',
    alignItems: 'center',
  },
  matrixCheck: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#0A0A0A',
    margin: 'auto',
  },
  matrixDash: {
    width: '12px',
    height: '1px',
    background: '#0A0A0A',
    margin: 'auto',
    opacity: 0.3,
  },
  onboardingForm: {
    gridColumn: 'span 4',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1px',
    backgroundColor: '#0A0A0A',
  },
  inputGroup: { marginBottom: '2vw' },
  input: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #0A0A0A',
    padding: '0.5vw 0',
    fontSize: '1.5vw',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    outline: 'none',
  },
  gradFooter: {
    gridColumn: 'span 4',
    background: 'linear-gradient(90deg, #d3cadd 0%, #e2a088 35%, #f4601d 65%, #206d39 100%)',
    height: '8vw',
  },
  arrowBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    border: '1px solid #0A0A0A',
    padding: '1vw 1.5vw',
    transition: 'all 0.2s ease',
    backgroundColor: 'transparent',
    width: '100%',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  arrowBtnHover: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    border: '1px solid #0A0A0A',
    padding: '1vw 1.5vw',
    transition: 'all 0.2s ease',
    backgroundColor: '#0A0A0A',
    color: '#F2F2F2',
    width: '100%',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  circleVisual: {
    width: '10vw',
    height: '10vw',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '2vw',
  },
  circleInner: {
    width: '60%',
    height: '60%',
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
    const fsSource = `precision highp float; uniform vec2 resolution; float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); } void main() { float noise = random(gl_FragCoord.xy); gl_FragColor = vec4(0.0, 0.0, 0.0, noise * 0.15); }`;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'position');

    function draw() {
      gl.useProgram(prog);
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(prog, 'resolution'), canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    draw();
    window.addEventListener('resize', draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', draw);
    };
  }, []);

  return <canvas ref={canvasRef} style={customStyles.noiseCanvas} />;
};

const Header = () => (
  <div style={customStyles.headerCell}>
    <div style={customStyles.headerInner}>
      <span style={customStyles.label}>LABBED</span>
    </div>
    <div style={customStyles.headerInner}>
      <span style={customStyles.label}>(Overview)</span>
    </div>
    <div style={customStyles.headerInner}>
      <span style={customStyles.label}>(Architecture)</span>
    </div>
    <div style={customStyles.headerInnerDark}>
      <span style={customStyles.label}>ENTERPRISE ACCESS</span>
    </div>
  </div>
);

const HeroSection = () => (
  <>
    <div style={{ ...customStyles.cell, ...customStyles.heroSection, ...customStyles.padLg }}>
      <h1 style={customStyles.h1}>EXPANDED<br />PARAMETERS</h1>
      <div style={{ marginTop: '4vw', maxWidth: '40vw' }}>
        <p style={customStyles.label}>03 / PROVISIONING</p>
        <p style={{ ...customStyles.footnote, marginTop: '1vw' }}>
          Deploy dedicated node clusters with hardware-level isolation. Enterprise access provides the cryptographic foundation for global network simulation at scale.
        </p>
      </div>
    </div>
    <div style={{ ...customStyles.cell, ...customStyles.sideAccent }}></div>
  </>
);

const MatrixRow = ({ feature, standard, enterprise }) => (
  <>
    <div style={customStyles.matrixCell}>
      <span style={customStyles.footnote}>{feature}</span>
    </div>
    <div style={customStyles.matrixCell}>
      {typeof standard === 'string'
        ? <span style={customStyles.footnote}>{standard}</span>
        : standard
          ? <div style={customStyles.matrixCheck}></div>
          : <div style={customStyles.matrixDash}></div>}
    </div>
    <div style={customStyles.matrixCell}>
      {typeof enterprise === 'string'
        ? <span style={customStyles.footnote}>{enterprise}</span>
        : enterprise
          ? <div style={customStyles.matrixCheck}></div>
          : <div style={customStyles.matrixDash}></div>}
    </div>
  </>
);

const ComparisonMatrix = () => (
  <div style={customStyles.comparisonMatrix}>
    <div style={customStyles.matrixHeader}><span style={customStyles.label}>FEATURE CAPABILITY</span></div>
    <div style={customStyles.matrixHeader}><span style={customStyles.label}>STANDARD</span></div>
    <div style={customStyles.matrixHeader}><span style={customStyles.label}>ENTERPRISE</span></div>
    <MatrixRow feature="Concurrent Simulations" standard="05 Max" enterprise="Unlimited" />
    <MatrixRow feature="Node Capacity (Graph)" standard="100 Units" enterprise="Infinite Cluster" />
    <MatrixRow feature="Micro-VM Snapshots" standard={true} enterprise={true} />
    <MatrixRow feature="Custom QCOW2 Images" standard={false} enterprise={true} />
    <MatrixRow feature="Priority Routing (MPLS/BGP)" standard={false} enterprise={true} />
  </div>
);

const OnboardingForm = () => {
  const [orgId, setOrgId] = useState('');
  const [email, setEmail] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (orgId.trim() && email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <div style={customStyles.onboardingForm}>
      <div style={{ ...customStyles.cell, ...customStyles.padLg }}>
        <div style={customStyles.circleVisual}>
          <div style={customStyles.circleInner}></div>
        </div>
        <h2 style={customStyles.h2}>Generate<br />Contract Key</h2>
        <div style={{ ...customStyles.footnote, marginTop: '1vw', opacity: 0.6 }}>
          Provisioning requires a valid organization identifier. Keys are generated via RSA-4096 and bound to your deployment domain.
        </div>
      </div>
      <div style={{ ...customStyles.cell, ...customStyles.padLg, justifyContent: 'center' }}>
        {submitted ? (
          <div style={{ ...customStyles.footnote, fontSize: '1.1vw', opacity: 0.8 }}>
            ✓ Provisioning initialized for <strong>{orgId}</strong>. Check <strong>{email}</strong> for your contract key.
          </div>
        ) : (
          <>
            <div style={customStyles.inputGroup}>
              <span style={{ ...customStyles.label, fontSize: '0.8vw' }}>ORGANIZATION_ID</span>
              <input
                type="text"
                placeholder="LAB-CORP-000"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                style={customStyles.input}
              />
            </div>
            <div style={customStyles.inputGroup}>
              <span style={{ ...customStyles.label, fontSize: '0.8vw' }}>ADMINISTRATOR_EMAIL</span>
              <input
                type="email"
                placeholder="root@domain.tld"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={customStyles.input}
              />
            </div>
            <button
              style={isHovered ? customStyles.arrowBtnHover : customStyles.arrowBtn}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={handleSubmit}
            >
              <span style={customStyles.label}>Initialize Provisioning</span>
              <svg width="30" height="15" viewBox="0 0 30 15">
                <line x1="0" y1="7.5" x2="28" y2="7.5" stroke={isHovered ? '#F2F2F2' : '#0A0A0A'} strokeWidth="1.5" />
                <polygon points="25,3 30,7.5 25,12" fill={isHovered ? '#F2F2F2' : '#0A0A0A'} />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const Footer = () => (
  <>
    <div style={customStyles.gradFooter}></div>
    <div style={{
      ...customStyles.cell,
      ...customStyles.padSm,
      gridColumn: 'span 4',
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTop: '1px solid #0A0A0A',
    }}>
      <div style={customStyles.footnote}>Section: Access / Enterprise / Provisioning System</div>
      <div style={customStyles.footnote}>System Status: [Ready] — V.04.22</div>
    </div>
  </>
);

const App = () => {
  useEffect(() => {
    document.body.style.backgroundColor = '#0A0A0A';
    document.body.style.padding = '1px';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.padding = '';
      document.body.style.overflowX = '';
    };
  }, []);

  return (
    <div style={customStyles.body}>
      <NoiseCanvas />
      <div style={customStyles.schematicGrid}>
        <Header />
        <HeroSection />
        <ComparisonMatrix />
        <OnboardingForm />
        <Footer />
      </div>
    </div>
  );
};

export default App;