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
  }
};

const globalStyleContent = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: #F3EFE7;
    color: #121212;
    font-family: 'Manrope', -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  .deploy-btn:hover {
    transform: translate(4px, -4px);
    box-shadow: -4px 4px 0 #A2C2ED;
  }

  .template-card:hover {
    background: #fff;
  }

  .template-card:hover .hover-hand {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }

  .nav-item:hover {
    background-color: #121212 !important;
    color: #F3EFE7 !important;
  }

  .sidebar-text span:hover {
    opacity: 1 !important;
  }

  @media (max-width: 900px) {
    .empty-hero { grid-template-columns: 1fr !important; }
    .empty-text { border-right: none !important; }
    .template-grid { grid-template-columns: 1fr !important; }
    .template-card { border-right: none !important; border-bottom: 1px solid #121212 !important; }
  }
`;

const Sidebar = ({ onMenuClick }) => (
  <aside style={{
    width: '48px',
    borderRight: '1px solid #121212',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1rem 0',
    flexShrink: 0,
    backgroundColor: '#F3EFE7',
    zIndex: 10,
    minHeight: '100vh',
  }}>
    <div
      onClick={onMenuClick}
      style={{
        width: '24px',
        height: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'block', height: '1px', backgroundColor: '#121212', width: '100%' }}></span>
      <span style={{ display: 'block', height: '1px', backgroundColor: '#121212', width: '100%' }}></span>
      <span style={{ display: 'block', height: '1px', backgroundColor: '#121212', width: '100%' }}></span>
    </div>
    <div style={{
      writingMode: 'vertical-rl',
      transform: 'scale(-1)',
      fontSize: '0.65rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      gap: '1rem',
      display: 'flex',
    }}>
      {['CLI', 'GUI', 'API'].map((item) => (
        <span
          key={item}
          className="sidebar-text"
          style={{ cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }}
        >
          {item}
        </span>
      ))}
    </div>
  </aside>
);

const TopNav = ({ onNewProject }) => (
  <nav style={{
    height: '48px',
    borderBottom: '1px solid #121212',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <div style={{ display: 'flex', height: '100%' }}>
      <a
        href="#"
        className="nav-item"
        style={{
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
          transition: 'background 0.2s, color 0.2s',
        }}
        onClick={(e) => e.preventDefault()}
      >
        LABBED
      </a>
    </div>
    <div style={{ display: 'flex', height: '100%' }}>
      <a
        href="#"
        className="nav-item"
        style={{
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
          transition: 'background 0.2s, color 0.2s',
        }}
        onClick={(e) => e.preventDefault()}
      >
        USER_01
      </a>
      <button
        className="nav-item"
        onClick={onNewProject}
        style={{
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          borderRight: '1px solid #121212',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700,
          cursor: 'pointer',
          color: '#121212',
          height: '100%',
          backgroundColor: '#ED6A4A',
          border: 'none',
          borderLeft: '1px solid #121212',
          transition: 'background 0.2s, color 0.2s',
          fontFamily: 'inherit',
        }}
      >
        NEW PROJECT +
      </button>
    </div>
  </nav>
);

const CanvasGrid = () => (
  <div style={{
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(to right, rgba(18,18,18,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(18,18,18,0.05) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    zIndex: 0,
  }}></div>
);

const GhostNode = ({ style, label }) => (
  <div style={{
    width: '120px',
    height: '60px',
    border: '1px dashed #121212',
    opacity: 0.2,
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.5rem',
    fontWeight: 700,
    ...style,
  }}>
    {label}
  </div>
);

const HoverHand = () => (
  <svg
    className="hover-hand"
    viewBox="0 0 40 40"
    fill="none"
    style={{
      position: 'absolute',
      width: '30px',
      height: '30px',
      right: '15px',
      bottom: '15px',
      opacity: 0,
      transform: 'translateY(10px)',
      transition: 'all 0.2s',
    }}
  >
    <path d="M12 20L20 8L28 20" fill="#ED6A4A" stroke="#121212" strokeWidth="2" />
    <rect x="16" y="20" width="8" height="14" fill="#ED6A4A" stroke="#121212" strokeWidth="2" />
    <path d="M28 20C32 20 34 22 34 25C34 28 30 34 24 34H16" stroke="#121212" strokeWidth="2" />
  </svg>
);

const TagBadge = ({ children }) => (
  <span style={{
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
    padding: '2px 6px',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '4px',
  }}>
    {children}
  </span>
);

const TemplateCard = ({ number, category, categoryColor, title, description, tags, onClick }) => (
  <div
    className="template-card"
    onClick={onClick}
    style={{
      borderRight: '1px solid #121212',
      padding: '2rem',
      cursor: 'pointer',
      transition: 'background 0.2s',
      position: 'relative',
    }}
  >
    <span style={{
      fontSize: '0.65rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      fontWeight: 700,
      color: categoryColor,
    }}>
      {number} — {category}
    </span>
    <h3 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 500, fontSize: '1.25rem', lineHeight: 1.2 }}>{title}</h3>
    <p style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>{description}</p>
    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
      {tags.map((tag, i) => <TagBadge key={i}>{tag}</TagBadge>)}
    </div>
    <HoverHand />
  </div>
);

const Modal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18,18,18,0.6)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#F3EFE7',
          border: '1px solid #121212',
          padding: '2.5rem',
          maxWidth: '480px',
          width: '90%',
          position: 'relative',
        }}
      >
        <span style={{
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700,
          opacity: 0.5,
        }}>LABBED — ACTION</span>
        <h2 style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 200,
          fontSize: '2rem',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          margin: '1rem 0',
        }}>{title}</h2>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '2rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#121212',
              color: '#F3EFE7',
              padding: '0.75rem 1.5rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'opacity 0.2s',
            }}
          >
            CONFIRM
          </button>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              color: '#121212',
              padding: '0.75rem 1.5rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: '1px solid #121212',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            CANCEL
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 700,
            color: '#121212',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const MenuDrawer = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const menuItems = ['TOPOLOGIES', 'DEVICES', 'PROTOCOLS', 'SETTINGS', 'DOCUMENTATION', 'ABOUT'];
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18,18,18,0.4)',
        zIndex: 50,
        display: 'flex',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '280px',
          backgroundColor: '#F3EFE7',
          borderRight: '1px solid #121212',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <span style={{
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 700,
          }}>NAVIGATION</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#121212',
            }}
          >
            ✕
          </button>
        </div>
        {menuItems.map((item) => (
          <div
            key={item}
            onClick={onClose}
            style={{
              padding: '1rem 0',
              borderBottom: '1px solid #121212',
              fontSize: '1.25rem',
              fontWeight: 200,
              fontFamily: "'Manrope', sans-serif",
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'padding-left 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.paddingLeft = '1rem'}
            onMouseLeave={(e) => e.currentTarget.style.paddingLeft = '0'}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

const HomePage = () => {
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDeployBlank = () => {
    setModal({
      isOpen: true,
      title: 'Deploy Blank Canvas',
      message: 'You are about to create a new blank topology canvas. This will open an empty environment ready for your architectural design.',
    });
  };

  const handleTemplateSelect = (templateName) => {
    setModal({
      isOpen: true,
      title: `Load Template: ${templateName}`,
      message: `You are about to load the "${templateName}" template into a new topology canvas. All pre-configured nodes and connections will be applied.`,
    });
  };

  const handleNewProject = () => {
    setModal({
      isOpen: true,
      title: 'Create New Project',
      message: 'Start a fresh project workspace. You can organize multiple topologies and configurations within a single project.',
    });
  };

  const templates = [
    {
      number: '01',
      category: 'L3 ROUTING',
      categoryColor: '#EAA8C6',
      title: 'OSPF Basics',
      description: 'A 3-node triangle topology configured with OSPF Area 0. Perfect for testing convergence and path selection.',
      tags: ['3 NODES', 'CORE'],
    },
    {
      number: '02',
      category: 'EXTERNAL',
      categoryColor: '#A2C2ED',
      title: 'BGP Peering',
      description: 'Simulate dual-homed ISP connections with eBGP peering and internal iBGP mesh between edge routers.',
      tags: ['5 NODES', 'EDGE'],
    },
    {
      number: '03',
      category: 'WAN',
      categoryColor: '#E4CB6A',
      title: 'SD-WAN Hub & Spoke',
      description: 'A complex multi-site deployment featuring automated tunnel orchestration and policy-based routing.',
      tags: ['8 NODES', 'ADVANCED'],
    },
  ];

  return (
    <>
      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
      />
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F3EFE7' }}>
        <Sidebar onMenuClick={() => setMenuOpen(true)} />
        <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <TopNav onNewProject={handleNewProject} />

          <section
            className="empty-hero"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              flexGrow: 1,
              borderBottom: '1px solid #121212',
            }}
          >
            <div
              className="empty-text"
              style={{
                padding: '4rem 3rem',
                borderRight: '1px solid #121212',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2rem',
              }}
            >
              <span style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 700,
                opacity: 0.5,
              }}>TOPOLOGIES / NEW</span>
              <h1 style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 200,
                fontSize: 'clamp(3rem, 6vw, 6rem)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>
                Your first lab is one click away.
              </h1>
              <p style={{ maxWidth: '450px', fontSize: '1rem', lineHeight: 1.6 }}>
                Welcome to Labbed. The canvas is clear and ready for your next architectural breakthrough. Start from scratch or pick a blueprint below to begin.
              </p>
              <button
                className="deploy-btn"
                onClick={handleDeployBlank}
                style={{
                  backgroundColor: '#121212',
                  color: '#F3EFE7',
                  padding: '1.5rem 2.5rem',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                  border: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                DEPLOY BLANK CANVAS
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div style={{
              backgroundColor: '#fff',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              minHeight: '300px',
            }}>
              <CanvasGrid />
              <GhostNode style={{ top: '25%', left: '30%' }} label="DRAG NODE HERE" />
              <GhostNode style={{ top: '55%', left: '55%' }} label="DEVICE_02" />
              <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
                <path
                  d="M 35% 30% Q 45% 45% 55% 55%"
                  stroke="#121212"
                  strokeWidth="1"
                  fill="none"
                  strokeDasharray="4"
                  opacity="0.1"
                />
              </svg>
              <div style={{ textAlign: 'center', zIndex: 1, pointerEvents: 'none' }}>
                <span style={{
                  fontSize: '1.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  opacity: 0.2,
                }}>TABULA RASA</span>
              </div>
            </div>
          </section>

          <div style={{ padding: '1rem 3rem', borderBottom: '1px solid #121212' }}>
            <span style={{
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 700,
            }}>QUICK-START TEMPLATES:</span>
          </div>

          <section
            className="template-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
            }}
          >
            {templates.map((template, index) => (
              <TemplateCard
                key={index}
                {...template}
                onClick={() => handleTemplateSelect(template.title)}
              />
            ))}
          </section>
        </main>
      </div>
    </>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = globalStyleContent;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Router>
  );
};

export default App;