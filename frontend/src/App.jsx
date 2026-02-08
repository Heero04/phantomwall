import React, { useState } from 'react'
import QuickAccessHub from './pages/QuickAccessHub'
import AlertsPage from './AlertsPage'
import PhantomWallTerminal from './components/PhantomWallTerminal'
import ChatAssistant from './ChatAssistant'
import { ProSidebarProvider, Sidebar, Menu, MenuItem } from 'react-pro-sidebar'

const NAV_ITEMS = [
  {
    key: 'console',
    label: 'Overview',
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
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    key: 'alerts',
    label: 'Alerts',
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
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
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
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
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
          <div className="app-sidebar__footer">v0.5 -- Live telemetry</div>
        </Sidebar>

        <main className="main">
          {activePage === 'console' && (
            <QuickAccessHub onNavigate={setActivePage} />
          )}

          {activePage === 'alerts' && <AlertsPage />}

          {activePage === 'terminal' && (
            <div className="page">
              <header className="page__header">
                <h2>Terminal</h2>
                <p>Connect directly to your AWS EC2 instances via SSM sessions.</p>
              </header>
              <div style={{ height: 'calc(100vh - 200px)' }}>
                <PhantomWallTerminal />
              </div>
            </div>
          )}
        </main>

        <ChatAssistant />
      </div>
    </ProSidebarProvider>
  )
}
