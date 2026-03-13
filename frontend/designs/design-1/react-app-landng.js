import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

const customStyles = {
  root: {
    '--bg-color': '#F2F2F2',
    '--line-color': '#0A0A0A',
    '--text-color': '#0A0A0A',
    '--grad-vertical': 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
    '--font-main': "'Helvetica Neue', Helvetica, Arial, sans-serif",
    '--border': '1px solid #0A0A0A',
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
    boxSizing: 'border-box',
    margin: 0,
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
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gridTemplateRows: 'auto auto 1fr auto',
    gap: '1px',
    backgroundColor: '#0A0A0A',
    height: '100%',
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
  h1: {
    fontSize: '5vw',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.1,
  },
  label: {
    fontSize: '1.2vw',
    fontWeight: 400,
    textTransform: 'uppercase',
  },
  footnote: {
    fontSize: '0.85vw',
    lineHeight: 1.4,
  },
  padLg: {
    padding: '3vw',
  },
  padMd: {
    padding: '1.5vw',
  },
  padSm: {
    padding: '1vw',
  },
  authContainer: {
    gridColumn: 'span 2',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  visualSide: {
    gridColumn: 'span 2',
    background: 'linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)',
  },
  input: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #0A0A0A',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '1.5vw',
    padding: '0.5vw 0',
    width: '100%',
    outline: 'none',
    color: '#0A0A0A',
    textTransform: 'uppercase',
  },
  formGroup: {
    marginBottom: '3vw',
  },
  terminalPrompt: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '1vw',
    marginBottom: '0.5vw',
    display: 'block',
  },
  submitBtn: {
    background: '#0A0A0A',
    color: '#F2F2F2',
    border: 'none',
    padding: '1.5vw',
    fontSize: '1.2vw',
    textTransform: 'uppercase',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    transition: 'opacity 0.2s',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  geoCircle: {
    width: '15vw',
    height: '15vw',
    border: '1px solid #0A0A0A',
    borderRadius: '50%',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoInnerDot: {
    width: '1vw',
    height: '1vw',
    background: '#0A0A0A',
    borderRadius: '50%',
  },
  backLink: {
    textDecoration: 'none',
    color: '#0A0A0A',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5vw',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
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

const Header = ({ backHovered, setBackHovered }) => (
  <div style={customStyles.headerCell}>
    <div style={customStyles.headerInner}>
      <button
        style={{
          ...customStyles.backLink,
          fontStyle: backHovered ? 'italic' : 'normal',
        }}
        onMouseEnter={() => setBackHovered(true)}
        onMouseLeave={() => setBackHovered(false)}
        onClick={() => {}}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          style={{ transform: 'rotate(180deg)' }}
        >
          <line x1="2" y1="13" x2="13" y2="2" stroke="black" strokeWidth="1" />
          <polygon points="8,1 14,1 14,7" fill="black" />
        </svg>
        <span style={customStyles.label}>Return</span>
      </button>
    </div>
    <div style={customStyles.headerInner}>
      <span style={customStyles.label}>LABBED / AUTH</span>
    </div>
    <div style={customStyles.headerInner}>
      <span style={customStyles.label}>Node: 0x4F2A</span>
    </div>
    <div style={customStyles.headerInner}>
      <span style={customStyles.label}>Status: Disconnected</span>
    </div>
  </div>
);

const TitleBar = () => (
  <div
    style={{
      ...customStyles.cell,
      ...customStyles.padLg,
      gridColumn: 'span 4',
      borderBottom: '1px solid #0A0A0A',
    }}
  >
    <h1 style={customStyles.h1}>SYSTEM ACCESS PROTOCOL</h1>
  </div>
);

const AuthForm = ({ username, setUsername, password, setPassword, onSubmit, submitHovered, setSubmitHovered, formStatus }) => (
  <div style={{ ...customStyles.cell, ...customStyles.authContainer, ...customStyles.padLg }}>
    <div style={{ maxWidth: '400px' }}>
      <div style={customStyles.formGroup}>
        <label style={customStyles.terminalPrompt}>user@labbed:~$ identity_id</label>
        <input
          type="text"
          placeholder="USERNAME"
          style={{
            ...customStyles.input,
            color: '#0A0A0A',
          }}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div style={customStyles.formGroup}>
        <label style={customStyles.terminalPrompt}>user@labbed:~$ access_key_secure</label>
        <input
          type="password"
          placeholder="••••••••••••"
          style={{
            ...customStyles.input,
            color: '#0A0A0A',
          }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {formStatus && (
        <div
          style={{
            ...customStyles.footnote,
            marginBottom: '1vw',
            color: formStatus.type === 'error' ? '#c1755f' : '#2b9d88',
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '0.9vw',
          }}
        >
          {formStatus.message}
        </div>
      )}
      <button
        style={{
          ...customStyles.submitBtn,
          opacity: submitHovered ? 0.9 : 1,
        }}
        onMouseEnter={() => setSubmitHovered(true)}
        onMouseLeave={() => setSubmitHovered(false)}
        onClick={onSubmit}
      >
        <span>Initialize Session</span>
        <svg width="25" height="15" viewBox="0 0 25 15">
          <line x1="0" y1="7.5" x2="23" y2="7.5" stroke="white" strokeWidth="1.5" />
          <polygon points="21,3 25,7.5 21,12" fill="white" />
        </svg>
      </button>
    </div>
    <div style={{ ...customStyles.footnote, marginTop: '4vw' }}>
      Authentication required for cloud virtualization.<br />
      Recovery via hardware token if key is lost.
    </div>
  </div>
);

const VisualSide = () => (
  <div style={{ ...customStyles.cell, ...customStyles.visualSide }}>
    <div style={customStyles.geoCircle}>
      <div style={customStyles.geoInnerDot}></div>
      <svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="black" strokeWidth="0.5" strokeDasharray="4" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="black" strokeWidth="0.5" strokeDasharray="4" />
      </svg>
    </div>
  </div>
);

const Footer = () => (
  <div
    style={{
      ...customStyles.cell,
      ...customStyles.padSm,
      gridColumn: 'span 4',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    }}
  >
    <div style={customStyles.footnote}>
      Terminal ID: <u>LAB-SEC-882</u>
      <br />
      Encrypted via AES-256-GCM
    </div>
    <div style={{ ...customStyles.footnote, textAlign: 'right' }}>
      Labbed Infrastructure Systems
      <br />
      v2.4.0-Stable
    </div>
  </div>
);

const App = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [backHovered, setBackHovered] = useState(false);
  const [submitHovered, setSubmitHovered] = useState(false);
  const [formStatus, setFormStatus] = useState(null);

  const handleSubmit = () => {
    if (!username.trim() && !password.trim()) {
      setFormStatus({ type: 'error', message: '> ERROR: Identity ID and access key required.' });
      return;
    }
    if (!username.trim()) {
      setFormStatus({ type: 'error', message: '> ERROR: Identity ID is required.' });
      return;
    }
    if (!password.trim()) {
      setFormStatus({ type: 'error', message: '> ERROR: Access key is required.' });
      return;
    }
    setFormStatus({ type: 'success', message: '> Initializing session... Please wait.' });
    setTimeout(() => {
      setFormStatus({ type: 'success', message: '> Session initialized. Welcome, ' + username.toUpperCase() + '.' });
    }, 1500);
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { height: 100%; width: 100%; overflow: hidden; }
      body { background-color: #0A0A0A; }
      input::placeholder { color: rgba(10, 10, 10, 0.3); }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <div style={customStyles.body}>
        <NoiseCanvas />
        <div style={customStyles.schematicGrid}>
          <Header backHovered={backHovered} setBackHovered={setBackHovered} />
          <TitleBar />
          <AuthForm
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onSubmit={handleSubmit}
            submitHovered={submitHovered}
            setSubmitHovered={setSubmitHovered}
            formStatus={formStatus}
          />
          <VisualSide />
          <Footer />
        </div>
      </div>
    </Router>
  );
};

export default App;