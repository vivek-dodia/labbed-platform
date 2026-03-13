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
    minHeight: '100vh',
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
    minWidth: 0,
  },
  topNav: {
    height: '48px',
    borderBottom: '1px solid #121212',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navLeft: {
    display: 'flex',
    height: '100%',
  },
  navRight: {
    display: 'flex',
    height: '100%',
  },
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
    height: '100%',
    transition: 'background-color 0.15s, color 0.15s',
  },
  navItemBrand: {
    padding: '0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    borderRight: '1px solid #121212',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'none',
    color: '#121212',
    height: '100%',
    transition: 'background-color 0.15s, color 0.15s',
  },
  searchContainer: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    padding: '0 1rem',
    justifyContent: 'flex-end',
    color: '#121212',
    opacity: 0.5,
  },
  apiGrid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 1fr',
    minHeight: 'calc(100vh - 48px)',
  },
  docsSidebar: {
    borderRight: '1px solid #121212',
    padding: '2rem',
    overflowY: 'auto',
  },
  navGroup: {
    marginBottom: '2.5rem',
  },
  navGroupTitle: {
    marginBottom: '1rem',
    color: '#121212',
    opacity: 0.6,
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
  },
  navLink: {
    display: 'block',
    padding: '0.5rem 0',
    fontSize: '0.85rem',
    color: '#121212',
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'transform 0.2s',
    cursor: 'pointer',
  },
  navLinkActive: {
    display: 'block',
    padding: '0.5rem 0',
    fontSize: '0.85rem',
    color: '#121212',
    textDecoration: 'underline',
    fontWeight: 700,
    cursor: 'pointer',
  },
  docsBody: {
    padding: '3rem',
    borderRight: '1px solid #121212',
    overflowY: 'auto',
  },
  endpointBlock: {
    marginBottom: '4rem',
  },
  methodTagGet: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.7rem',
    padding: '0.2rem 0.5rem',
    border: '1px solid #121212',
    borderRadius: '4px',
    verticalAlign: 'middle',
    marginRight: '0.5rem',
    backgroundColor: '#A2C2ED',
  },
  methodTagPost: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.7rem',
    padding: '0.2rem 0.5rem',
    border: '1px solid #121212',
    borderRadius: '4px',
    verticalAlign: 'middle',
    marginRight: '0.5rem',
    backgroundColor: '#ED6A4A',
  },
  methodTagDelete: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.7rem',
    padding: '0.2rem 0.5rem',
    border: '1px solid #121212',
    borderRadius: '4px',
    verticalAlign: 'middle',
    marginRight: '0.5rem',
    backgroundColor: '#EAA8C6',
  },
  endpointPath: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.9rem',
    fontWeight: 700,
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.8rem',
    borderRadius: '99px',
    border: '1px solid #121212',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    gap: '0.4rem',
    backgroundColor: '#F3EFE7',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
  },
  pillTry: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.8rem',
    borderRadius: '99px',
    border: '1px solid #121212',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    gap: '0.4rem',
    backgroundColor: '#E4CB6A',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
  },
  codeView: {
    padding: '3rem',
    backgroundColor: '#fff',
    overflowY: 'auto',
  },
  terminalWindow: {
    border: '1px solid #121212',
    backgroundColor: '#121212',
    color: '#F3EFE7',
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '2rem',
  },
  terminalHeader: {
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    padding: '0.4rem 0.8rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.6rem',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'Space Mono', monospace",
  },
  terminalDots: {
    display: 'flex',
    gap: '4px',
  },
  terminalDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  terminalBody: {
    padding: '1.5rem',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.75rem',
    lineHeight: 1.6,
    overflowX: 'auto',
  },
  termKey: {
    color: '#A2C2ED',
  },
  termVal: {
    color: '#E4CB6A',
  },
  termComment: {
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
  termMethod: {
    color: '#EAA8C6',
  },
};

const Hamburger = () => (
  <div style={customStyles.hamburger}>
    <span style={customStyles.hamburgerSpan}></span>
    <span style={customStyles.hamburgerSpan}></span>
    <span style={customStyles.hamburgerSpan}></span>
  </div>
);

const NavHoverItem = ({ children, style }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      style={{
        ...style,
        backgroundColor: hovered ? '#121212' : 'transparent',
        color: hovered ? '#F3EFE7' : '#121212',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.preventDefault()}
    >
      {children}
    </a>
  );
};

const PillTry = ({ onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...customStyles.pillTry,
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '2px 2px 0 #121212' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      Try it
    </div>
  );
};

const NavLinkItem = ({ children, active, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      style={{
        ...(active ? customStyles.navLinkActive : customStyles.navLink),
        transform: !active && hovered ? 'translateX(5px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
    >
      {children}
    </a>
  );
};

const TryItModal = ({ isOpen, onClose, endpoint, method }) => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResponse({
        status: 'success',
        data: [{ id: 'top_99821', name: 'BGP-Core-Mesh', nodes: 12, status: 'active' }],
        total: 42,
      });
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18,18,18,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#F3EFE7',
          border: '1px solid #121212',
          padding: '2rem',
          maxWidth: '560px',
          width: '90%',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 500, fontSize: '1.25rem' }}>Try it — {method} {endpoint}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#121212' }}
          >
            ✕
          </button>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.4rem' }}>
            Authorization Token
          </div>
          <input
            type="text"
            placeholder="Bearer YOUR_TOKEN"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #121212',
              backgroundColor: '#fff',
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.75rem',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={handleSend}
          style={{
            backgroundColor: '#E4CB6A',
            border: '1px solid #121212',
            padding: '0.5rem 1.5rem',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem',
          }}
        >
          {loading ? 'Sending…' : 'Send Request'}
        </button>
        {response && (
          <div style={customStyles.terminalWindow}>
            <div style={customStyles.terminalHeader}>
              <div style={customStyles.terminalDots}>
                <div style={customStyles.terminalDot}></div>
                <div style={customStyles.terminalDot}></div>
                <div style={customStyles.terminalDot}></div>
              </div>
              <span>RESPONSE (JSON)</span>
            </div>
            <div style={customStyles.terminalBody}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TerminalWindow = ({ title, children }) => (
  <div style={customStyles.terminalWindow}>
    <div style={customStyles.terminalHeader}>
      <div style={customStyles.terminalDots}>
        <div style={customStyles.terminalDot}></div>
        <div style={customStyles.terminalDot}></div>
        <div style={customStyles.terminalDot}></div>
      </div>
      <span>{title}</span>
    </div>
    <div style={customStyles.terminalBody}>
      {children}
    </div>
  </div>
);

const DocsPage = () => {
  const [activeSection, setActiveSection] = useState('Topologies');
  const [modal, setModal] = useState({ open: false, endpoint: '', method: '' });
  const [hoveredLink, setHoveredLink] = useState(null);

  const openModal = (method, endpoint) => {
    setModal({ open: true, endpoint, method });
  };

  const closeModal = () => {
    setModal({ open: false, endpoint: '', method: '' });
  };

  const introLinks = ['Authentication', 'Rate Limits', 'Errors'];
  const resourceLinks = ['Topologies', 'Nodes', 'Links', 'Capture'];
  const webhookLinks = ['Link Status', 'Node Failure'];

  return (
    <>
      <div style={customStyles.apiGrid}>
        {/* Docs Sidebar */}
        <nav style={customStyles.docsSidebar}>
          <div style={customStyles.navGroup}>
            <div style={customStyles.navGroupTitle}>Introduction</div>
            {introLinks.map((link) => (
              <NavLinkItem
                key={link}
                active={activeSection === link}
                onClick={() => setActiveSection(link)}
              >
                {link}
              </NavLinkItem>
            ))}
          </div>
          <div style={customStyles.navGroup}>
            <div style={customStyles.navGroupTitle}>Resources</div>
            {resourceLinks.map((link) => (
              <NavLinkItem
                key={link}
                active={activeSection === link}
                onClick={() => setActiveSection(link)}
              >
                {link}
              </NavLinkItem>
            ))}
          </div>
          <div style={customStyles.navGroup}>
            <div style={customStyles.navGroupTitle}>Webhooks</div>
            {webhookLinks.map((link) => (
              <NavLinkItem
                key={link}
                active={activeSection === link}
                onClick={() => setActiveSection(link)}
              >
                {link}
              </NavLinkItem>
            ))}
          </div>
        </nav>

        {/* Docs Body */}
        <section style={customStyles.docsBody}>
          <header style={{ marginBottom: '4rem' }}>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#ED6A4A' }}>
              v2.4 API
            </span>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: '3.5rem', lineHeight: 1, letterSpacing: '-0.02em', marginTop: '1rem' }}>
              {activeSection}
            </h1>
            <p style={{ marginTop: '1.5rem', maxWidth: '480px', opacity: 0.7, fontSize: '0.95rem', lineHeight: 1.4 }}>
              Manage your network canvases programmatically. Create ephemeral environments, clone existing labs, and retrieve real-time state data for your automated test suites.
            </p>
          </header>

          <div style={customStyles.endpointBlock}>
            <div style={customStyles.endpointPath}>
              <span style={customStyles.methodTagGet}>GET</span>
              /v2/topologies
              <PillTry onClick={() => openModal('GET', '/v2/topologies')} />
            </div>
            <h3 style={{ fontWeight: 500, fontSize: '1.25rem', lineHeight: 1.2 }}>List all topologies</h3>
            <p style={{ marginTop: '0.5rem', opacity: 0.8, fontSize: '0.95rem', lineHeight: 1.4 }}>
              Returns a paginated list of all network topologies available to your account.
            </p>
          </div>

          <div style={customStyles.endpointBlock}>
            <div style={customStyles.endpointPath}>
              <span style={customStyles.methodTagPost}>POST</span>
              /v2/topologies
              <PillTry onClick={() => openModal('POST', '/v2/topologies')} />
            </div>
            <h3 style={{ fontWeight: 500, fontSize: '1.25rem', lineHeight: 1.2 }}>Create a topology</h3>
            <p style={{ marginTop: '0.5rem', opacity: 0.8, fontSize: '0.95rem', lineHeight: 1.4 }}>
              Initializes a new blank canvas. You must provide a unique name and an optional description.
            </p>
          </div>

          <div style={customStyles.endpointBlock}>
            <div style={customStyles.endpointPath}>
              <span style={customStyles.methodTagGet}>GET</span>
              /v2/topologies/:id
              <PillTry onClick={() => openModal('GET', '/v2/topologies/:id')} />
            </div>
            <h3 style={{ fontWeight: 500, fontSize: '1.25rem', lineHeight: 1.2 }}>Retrieve topology details</h3>
            <p style={{ marginTop: '0.5rem', opacity: 0.8, fontSize: '0.95rem', lineHeight: 1.4 }}>
              Fetch full configuration state, including active node counts and current running configuration hashes.
            </p>
          </div>

          <div style={customStyles.endpointBlock}>
            <div style={customStyles.endpointPath}>
              <span style={customStyles.methodTagDelete}>DELETE</span>
              /v2/topologies/:id
              <PillTry onClick={() => openModal('DELETE', '/v2/topologies/:id')} />
            </div>
            <h3 style={{ fontWeight: 500, fontSize: '1.25rem', lineHeight: 1.2 }}>Delete a topology</h3>
            <p style={{ marginTop: '0.5rem', opacity: 0.8, fontSize: '0.95rem', lineHeight: 1.4 }}>
              Immediately tears down all virtual assets and removes the topology record. This action cannot be undone.
            </p>
          </div>
        </section>

        {/* Code View */}
        <section style={customStyles.codeView}>
          <TerminalWindow title="REQUEST (CURL)">
            <span style={customStyles.termMethod}>curl</span> -X GET{' '}
            <span style={customStyles.termVal}>"https://api.labbed.io/v2/topologies"</span> \<br />
            &nbsp;&nbsp;-H <span style={customStyles.termVal}>"Authorization: Bearer YOUR_TOKEN"</span> \<br />
            &nbsp;&nbsp;-H <span style={customStyles.termVal}>"Accept: application/json"</span>
          </TerminalWindow>

          <TerminalWindow title="RESPONSE (JSON)">
            {'{'}<br />
            &nbsp;&nbsp;<span style={customStyles.termKey}>"status"</span>:{' '}
            <span style={customStyles.termVal}>"success"</span>,<br />
            &nbsp;&nbsp;<span style={customStyles.termKey}>"data"</span>: [<br />
            &nbsp;&nbsp;&nbsp;&nbsp;{'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={customStyles.termKey}>"id"</span>:{' '}
            <span style={customStyles.termVal}>"top_99821"</span>,<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={customStyles.termKey}>"name"</span>:{' '}
            <span style={customStyles.termVal}>"BGP-Core-Mesh"</span>,<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={customStyles.termKey}>"nodes"</span>:{' '}
            <span style={customStyles.termVal}>12</span>,<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={customStyles.termKey}>"status"</span>:{' '}
            <span style={customStyles.termVal}>"active"</span><br />
            &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br />
            &nbsp;&nbsp;],<br />
            &nbsp;&nbsp;<span style={customStyles.termComment}>{'// Total count for pagination'}</span><br />
            &nbsp;&nbsp;<span style={customStyles.termKey}>"total"</span>:{' '}
            <span style={customStyles.termVal}>42</span><br />
            {'}'}
          </TerminalWindow>

          <div style={{
            border: '1px solid #121212',
            padding: '1.5rem',
            backgroundColor: '#F3EFE7',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Pro Tip
            </span>
            <h3 style={{ fontWeight: 500, fontSize: '1.25rem', lineHeight: 1.2 }}>Batch Operations</h3>
            <p style={{ fontFamily: "'Manrope', sans-serif", opacity: 0.8, fontSize: '0.75rem', lineHeight: 1.4 }}>
              Use the <code style={{ fontFamily: "'Space Mono', monospace" }}>/v2/bulk/topologies</code> endpoint to deploy multiple pre-configured environments in a single API call.
            </p>
          </div>
        </section>
      </div>

      <TryItModal
        isOpen={modal.open}
        onClose={closeModal}
        endpoint={modal.endpoint}
        method={modal.method}
      />
    </>
  );
};

const App = () => {
  const [activeSidebarItem, setActiveSidebarItem] = useState('API');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://fonts.googleapis.com';
    document.head.appendChild(link);

    const link2 = document.createElement('link');
    link2.rel = 'preconnect';
    link2.href = 'https://fonts.gstatic.com';
    link2.crossOrigin = '';
    document.head.appendChild(link2);

    const link3 = document.createElement('link');
    link3.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap';
    link3.rel = 'stylesheet';
    document.head.appendChild(link3);

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { overflow-x: hidden; }
      @media (max-width: 1100px) {
        .code-view-section { display: none !important; }
        .api-grid-responsive { grid-template-columns: 240px 1fr !important; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(link2);
      document.head.removeChild(link3);
      document.head.removeChild(style);
    };
  }, []);

  const sidebarItems = ['CLI', 'GUI', 'API'];

  return (
    <Router basename="/">
      <div style={customStyles.appLayout}>
        {/* Sidebar */}
        <aside style={customStyles.sidebar}>
          <Hamburger />
          <div style={customStyles.sidebarText}>
            {sidebarItems.map((item) => (
              <span
                key={item}
                style={{
                  cursor: 'pointer',
                  opacity: activeSidebarItem === item ? 1 : 0.5,
                  fontWeight: activeSidebarItem === item ? 800 : 400,
                  transition: 'opacity 0.2s',
                }}
                onClick={() => setActiveSidebarItem(item)}
              >
                {item}
              </span>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main style={customStyles.mainContent}>
          {/* Top Nav */}
          <nav style={customStyles.topNav}>
            <div style={customStyles.navLeft}>
              <NavHoverItem style={customStyles.navItemBrand}>LABBED</NavHoverItem>
              <NavHoverItem style={customStyles.navItem}>TOPOLOGIES</NavHoverItem>
              <NavHoverItem style={customStyles.navItem}>DOCS</NavHoverItem>
            </div>
            <div style={customStyles.searchContainer}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, opacity: 0.4, marginRight: '12px' }}>
                Search docs...
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div style={customStyles.navRight}>
              <NavHoverItem style={{ ...customStyles.navItem, borderRight: 'none', borderLeft: '1px solid #121212' }}>
                AUTH TOKEN ↘
              </NavHoverItem>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={<DocsPage />} />
            <Route path="*" element={<DocsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;