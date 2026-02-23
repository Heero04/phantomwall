import React, { useState } from 'react'
import QuickAccess from './QuickAccess'
import TrafficView from './TrafficView'
import AlertsLedger from './AlertsLedger'
import HoneypotFleetManager from './pages/HoneypotFleetManager'
import S3LogExplorer from './pages/S3LogExplorer'
import IntelAnalytics from './pages/IntelAnalytics'
import CloudPosture from './pages/CloudPosture'
import Settings from './pages/Settings'
import ChatAssistant from './ChatAssistant'
// Auth Components
import { MockAuthProvider } from './contexts/MockAuthContext'
import Login from './components/Login'
import Signup from './components/Signup'
import VerifyEmail from './components/VerifyEmail'
import ForgotPassword from './components/ForgotPassword'
import { ProSidebarProvider, Sidebar, Menu, MenuItem } from 'react-pro-sidebar'

const NAV_ITEMS = [
  /* ── 1. Command Center (Home) ── */
  {
    key: 'console',
    label: 'Command Center',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="13 2 3 14 10 14 11 22 21 10 14 10 13 2" />
      </svg>
    ),
  },
  /* ── 2. Traffic Ledger (Real-Time) ── */
  {
    key: 'traffic-view',
    label: 'Traffic Ledger',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 12h4l2-6 4 12 2-6h6"/>
      </svg>
    ),
  },
  /* ── 3. Alerts & Investigation (Action) ── */
  {
    key: 'alerts-ledger',
    label: 'Alerts & Investigation',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  /* ── 4. Fleet Manager (Control) ── */
  {
    key: 'fleet',
    label: 'Fleet Manager',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="6" width="7" height="5" rx="1"/>
        <rect x="14" y="6" width="7" height="5" rx="1"/>
        <rect x="8.5" y="15" width="7" height="5" rx="1"/>
        <path d="M10 8.5h4M12 11v4"/>
      </svg>
    ),
  },
  /* ── 5. S3 Log Archive (History) ── */
  {
    key: 'logs',
    label: 'S3 Log Archive',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  /* ── 6. Intel & Analytics (Strategic) ── */
  {
    key: 'intel',
    label: 'Intel & Analytics',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  /* ── Utility ── */
  {
    key: 'posture',
    label: 'Cloud Posture',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (
      <svg
        className="menu-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export default function App() {
  const [activePage, setActivePage] = useState('console')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const renderNavItems = () => (
    <Menu>
      {NAV_ITEMS.map(item => (
        <MenuItem
          key={item.key}
          active={activePage === item.key}
          className={activePage === item.key ? 'menu-item active' : 'menu-item'}
          onClick={() => setActivePage(item.key)}
          icon={item.icon}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  )

  return (
    <ProSidebarProvider>
      <div className={`layout${isSidebarCollapsed ? ' layout--sidebar-collapsed' : ''}`}>
        <Sidebar breakPoint="md" collapsed={isSidebarCollapsed}>
          <div className="app-sidebar__header">
            <div className="app-sidebar__brand">
              <div className="app-sidebar__logo">
                <img src="/phantomwall-icon.png" alt="PhantomWall" />
              </div>
              <div>
                <h1>PhantomWall</h1>
                <p>Honeypot Console</p>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!isSidebarCollapsed}
            >
              <svg
                className="sidebar-toggle__icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </button>
          </div>
          {renderNavItems()}
          <div className="app-sidebar__footer">v0.4 ? Live telemetry</div>
        </Sidebar>

        <main className="main">
          {activePage === 'console' && <QuickAccess onNavigate={setActivePage} />}
          {activePage === 'traffic-view' && <TrafficView />}
          {activePage === 'alerts-ledger' && <AlertsLedger />}
          {activePage === 'fleet' && <HoneypotFleetManager />}
          {activePage === 'logs' && <S3LogExplorer />}
          {activePage === 'intel' && <IntelAnalytics />}
          {activePage === 'posture' && <CloudPosture />}
          {activePage === 'settings' && <Settings />}

          <footer className="main__footer">
            <small>Use SSM where possible; SSH requires private keys stored locally.</small>
          </footer>
        </main>

        <ChatAssistant />
      </div>
    </ProSidebarProvider>
  )
}


