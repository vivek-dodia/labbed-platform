import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const customStyles = {
  root: {
    '--bg': '#F3EFE7',
    '--ink': '#121212',
    '--blue': '#A2C2ED',
    '--orange': '#ED6A4A',
    '--yellow': '#E4CB6A',
    '--lilac': '#D0C3DF',
    '--pink': '#EAA8C6',
  }
};

const nodePositions = [
  [
    { top: '30%', left: '30%' },
    { top: '60%', left: '50%' },
    { top: '35%', left: '70%' },
  ],
  [
    { top: '20%', left: '60%' },
    { top: '70%', left: '20%' },
    { top: '40%', left: '40%' },
  ],
  [
    { top: '50%', left: '20%' },
    { top: '20%', left: '45%' },
    { top: '70%', left: '75%' },
  ],
];

const nodeColors = ['#A2C2ED', '#E4CB6A', '#EAA8C6'];

const nodeData = [
  { label: 'CORE-SW-01', meta: 'VLAN 10.10.1.1' },
  { label: 'DIST-RTR-02', meta: 'BGP AS 65002' },
  { label: 'EDGE-FW-01', meta: 'EXT-INT Gi0/1' },
];

const VisualPanel = () => {
  const panelRef = useRef(null);
  const nodeRefs = [useRef(null), useRef(null), useRef(null)];
  const [stateIdx, setStateIdx] = useState(0);
  const [paths, setPaths] = useState({ p12: '', p23: '', p31: '' });
  const [handPos, setHandPos] = useState({ left: '45%', top: '55%' });
  const animFrameRef = useRef(null);
  const intervalRef = useRef(null);

  const updateLines = () => {
    if (!panelRef.current) return;
    const parentRect = panelRef.current.getBoundingClientRect();
    if (parentRect.width === 0 || parentRect.height === 0) return;

    const coords = nodeRefs.map(ref => {
      if (!ref.current) return { x: 500, y: 500 };
      const rect = ref.current.getBoundingClientRect();
      return {
        x: ((rect.left + rect.width / 2) - parentRect.left) * (1000 / parentRect.width),
        y: ((rect.top + rect.height / 2) - parentRect.top) * (1000 / parentRect.height),
      };
    });

    setPaths({
      p12: `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`,
      p23: `M ${coords[1].x} ${coords[1].y} L ${coords[2].x} ${coords[2].y}`,
      p31: `M ${coords[2].x} ${coords[2].y} L ${coords[0].x} ${coords[0].y}`,
    });

    setHandPos({
      left: (coords[1].x / 10) + 2 + '%',
      top: (coords[1].y / 10) + 2 + '%',
    });
  };

  const startLineAnimation = () => {
    let start = null;
    const duration = 1100;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      updateLines();
      if (timestamp - start < duration) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      updateLines();
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setStateIdx(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const timeout = setTimeout(() => {
      startLineAnimation();
    }, 50);
    return () => clearTimeout(timeout);
  }, [stateIdx]);

  useEffect(() => {
    const handleResize = () => updateLines();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const positions = nodePositions[stateIdx];

  return (
    <section
      ref={panelRef}
      style={{
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      {/* Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(18,18,18,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(18,18,18,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* SVG Lines */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <style>{`
          @keyframes dash { to { stroke-dashoffset: -1000; } }
          .animated-path {
            stroke: #121212;
            stroke-width: 1.5;
            fill: none;
            stroke-dasharray: 6;
            animation: dash 30s linear infinite;
          }
        `}</style>
        <path className="animated-path" d={paths.p12} />
        <path className="animated-path" d={paths.p23} />
        <path className="animated-path" d={paths.p31} />
      </svg>

      {/* Network Nodes */}
      {nodeData.map((node, i) => (
        <div
          key={i}
          ref={nodeRefs[i]}
          style={{
            position: 'absolute',
            border: '1px solid #121212',
            background: nodeColors[i],
            padding: '0.75rem 1.25rem',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            boxShadow: '6px 6px 0 rgba(18,18,18,0.1)',
            transition: 'top 1s cubic-bezier(0.4, 0, 0.2, 1), left 1s cubic-bezier(0.4, 0, 0.2, 1)',
            top: positions[i].top,
            left: positions[i].left,
          }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              fontFamily: "'Manrope', -apple-system, sans-serif",
            }}
          >
            {node.label}
          </span>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.65rem',
              opacity: 0.7,
            }}
          >
            {node.meta}
          </span>
        </div>
      ))}

      {/* Hand Cursor */}
      <svg
        viewBox="0 0 40 40"
        fill="none"
        style={{
          position: 'absolute',
          width: 40,
          height: 40,
          zIndex: 10,
          pointerEvents: 'none',
          left: handPos.left,
          top: handPos.top,
          animation: 'float-hand 4s ease-in-out infinite',
        }}
      >
        <style>{`
          @keyframes float-hand {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(10px, 10px); }
          }
        `}</style>
        <path d="M12 20L20 8L28 20" fill="#ED6A4A" stroke="#121212" strokeWidth="2" strokeLinejoin="round" />
        <rect x="16" y="20" width="8" height="14" fill="#ED6A4A" stroke="#121212" strokeWidth="2" />
        <path d="M28 20C32 20 34 22 34 25C34 28 30 34 24 34H16" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </section>
  );
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [primaryHover, setPrimaryHover] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);
  const [githubHover, setGithubHover] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: '#F3EFE7',
        color: '#121212',
        fontFamily: "'Manrope', -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 48,
          borderRight: '1px solid #121212',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1rem 0',
          flexShrink: 0,
          backgroundColor: '#F3EFE7',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 24,
            height: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            marginBottom: '2rem',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'block', height: 1, backgroundColor: '#121212', width: '100%' }} />
          <span style={{ display: 'block', height: 1, backgroundColor: '#121212', width: '100%' }} />
          <span style={{ display: 'block', height: 1, backgroundColor: '#121212', width: '100%' }} />
        </div>
        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'scale(-1)',
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            gap: '1rem',
            display: 'flex',
          }}
        >
          <span style={{ opacity: 0.5 }}>CLI</span>
          <span style={{ opacity: 0.5 }}>GUI</span>
          <span style={{ opacity: 0.5 }}>API</span>
        </div>
      </aside>

      {/* Main Container */}
      <main
        style={{
          flexGrow: 1,
          display: 'grid',
          gridTemplateColumns: '500px 1fr',
        }}
      >
        {/* Form Panel */}
        <section
          style={{
            borderRight: '1px solid #121212',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#F3EFE7',
            zIndex: 2,
          }}
        >
          {/* Top Nav */}
          <nav
            style={{
              height: 48,
              borderBottom: '1px solid #121212',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <a
              href="#"
              style={{
                padding: '0 1.5rem',
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                borderRight: '1px solid #121212',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 800,
                textDecoration: 'none',
                color: '#121212',
              }}
            >
              LABBED
            </a>
          </nav>

          {/* Form Content */}
          <div
            style={{
              flexGrow: 1,
              padding: '4rem 3rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <h1
              style={{
                fontFamily: "'Manrope', -apple-system, sans-serif",
                fontWeight: 200,
                fontSize: '3.5rem',
                letterSpacing: '-0.02em',
                marginBottom: '2.5rem',
              }}
            >
              Welcome back
            </h1>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: '1.5rem' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                  }}
                >
                  Email Address
                </span>
                <input
                  type="email"
                  placeholder="engineer@network.com"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '1px solid #121212',
                    background: emailFocused ? '#fff' : 'transparent',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '0.9rem',
                    outline: 'none',
                    color: '#121212',
                    transition: 'background 0.2s',
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 700,
                    }}
                  >
                    Password
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 700,
                      opacity: 0.5,
                      cursor: 'pointer',
                    }}
                  >
                    Forgot?
                  </span>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '1px solid #121212',
                    background: passwordFocused ? '#fff' : 'transparent',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '0.9rem',
                    outline: 'none',
                    color: '#121212',
                    transition: 'background 0.2s',
                  }}
                />
              </div>

              {/* Primary Button */}
              <button
                type="submit"
                onMouseEnter={() => setPrimaryHover(true)}
                onMouseLeave={() => setPrimaryHover(false)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '1px solid #121212',
                  fontFamily: "'Manrope', -apple-system, sans-serif",
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  marginTop: '1rem',
                  background: primaryHover ? '#ED6A4A' : '#121212',
                  color: primaryHover ? '#121212' : '#F3EFE7',
                }}
              >
                {submitted ? 'Accessing...' : 'Access Console ↘'}
              </button>

              {/* Divider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '2rem 0',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  opacity: 0.5,
                }}
              >
                <span style={{ flex: 1, height: 1, background: '#121212', opacity: 0.2, marginRight: '1rem' }} />
                Or continue with
                <span style={{ flex: 1, height: 1, background: '#121212', opacity: 0.2, marginLeft: '1rem' }} />
              </div>

              {/* Google Button */}
              <button
                type="button"
                onMouseEnter={() => setGoogleHover(true)}
                onMouseLeave={() => setGoogleHover(false)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '1px solid #121212',
                  fontFamily: "'Manrope', -apple-system, sans-serif",
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  background: googleHover ? '#fff' : 'transparent',
                  color: '#121212',
                  marginBottom: '0.5rem',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.162-1.908 4.162-1.229 1.23-3.145 2.568-6.932 2.568-6.12 0-10.88-4.94-10.88-11.06s4.76-11.06 10.88-11.06c3.303 0 5.683 1.306 7.468 3.016l2.316-2.316c-2.022-1.936-4.707-3.392-9.784-3.392-8.843 0-16 7.157-16 16s7.157 16 16 16c4.76 0 8.358-1.573 11.235-4.573 2.973-2.973 3.903-7.143 3.903-10.518 0-.998-.078-1.957-.223-2.868h-14.915z" />
                </svg>
                Google SSO
              </button>

              {/* GitHub Button */}
              <button
                type="button"
                onMouseEnter={() => setGithubHover(true)}
                onMouseLeave={() => setGithubHover(false)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '1px solid #121212',
                  fontFamily: "'Manrope', -apple-system, sans-serif",
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  background: githubHover ? '#fff' : 'transparent',
                  color: '#121212',
                  marginTop: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub Auth
              </button>
            </form>

            {/* Footer CTA */}
            <div
              style={{
                marginTop: '3rem',
                paddingTop: '2rem',
                borderTop: '1px solid #121212',
                opacity: 0.8,
              }}
            >
              <p
                style={{
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  opacity: 0.5,
                }}
              >
                New to the engine?
              </p>
              <p style={{ marginTop: '0.5rem', fontWeight: 700 }}>
                Start for free —{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer', color: '#ED6A4A' }}>
                  Create Account
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Visual Panel */}
        <VisualPanel />
      </main>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const link1 = document.createElement('link');
    link1.rel = 'preconnect';
    link1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(link1);

    const link2 = document.createElement('link');
    link2.rel = 'preconnect';
    link2.href = 'https://fonts.gstatic.com';
    link2.crossOrigin = 'true';
    document.head.appendChild(link2);

    const link3 = document.createElement('link');
    link3.rel = 'stylesheet';
    link3.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap';
    document.head.appendChild(link3);

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { overflow: hidden; height: 100vh; background-color: #F3EFE7; }
      #root { height: 100vh; }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link1);
      document.head.removeChild(link2);
      document.head.removeChild(link3);
      document.head.removeChild(style);
    };
  }, []);

  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </Router>
  );
};

export default App;