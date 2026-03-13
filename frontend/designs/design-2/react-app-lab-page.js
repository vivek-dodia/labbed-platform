import React, { useState, useEffect } from 'react';
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
  },
  appLayout: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#F3EFE7',
    color: '#121212',
    fontFamily: "'Manrope', -apple-system, sans-serif",
    WebkitFontSmoothing: 'antialiased',
    overflowX: 'hidden',
  },
  sidebar: {
    width: '48px',
    borderRight: '1px solid #121212',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1rem 0',
    flexShrink: 0,
    backgroundColor: '#F3EFE7',
    zIndex: 10,
  },
  hamburger: {
    width: '24px',
    height: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    cursor: 'pointer',
  },
  hamburgerSpan: {
    display: 'block',
    height: '1px',
    backgroundColor: '#121212',
    width: '100%',
  },
  sidebarText: {
    writingMode: 'vertical-rl',
    transform: 'scale(-1)',
    fontSize: '0.65rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    gap: '1rem',
    display: 'flex',
  },
  mainContent: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topNav: {
    height: '48px',
    borderBottom: '1px solid #121212',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3EFE7',
    zIndex: 5,
  },
  navLeft: { display: 'flex', height: '100%' },
  navRight: { display: 'flex', height: '100%' },
  navItem: {
    padding: '0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    borderRight: '1px solid #121212',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    color: '#121212',
  },
  detailWorkspace: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    flexGrow: 1,
    overflow: 'hidden',
  },
  canvasArea: {
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #121212',
    position: 'relative',
    background: '#fff',
  },
  canvasHeader: {
    padding: '2rem',
    borderBottom: '1px solid #121212',
    backgroundColor: '#F3EFE7',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  topologyView: {
    flexGrow: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  canvasGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(to right, rgba(18,18,18,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(18,18,18,0.05) 1px, transparent 1px)
    `,
    backgroundSize: '30px 30px',
  },
  networkNode: {
    position: 'absolute',
    border: '1px solid #121212',
    backgroundColor: '#F3EFE7',
    padding: '0.75rem 1.25rem',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    boxShadow: '4px 4px 0 rgba(18,18,18,0.1)',
  },
  actionsBar: {
    padding: '1rem 2rem',
    borderTop: '1px solid #121212',
    backgroundColor: '#F3EFE7',
    display: 'flex',
    gap: '1rem',
  },
  sidebarPanel: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#121212',
    color: '#F3EFE7',
  },
  panelHeader: {
    padding: '1rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  terminalOutput: {
    flexGrow: 1,
    padding: '1.5rem',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.8rem',
    lineHeight: 1.6,
    overflowY: 'auto',
  },
  hoverHand: {
    position: 'absolute',
    width: '32px',
    height: '32px',
    zIndex: 10,
    pointerEvents: 'none',
    bottom: '30px',
    left: '180px',
  },
  label: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
  },
  meta: {
    fontSize: '0.75rem',
    lineHeight: 1.4,
  },
  h1: {
    fontFamily: "'Manrope', -apple-system, sans-serif",
    fontWeight: 200,
    fontSize: 'clamp(2.5rem, 4vw, 4rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  nodeStats: {
    display: 'flex',
    gap: '2rem',
    marginTop: '1rem',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
  },
};

const Pill = ({ children, onClick, variant, style }) => {
  const [hovered, setHovered] = useState(false);

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 1.2rem',
    borderRadius: '99px',
    border: '1px solid #121212',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    gap: '0.5rem',
    backgroundColor: '#F3EFE7',
    textTransform: 'uppercase',
    transition: 'all 0.2s',
    fontFamily: "'Manrope', -apple-system, sans-serif",
    transform: hovered ? 'translateY(-2px)' : 'none',
    boxShadow: hovered ? '4px 4px 0 #121212' : 'none',
    ...(variant === 'primary' && { backgroundColor: '#ED6A4A' }),
    ...(variant === 'secondary' && { backgroundColor: '#A2C2ED' }),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
};

const LabPage = () => {
  const [activeSidebarItem, setActiveSidebarItem] = useState('CLI');
  const [terminalLines, setTerminalLines] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedNode, setSelectedNode] = useState('RR-CORE-01');

  const sidebarItems = ['CLI', 'GUI', 'API'];

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { overflow: hidden; }
      @keyframes dash { to { stroke-dashoffset: -1000; } }
      .svg-animated path {
        stroke: #121212;
        stroke-width: 1.5px;
        fill: none;
        stroke-dasharray: 6;
        animation: dash 30s linear infinite;
      }
      .terminal-scroll::-webkit-scrollbar { width: 4px; }
      .terminal-scroll::-webkit-scrollbar-track { background: #121212; }
      .terminal-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleTerminalInput = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      setTerminalLines(prev => [...prev, { cmd: inputValue }]);
      setInputValue('');
    }
  };

  return (
    <div style={customStyles.appLayout}>
      <aside style={customStyles.sidebar}>
        <div style={customStyles.hamburger}>
          <span style={customStyles.hamburgerSpan}></span>
          <span style={customStyles.hamburgerSpan}></span>
          <span style={customStyles.hamburgerSpan}></span>
        </div>
        <div style={customStyles.sidebarText}>
          {sidebarItems.map((item) => (
            <span
              key={item}
              style={{
                cursor: 'pointer',
                opacity: activeSidebarItem === item ? 1 : 0.5,
                transition: 'opacity 0.2s',
              }}
              onClick={() => setActiveSidebarItem(item)}
            >
              {item}
            </span>
          ))}
        </div>
      </aside>

      <main style={customStyles.mainContent}>
        <nav style={customStyles.topNav}>
          <div style={customStyles.navLeft}>
            <a href="#" style={{ ...customStyles.navItem, fontWeight: 800 }}>LABBED</a>
            <a href="#" style={customStyles.navItem}>← BACK TO TOPOLOGIES</a>
          </div>
          <div style={customStyles.navRight}>
            <a href="#" style={{ ...customStyles.navItem, borderLeft: '1px solid #121212' }}>DASHBOARD</a>
            <a href="#" style={{ ...customStyles.navItem, backgroundColor: '#E4CB6A' }}>LIVE SESSION • ACTIVE</a>
          </div>
        </nav>

        <div style={customStyles.detailWorkspace}>
          <section style={customStyles.canvasArea}>
            <header style={customStyles.canvasHeader}>
              <div>
                <span style={{ ...customStyles.label, color: '#ED6A4A' }}>PROJECT ID: LAB-0992</span>
                <h1 style={customStyles.h1}>BGP Route Reflector Lab</h1>
                <div style={customStyles.nodeStats}>
                  <div style={customStyles.statItem}>
                    <span style={customStyles.label}>NODES</span>
                    <span style={customStyles.meta}>08 Virtual Instances</span>
                  </div>
                  <div style={customStyles.statItem}>
                    <span style={customStyles.label}>AUTHOR</span>
                    <span style={customStyles.meta}>NetEng_Sarah</span>
                  </div>
                  <div style={customStyles.statItem}>
                    <span style={customStyles.label}>LAST MODIFIED</span>
                    <span style={customStyles.meta}>2 hours ago</span>
                  </div>
                </div>
              </div>
            </header>

            <div style={customStyles.topologyView}>
              <div style={customStyles.canvasGrid}></div>

              <svg
                className="svg-animated"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
                viewBox="0 0 800 500"
                preserveAspectRatio="none"
              >
                <path d="M 400 100 L 200 300" />
                <path d="M 400 100 L 600 300" />
                <path d="M 200 300 L 400 350" />
                <path d="M 600 300 L 400 350" />
              </svg>

              {[
                {
                  id: 'RR-CORE-01',
                  label: 'RR-CORE-01',
                  meta: 'iBGP AS 65000',
                  bg: '#EAA8C6',
                  top: '80px',
                  left: '350px',
                },
                {
                  id: 'EDGE-WEST-A',
                  label: 'EDGE-WEST-A',
                  meta: '172.16.1.1',
                  bg: '#A2C2ED',
                  top: '280px',
                  left: '150px',
                },
                {
                  id: 'EDGE-EAST-B',
                  label: 'EDGE-EAST-B',
                  meta: '172.16.2.1',
                  bg: '#A2C2ED',
                  top: '280px',
                  left: '550px',
                },
                {
                  id: 'DIST-SW-01',
                  label: 'DIST-SW-01',
                  meta: 'VLAN 10, 20',
                  bg: '#E4CB6A',
                  top: '330px',
                  left: '360px',
                },
              ].map((node) => (
                <div
                  key={node.id}
                  style={{
                    ...customStyles.networkNode,
                    top: node.top,
                    left: node.left,
                    backgroundColor: node.bg,
                    cursor: 'pointer',
                    outline: selectedNode === node.id ? '2px solid #121212' : 'none',
                    outlineOffset: '2px',
                  }}
                  onClick={() => setSelectedNode(node.id)}
                >
                  <span style={customStyles.label}>{node.label}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', lineHeight: 1.4 }}>
                    {node.meta}
                  </span>
                </div>
              ))}

              <svg
                style={customStyles.hoverHand}
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 20L20 8L28 20" fill="#ED6A4A" stroke="#121212" strokeWidth="2" strokeLinejoin="round" />
                <rect x="16" y="20" width="8" height="14" fill="#ED6A4A" stroke="#121212" strokeWidth="2" />
                <path d="M28 20C32 20 34 22 34 25C34 28 30 34 24 34H16" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            <div style={customStyles.actionsBar}>
              <Pill variant="primary">DEPLOY TO CLUSTER ↘</Pill>
              <Pill variant="secondary">CLONE TOPOLOGY</Pill>
              <Pill>EXPORT YAML</Pill>
              <div style={{ flexGrow: 1 }}></div>
              <Pill style={{ borderStyle: 'dashed' }}>+ ADD NODE</Pill>
            </div>
          </section>

          <aside style={customStyles.sidebarPanel}>
            <div style={customStyles.panelHeader}>
              <span style={{ ...customStyles.label, opacity: 0.7 }}>
                CLI OUTPUT — {selectedNode}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }}></div>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }}></div>
              </div>
            </div>

            <div
              className="terminal-scroll"
              style={customStyles.terminalOutput}
            >
              <span style={{ color: '#EAA8C6' }}>RR-CORE-01#</span>{' '}
              <span style={{ color: '#E4CB6A' }}>show ip bgp summary</span>
              <br />
              <span style={{ opacity: 0.5 }}>BGP router identifier 10.255.255.1, local AS number 65000</span>
              <br />
              <span style={{ opacity: 0.5 }}>BGP table version is 142, main routing table version 142</span>
              <br />
              <br />
              Neighbor &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;V &nbsp;&nbsp;&nbsp;AS MsgRcvd MsgSent &nbsp;&nbsp;TblVer &nbsp;InQ OutQ Up/Down &nbsp;State/PfxRcd
              <br />
              172.16.1.1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;4 65000 &nbsp;&nbsp;&nbsp;&nbsp;442 &nbsp;&nbsp;&nbsp;&nbsp;451 &nbsp;&nbsp;&nbsp;&nbsp;142 &nbsp;&nbsp;&nbsp;0 &nbsp;&nbsp;&nbsp;0 02:41:18 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;12
              <br />
              172.16.2.1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;4 65000 &nbsp;&nbsp;&nbsp;&nbsp;438 &nbsp;&nbsp;&nbsp;&nbsp;449 &nbsp;&nbsp;&nbsp;&nbsp;142 &nbsp;&nbsp;&nbsp;0 &nbsp;&nbsp;&nbsp;0 02:40:05 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;15
              <br />
              <br />
              <span style={{ color: '#EAA8C6' }}>RR-CORE-01#</span>{' '}
              <span style={{ color: '#E4CB6A' }}>terminal monitor</span>
              <br />
              <span style={{ opacity: 0.5 }}>% Syslog monitoring enabled.</span>
              <br />
              <br />

              {terminalLines.map((line, i) => (
                <React.Fragment key={i}>
                  <span style={{ color: '#EAA8C6' }}>RR-CORE-01#</span>{' '}
                  <span style={{ color: '#E4CB6A' }}>{line.cmd}</span>
                  <br />
                  <span style={{ opacity: 0.5 }}>% Unknown command.</span>
                  <br />
                  <br />
                </React.Fragment>
              ))}

              <span style={{ color: '#EAA8C6' }}>RR-CORE-01#</span>{' '}
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleTerminalInput}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#E4CB6A',
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '0.8rem',
                  width: '200px',
                  caretColor: '#E4CB6A',
                }}
                placeholder="_"
                autoFocus
              />
            </div>

            <div
              style={{
                ...customStyles.panelHeader,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                borderBottom: 'none',
              }}
            >
              <span style={{ ...customStyles.label, opacity: 0.5 }}>CONNECTED VIA SSH V2</span>
              <span style={{ ...customStyles.label, color: '#EAA8C6' }}>LATENCY: 4MS</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<LabPage />} />
      </Routes>
    </Router>
  );
};

export default App;