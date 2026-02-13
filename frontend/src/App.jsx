import React, { useState } from 'react'
import QuickAccess from './QuickAccess'
import Dashboard from './Dashboard_BACKUP'
import DashboardSafe from './DashboardSafe'
import DashboardV2 from './DashboardV2'
import AlertsPage from './AlertsPage'
import GridTest from './GridTest'
import SecurityDataTable from './SecurityDataTable'
import PowerBIStyleDragDrop from './PowerBIStyleDragDrop'
import BarChartTest from './BarChartTest'
import LibraryTest from './LibraryTest'
import MapTest from './components/MapTest'
import MapWidgetTest from './components/MapWidgetTest'
import PowerBIDashboard from './components/PowerBIDashboard'
import TerminalTest from './pages/TerminalTest'
import ReactTerminal from './components/ReactTerminal'
import PhantomWallTerminal from './components/PhantomWallTerminal'
import SimpleTerminalTest from './components/SimpleTerminalTest'
import ChatAssistant from './ChatAssistant'
import LogViewer from './LogViewer'
import SSMCommands from './SSMCommands'
// Auth Components
import { MockAuthProvider } from './contexts/MockAuthContext'
import Login from './components/Login'
import Signup from './components/Signup'
import VerifyEmail from './components/VerifyEmail'
import ForgotPassword from './components/ForgotPassword'
import { ProSidebarProvider, Sidebar, Menu, MenuItem } from 'react-pro-sidebar'

const NAV_ITEMS = [
  {
    key: 'console',
    label: 'Quick Access',
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
  {
    key: 'dashboard',
    label: 'Dashboard',
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
        <rect x="3" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="9" width="4" height="11" rx="1" />
        <rect x="17" y="5" width="4" height="15" rx="1" />
      </svg>
    ),
  },
  {
    key: 'original-dashboard',
    label: 'Original Dashboard',
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
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M3 15h18"/>
      </svg>
    ),
  },
  {
    key: 'dashboardv2',
    label: 'Dashboard v2',
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
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="13" y="3" width="7" height="5" rx="1" />
        <rect x="13" y="12" width="7" height="8" rx="1" />
        <rect x="3" y="16" width="7" height="4" rx="1" />
      </svg>
    ),
  },
  {
    key: 'alerts',
    label: 'Security Alerts',
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
        <path d="M12 9v4l2 2" />
        <path d="M21 12c0 1.1-.1 2.2-.3 3.3l-1.8-.6c.1-.9.1-1.8.1-2.7 0-4.4-3.6-8-8-8s-8 3.6-8 8c0 .9 0 1.8.1 2.7l-1.8.6C3.1 14.2 3 13.1 3 12c0-5 4-9 9-9s9 4 9 9Z" />
        <path d="M12 7v6l1.5 1.5" />
      </svg>
    ),
  },
  {
    key: 'logs',
    label: 'S3 Log Explorer',
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
  {
    key: 'gridtest',
    label: 'Grid Test',
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
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    key: 'datatable',
    label: 'Data Table',
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
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M9 21V9"/>
      </svg>
    ),
  },
  {
    key: 'dragdrop',
    label: 'Drag & Drop',
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
        <path d="M14 9V5a3 3 0 0 0-6 0v4"/>
        <rect x="2" y="9" width="20" height="11" rx="2"/>
        <circle cx="8" cy="15" r="1"/>
        <circle cx="16" cy="15" r="1"/>
      </svg>
    ),
  },
  {
    key: 'barchart',
    label: 'Bar Chart Test',
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
        <rect x="3" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="8" width="4" height="12" rx="1" />
        <rect x="17" y="4" width="4" height="16" rx="1" />
      </svg>
    ),
  },
  {
    key: 'libtest',
    label: 'Library Test',
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
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
    ),
  },
  {
    key: 'maptest',
    label: 'Map Test',
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
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
    ),
  },
  {
    key: 'mapwidget',
    label: 'Map Widget',
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
        <circle cx="12" cy="10" r="3"/>
        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
      </svg>
    ),
  },
  {
    key: 'terminaltest',
    label: 'Terminal Test',
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
        <polyline points="4 17 10 11 4 5"/>
        <line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
    ),
  },
  {
    key: 'terminal',
    label: 'Terminal',
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
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <polyline points="9 10 13 14 9 18"/>
      </svg>
    ),
  },
  {
    key: 'terminaltest2',
    label: 'Terminal Debug',
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
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="12" cy="12" r="1"/>
      </svg>
    ),
  },
  {
    key: 'logs',
    label: 'S3 Log Viewer',
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
  {
    key: 'ssm',
    label: 'SSM Commands',
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
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
]

export default function App() {
  const [activePage, setActivePage] = useState('console')
  const [honeypotIp, setHoneypotIp] = useState('')
  const [kaliIp, setKaliIp] = useState('')
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
          {activePage === 'console' && <QuickAccess />}

          {activePage === 'dashboard' && (
            <>
              <PowerBIDashboard />
            </>
          )}

          {activePage === 'original-dashboard' && (
            <>
              <Dashboard />
              <div style={{ 
                background: '#f0f8ff', 
                padding: '16px', 
                margin: '20px auto', 
                maxWidth: '1200px',
                border: '1px solid #bee5eb',
                borderRadius: '8px'
              }}>
                <h3>📊 Original Suricata Dashboard</h3>
                <p>This is the original real-time dashboard for Suricata events and honeypot telemetry.</p>
                <p>The main Dashboard now features the new Power BI-style interface with drag & drop widgets.</p>
              </div>
            </>
          )}

          {activePage === 'alerts' && <AlertsPage />}

          {activePage === 'logs' && <LogViewer />}

          {activePage === 'ssm' && <SSMCommands />}

          {activePage === 'dashboardv2' && <DashboardV2 />}

          {activePage === 'gridtest' && <GridTest />}

          {activePage === 'datatable' && <SecurityDataTable />}

          {activePage === 'dragdrop' && <PowerBIStyleDragDrop />}

          {activePage === 'barchart' && <BarChartTest />}

          {activePage === 'libtest' && <LibraryTest />}

          {activePage === 'maptest' && <MapTest />}

          {activePage === 'mapwidget' && <MapWidgetTest />}

          {activePage === 'terminaltest' && <TerminalTest />}

          {activePage === 'terminal' && (
            <div className="page">
              <header className="page__header">
                <h2>Terminal</h2>
                <p>Connect directly to your AWS EC2 instances via SSM sessions.</p>
              </header>
              <div style={{ height: 'calc(100vh - 200px)', padding: '20px' }}>
                <PhantomWallTerminal />
              </div>
            </div>
          )}

          {activePage === 'terminaltest2' && <SimpleTerminalTest />}

          <footer className="main__footer">
            <small>Use SSM where possible; SSH requires private keys stored locally.</small>
          </footer>
        </main>

        <ChatAssistant />
      </div>
    </ProSidebarProvider>
  )
}
