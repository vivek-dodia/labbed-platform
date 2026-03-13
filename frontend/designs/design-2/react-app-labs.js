import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

const styles = {
  root: {
    '--bg': '#F3EFE7',
    '--ink': '#121212',
    '--blue': '#A2C2ED',
    '--orange': '#ED6A4A',
    '--yellow': '#E4CB6A',
    '--lilac': '#D0C3DF',
    '--pink': '#EAA8C6',
    '--green': '#A8EAB5',
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
    gap: '1.5rem',
    display: 'flex',
    marginTop: 'auto',
    marginBottom: '2rem',
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
    transition: 'background 0.15s, color 0.15s',
    backgroundColor: 'transparent',
  },
  navItemRightFirst: {
    borderLeft: '1px solid #121212',
  },
  usageBar: {
    height: '48px',
    borderBottom: '1px solid #121212',
    display: 'flex',
    alignItems: 'center',
    padding: '0 2rem',
    backgroundColor: '#121212',
    color: '#F3EFE7',
    justifyContent: 'space-between',
  },
  usageTrack: {
    width: '200px',
    height: '6px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
    margin: '0 1rem',
  },
  usageFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    backgroundColor: '#ED6A4A',
    width: '65%',
  },
  pageHeader: {
    padding: '3rem 2rem',
    borderBottom: '1px solid #121212',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  h1: {
    fontFamily: "'Manrope', -apple-system, sans-serif",
    fontWeight: 200,
    fontSize: 'clamp(3rem, 6vw, 6rem)',
    lineHeight: 1,
    letterSpacing: '-0.02em',
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
  newLabBtn: {
    backgroundColor: '#ED6A4A',
    color: '#121212',
    border: '1px solid #121212',
    padding: '1rem 2rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontFamily: "'Manrope', -apple-system, sans-serif",
    transition: 'transform 0.1s',
  },
  filterBar: {
    padding: '1rem 2rem',
    borderBottom: '1px solid #121212',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.8rem',
    borderRadius: '99px',
    border: '1px solid #121212',
    fontSize: '0.7rem',
    fontWeight: 500,
    cursor: 'pointer',
    gap: '0.4rem',
    backgroundColor: '#F3EFE7',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  gridDashboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    borderBottom: '1px solid #121212',
  },
  labCard: {
    borderRight: '1px solid #121212',
    borderBottom: '1px solid #121212',
    backgroundColor: '#F3EFE7',
    display: 'flex',
    flexDirection: 'column',
    transition: 'background 0.2s',
    cursor: 'pointer',
    position: 'relative',
  },
  labCardHover: {
    backgroundColor: '#fff',
  },
  cardPreview: {
    height: '180px',
    borderBottom: '1px solid #121212',
    position: 'relative',
    backgroundColor: '#fff',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasThumb: {
    position: 'absolute',
    inset: 0,
    opacity: 0.15,
    backgroundImage: 'linear-gradient(to right, rgba(18,18,18,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(18,18,18,0.2) 1px, transparent 1px)',
    backgroundSize: '15px 15px',
  },
  thumbNode: {
    position: 'absolute',
    width: '40px',
    height: '24px',
    border: '1px solid #121212',
    backgroundColor: '#F3EFE7',
    zIndex: 2,
  },
  thumbLine: {
    position: 'absolute',
    borderTop: '1px dashed #121212',
    zIndex: 1,
  },
  cardContent: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    flexGrow: 1,
  },
  h3: {
    fontWeight: 500,
    fontSize: '1.25rem',
    lineHeight: 1.2,
  },
  cardFooter: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #121212',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: '0.6rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    padding: '0.15rem 0.5rem',
    border: '1px solid #121212',
    borderRadius: '4px',
  },
  actionMenu: {
    transition: 'opacity 0.2s',
  },
  hoverHand: {
    position: 'absolute',
    width: '30px',
    height: '30px',
    right: '15px',
    top: '15px',
    zIndex: 10,
    pointerEvents: 'none',
    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
};

const getStatusStyle = (status) => {
  const base = { ...styles.statusBadge };
  if (status === 'Running') return { ...base, backgroundColor: '#A8EAB5' };
  if (status === 'Stopped') return { ...base, backgroundColor: '#ddd' };
  if (status === 'Draft') return { ...base, backgroundColor: '#D0C3DF' };
  return base;
};

const LabCard = ({ title, status, description, updatedAt, previewContent }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ ...styles.labCard, ...(hovered ? styles.labCardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.cardPreview}>
        <div style={styles.canvasThumb}></div>
        {previewContent}
        <svg
          style={{
            ...styles.hoverHand,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(10px)',
          }}
          viewBox="0 0 40 40"
          fill="none"
        >
          <path d="M12 20L20 8L28 20" fill="#ED6A4A" stroke="#121212" strokeWidth="2" />
          <rect x="16" y="20" width="8" height="14" fill="#ED6A4A" stroke="#121212" strokeWidth="2" />
        </svg>
      </div>
      <div style={styles.cardContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={styles.h3}>{title}</h3>
          <span style={getStatusStyle(status)}>{status}</span>
        </div>
        <p style={{ ...styles.meta, opacity: 0.7 }}>{description}</p>
      </div>
      <div style={styles.cardFooter}>
        <span style={{ ...styles.meta, opacity: 0.5 }}>{updatedAt}</span>
        <div style={{ ...styles.actionMenu, opacity: hovered ? 1 : 0.4 }}>
          <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
            <circle cx="2" cy="2" r="2" />
            <circle cx="8" cy="2" r="2" />
            <circle cx="14" cy="2" r="2" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ children, style, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...styles.navItem,
        ...style,
        backgroundColor: hovered ? '#121212' : 'transparent',
        color: hovered ? '#F3EFE7' : '#121212',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

const Pill = ({ children }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...styles.pill,
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '2px 2px 0 #121212' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
};

const SidebarTextItem = ({ children, active, onClick }) => (
  <span
    style={{
      cursor: 'pointer',
      opacity: active ? 1 : 0.5,
      transition: 'opacity 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
    onMouseLeave={e => e.currentTarget.style.opacity = active ? '1' : '0.5'}
    onClick={onClick}
  >
    {children}
  </span>
);

const labsData = [
  {
    id: 1,
    title: 'Core BGP Mesh',
    status: 'Running',
    description: 'Multi-AS testing environment with 4 edge routers and simulated upstream transit.',
    updatedAt: 'Updated 2m ago',
    preview: (
      <>
        <div style={{ ...styles.thumbNode, top: '40px', left: '60px', backgroundColor: '#A2C2ED' }}></div>
        <div style={{ ...styles.thumbNode, top: '100px', left: '160px', backgroundColor: '#E4CB6A' }}></div>
        <div style={{ ...styles.thumbLine, width: '100px', transform: 'rotate(35deg)', top: '60px', left: '90px' }}></div>
      </>
    ),
  },
  {
    id: 2,
    title: 'DMZ Security Stack',
    status: 'Stopped',
    description: 'Testing Palo Alto VM-series with East-West traffic inspection and NAT policies.',
    updatedAt: 'Updated 4h ago',
    preview: (
      <>
        <div style={{ ...styles.thumbNode, top: '70px', left: '140px', backgroundColor: '#EAA8C6' }}></div>
        <div style={{ ...styles.thumbNode, top: '40px', left: '40px' }}></div>
        <div style={{ ...styles.thumbNode, top: '100px', left: '40px' }}></div>
        <div style={{ ...styles.thumbLine, width: '100px', transform: 'rotate(-15deg)', top: '65px', left: '60px' }}></div>
        <div style={{ ...styles.thumbLine, width: '100px', transform: 'rotate(15deg)', top: '95px', left: '60px' }}></div>
      </>
    ),
  },
  {
    id: 3,
    title: 'SD-WAN Branch 01',
    status: 'Draft',
    description: 'Initial template for site-to-site fabric deployment. No configuration applied.',
    updatedAt: 'Created yesterday',
    preview: (
      <div style={{ ...styles.thumbNode, top: '80px', left: '80px', backgroundColor: '#D0C3DF', width: '120px' }}></div>
    ),
  },
  {
    id: 4,
    title: 'Load Balancer Test',
    status: 'Stopped',
    description: 'F5 Big-IP LTM cluster with 2 backend Nginx servers for round-robin testing.',
    updatedAt: 'Updated 3 days ago',
    preview: (
      <>
        <div style={{ ...styles.thumbNode, top: '50px', left: '150px', backgroundColor: '#A8EAB5' }}></div>
        <div style={{ ...styles.thumbNode, top: '110px', left: '150px', backgroundColor: '#A8EAB5' }}></div>
        <div style={{ ...styles.thumbNode, top: '80px', left: '50px', backgroundColor: '#ED6A4A' }}></div>
      </>
    ),
  },
  {
    id: 5,
    title: 'Empty Sandbox',
    status: 'Draft',
    description: 'Quick start scratchpad for CLI command validation.',
    updatedAt: 'Updated 1 week ago',
    preview: (
      <div style={{ ...styles.thumbNode, top: '60px', left: '100px' }}></div>
    ),
  },
  {
    id: 6,
    title: 'IPSec Tunnel Lab',
    status: 'Running',
    description: 'Point-to-point VPN between two remote sites with IKEv2 and AES-256.',
    updatedAt: 'Updated 10m ago',
    preview: (
      <>
        <div style={{ ...styles.thumbNode, top: '50px', left: '50px', backgroundColor: '#A2C2ED' }}></div>
        <div style={{ ...styles.thumbNode, top: '50px', left: '230px', backgroundColor: '#A2C2ED' }}></div>
        <div style={{ ...styles.thumbLine, width: '140px', top: '62px', left: '90px' }}></div>
      </>
    ),
  },
];

const App = () => {
  const [activeSidebar, setActiveSidebar] = useState('LABS');
  const [newBtnActive, setNewBtnActive] = useState(false);

  return (
    <Router basename="/">
      <div style={styles.appLayout}>
        <aside style={styles.sidebar}>
          <div style={styles.hamburger}>
            <span style={styles.hamburgerSpan}></span>
            <span style={styles.hamburgerSpan}></span>
            <span style={styles.hamburgerSpan}></span>
          </div>
          <div style={styles.sidebarText}>
            <SidebarTextItem active={activeSidebar === 'SETTINGS'} onClick={() => setActiveSidebar('SETTINGS')}>SETTINGS</SidebarTextItem>
            <SidebarTextItem active={activeSidebar === 'ARCHIVE'} onClick={() => setActiveSidebar('ARCHIVE')}>ARCHIVE</SidebarTextItem>
            <SidebarTextItem active={activeSidebar === 'LABS'} onClick={() => setActiveSidebar('LABS')}>LABS</SidebarTextItem>
          </div>
        </aside>

        <main style={styles.mainContent}>
          <nav style={styles.topNav}>
            <div style={styles.navLeft}>
              <NavItem style={{ fontWeight: 800 }}>LABBED</NavItem>
              <NavItem>EXPLORE</NavItem>
            </div>
            <div style={styles.navRight}>
              <NavItem style={{ gap: '8px', borderLeft: '1px solid #121212' }}>
                <div style={{ width: '16px', height: '16px', backgroundColor: '#EAA8C6', borderRadius: '50%', border: '1px solid #121212' }}></div>
                ADMIN_USER
              </NavItem>
              <NavItem>LOGOUT ↘</NavItem>
            </div>
          </nav>

          <div style={styles.usageBar}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ ...styles.label, opacity: 0.6, color: '#F3EFE7' }}>Storage:</span>
              <div style={styles.usageTrack}>
                <div style={styles.usageFill}></div>
              </div>
              <span style={{ ...styles.meta, fontFamily: "'Space Mono', monospace" }}>6.5GB / 10GB</span>
            </div>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <span style={styles.meta}>Nodes active: <strong>12 / 50</strong></span>
              <span style={styles.meta}>Instance: <strong>US-EAST-1</strong></span>
            </div>
          </div>

          <header style={styles.pageHeader}>
            <div>
              <span style={{ ...styles.label, display: 'block', marginBottom: '0.5rem' }}>WORKSPACE / DEFAULT</span>
              <h1 style={styles.h1}>My Labs</h1>
            </div>
            <button
              style={{
                ...styles.newLabBtn,
                transform: newBtnActive ? 'translate(2px, 2px)' : 'none',
              }}
              onMouseDown={() => setNewBtnActive(true)}
              onMouseUp={() => setNewBtnActive(false)}
              onMouseLeave={() => setNewBtnActive(false)}
            >
              <span>New Topology</span>
              <span style={{ fontSize: '1.2rem' }}>+</span>
            </button>
          </header>

          <div style={styles.filterBar}>
            <span style={styles.label}>Sort by:</span>
            <Pill>Recently Modified ↘</Pill>
            <Pill>Status: All</Pill>
            <Pill>Tags</Pill>
            <div style={{ flexGrow: 1 }}></div>
            <div style={{ ...styles.meta, opacity: 0.5 }}>Displaying 8 topologies</div>
          </div>

          <section style={styles.gridDashboard}>
            {labsData.map((lab) => (
              <LabCard
                key={lab.id}
                title={lab.title}
                status={lab.status}
                description={lab.description}
                updatedAt={lab.updatedAt}
                previewContent={lab.preview}
              />
            ))}
          </section>
        </main>
      </div>
    </Router>
  );
};

export default App;