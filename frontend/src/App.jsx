import React, { useEffect, useMemo, useState } from 'react'
import QuickAccess from './QuickAccess'
import TrafficView from './TrafficView'
import AlertsLedger from './AlertsLedger'
import HoneypotFleetManager from './pages/HoneypotFleetManager'
import S3LogExplorer from './pages/S3LogExplorer'
import IntelAnalytics from './pages/IntelAnalytics'
import CloudPosture from './pages/CloudPosture'
import Settings from './pages/Settings'
import ChatAssistant from './ChatAssistant'
import OnboardingModal from './components/OnboardingModal'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Signup from './components/Signup'
import VerifyEmail from './components/VerifyEmail'
import ForgotPassword from './components/ForgotPassword'
import { AUTH_REQUIRED_EVENT } from './lib/apiClient'
import { ProSidebarProvider, Sidebar, Menu, MenuItem } from 'react-pro-sidebar'

const SETTINGS_STORAGE_KEY = 'phantomwall_settings'
const SETTINGS_SAVED_EVENT = 'phantomwall:settings-saved'
const AUDIT_LOG_STORAGE_KEY = 'phantomwall_audit_log'
const DEFAULT_SESSION_TIMEOUT_MIN = 60
const LANGUAGE_STORAGE_KEY = 'phantomwall_language'

const VI_NAV_LABELS = {
  console: 'Trung tâm Điều khiển',
  'traffic-view': 'Nhật ký Lưu lượng',
  'alerts-ledger': 'Cảnh báo & Điều tra',
  fleet: 'Quan ly Fleet',
  logs: 'Kho Log S3',
  intel: 'Tình báo & Phân tích',
  posture: 'Tư thế Đám mây',
  settings: 'Cài đặt',
}

const getStoredSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const ACCENT_COLOR_MAP = {
  cyan: '#06b6d4',
  emerald: '#10b981',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  blue: '#3b82f6',
}

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
  const { user, loading: authLoading, isAuthenticated, logout, mfaChallenge, verifyMfaCode } = useAuth()
  const [authView, setAuthView] = useState('login')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [activePage, setActivePage] = useState('console')
  const [language, setLanguage] = useState(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      return stored === 'vi' ? 'vi' : 'en'
    } catch {
      return 'en'
    }
  })
  const [userPrefs, setUserPrefs] = useState(() => getStoredSettings())
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => Boolean(getStoredSettings().sidebarCollapsed))
  const [sessionLocked, setSessionLocked] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  const isVietnamese = language === 'vi'

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    const syncFromStorage = () => {
      const prefs = getStoredSettings()
      setUserPrefs(prefs)
      if (typeof prefs.sidebarCollapsed === 'boolean') {
        setIsSidebarCollapsed(prefs.sidebarCollapsed)
      }
    }
    const onSettingsSaved = (event) => {
      const prefs = event?.detail || getStoredSettings()
      setUserPrefs(prefs)
      if (typeof prefs.sidebarCollapsed === 'boolean') {
        setIsSidebarCollapsed(prefs.sidebarCollapsed)
      }
    }
    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(SETTINGS_SAVED_EVENT, onSettingsSaved)
    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(SETTINGS_SAVED_EVENT, onSettingsSaved)
    }
  }, [])

  const sidebarDisplayName = useMemo(
    () => (userPrefs.displayName || user?.name || 'Operator').trim() || 'Operator',
    [userPrefs.displayName, user?.name]
  )
  const sessionTimeoutMs = useMemo(() => {
    const configured = Number(userPrefs.sec_sessionTimeoutMin)
    const safeMinutes = Number.isNaN(configured) ? DEFAULT_SESSION_TIMEOUT_MIN : Math.max(5, configured)
    return safeMinutes * 60 * 1000
  }, [userPrefs.sec_sessionTimeoutMin])

  const auditEnabled = Boolean(userPrefs.sec_auditLogging)

  const writeAuditLog = useMemo(
    () => (action, detail = {}) => {
      if (!auditEnabled) return
      try {
        const existing = JSON.parse(localStorage.getItem(AUDIT_LOG_STORAGE_KEY) || '[]')
        const entry = {
          id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          action,
          detail,
        }
        existing.unshift(entry)
        localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(existing.slice(0, 500)))
      } catch {
        // ignore audit persistence failures
      }
    },
    [auditEnabled]
  )

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const theme = userPrefs.theme || 'dark'
    const accent = ACCENT_COLOR_MAP[userPrefs.accentColor] || ACCENT_COLOR_MAP.cyan
    const fontSize = userPrefs.fontSize || 'medium'
    const compact = Boolean(userPrefs.compactMode)
    const animationsEnabled = userPrefs.animationsEnabled !== false

    root.style.setProperty('--pw-accent', accent)
    root.dataset.pwTheme = theme
    body.classList.toggle('pw-compact', compact)
    body.classList.toggle('pw-reduced-motion', !animationsEnabled)
    body.classList.toggle('pw-font-small', fontSize === 'small')
    body.classList.toggle('pw-font-large', fontSize === 'large')
    body.classList.toggle('pw-font-medium', fontSize !== 'small' && fontSize !== 'large')

    writeAuditLog('ui_preferences_applied', {
      theme,
      accent: userPrefs.accentColor || 'cyan',
      fontSize,
      compact,
      animationsEnabled,
    })
  }, [
    userPrefs.theme,
    userPrefs.accentColor,
    userPrefs.fontSize,
    userPrefs.compactMode,
    userPrefs.animationsEnabled,
    writeAuditLog,
  ])

  useEffect(() => {
    if (sessionLocked) return undefined
    let timeoutId = null
    const armTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        setSessionLocked(true)
        writeAuditLog('session_locked_timeout', { timeoutMs: sessionTimeoutMs })
      }, sessionTimeoutMs)
    }
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    activityEvents.forEach((evt) => window.addEventListener(evt, armTimer, { passive: true }))
    armTimer()
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      activityEvents.forEach((evt) => window.removeEventListener(evt, armTimer))
    }
  }, [sessionTimeoutMs, sessionLocked, writeAuditLog])

  useEffect(() => {
    const handleAuthRequired = () => {
      logout()
      setAuthView('login')
      setVerificationEmail('')
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired)
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired)
  }, [logout])

  const navigateTo = (pageKey) => {
    setActivePage(pageKey)
    if (isMobile) setMobileSidebarOpen(false)
    writeAuditLog('navigation', { page: pageKey })
  }

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      const nextPrefs = { ...getStoredSettings(), sidebarCollapsed: next }
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextPrefs))
      window.dispatchEvent(new CustomEvent(SETTINGS_SAVED_EVENT, { detail: nextPrefs }))
      writeAuditLog('sidebar_toggle', { collapsed: next })
      return next
    })
  }

  const unlockSession = () => {
    setSessionLocked(false)
    writeAuditLog('session_unlocked')
  }

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const next = prev === 'en' ? 'vi' : 'en'
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
      } catch {
        // ignore storage failures
      }
      writeAuditLog('language_toggle', { language: next })
      return next
    })
  }

  if (authLoading) {
    return (
      <div className="session-lock" role="status" aria-live="polite">
        <div className="session-lock__card">
          <h2>Loading account...</h2>
          <p>Validating your authentication session.</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    if (authView === 'signup') {
      return (
        <Signup
          onSwitchToLogin={() => setAuthView('login')}
          onSignupSuccess={(email) => {
            setVerificationEmail(email)
            setAuthView('verify')
          }}
        />
      )
    }

    if (authView === 'verify') {
      return (
        <VerifyEmail
          email={verificationEmail}
          onVerifySuccess={() => setAuthView('login')}
          onCancel={() => setAuthView('signup')}
        />
      )
    }

    if (authView === 'forgot') {
      return (
        <ForgotPassword
          onBackToLogin={() => setAuthView('login')}
          onResetSuccess={() => setAuthView('login')}
        />
      )
    }

    if (mfaChallenge) {
      const handleMfaSubmit = async (e) => {
        e.preventDefault()
        setMfaError('')
        setMfaLoading(true)
        const result = await verifyMfaCode(mfaCode)
        setMfaLoading(false)
        if (!result.success) {
          setMfaError(result.error || 'Invalid code. Try again.')
        } else {
          setMfaCode('')
        }
      }

      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '1rem',
            padding: '3rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
              <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Two-Factor Authentication</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Enter the 6-digit code from your authenticator app.</p>
            </div>
            {mfaError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginBottom: '1rem',
                color: '#ef4444',
                fontSize: '0.85rem',
                textAlign: 'center'
              }}>{mfaError}</div>
            )}
            <form onSubmit={handleMfaSubmit}>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  letterSpacing: '0.5rem',
                  outline: 'none',
                  marginBottom: '1.5rem'
                }}
              />
              <button
                type="submit"
                disabled={mfaLoading || mfaCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: (mfaLoading || mfaCode.length !== 6)
                    ? 'rgba(100, 116, 139, 0.5)'
                    : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: (mfaLoading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
                }}
              >
                {mfaLoading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </div>
        </div>
      )
    }

    return (
      <Login
        onSwitchToSignup={() => setAuthView('signup')}
        onSwitchToForgotPassword={() => setAuthView('forgot')}
        onSwitchToVerifyEmail={(email) => {
          setVerificationEmail(email)
          setAuthView('verify')
        }}
      />
    )
  }

  const renderNavItems = () => (
    <Menu>
      {NAV_ITEMS.map(item => (
        <MenuItem
          key={item.key}
          active={activePage === item.key}
          className={activePage === item.key ? 'menu-item active' : 'menu-item'}
          onClick={() => navigateTo(item.key)}
          icon={item.icon}
        >
          {isVietnamese ? (VI_NAV_LABELS[item.key] || item.label) : item.label}
        </MenuItem>
      ))}
    </Menu>
  )

  return (
    <ProSidebarProvider>
      <div className={`layout${!isMobile && isSidebarCollapsed ? ' layout--sidebar-collapsed' : ''}${mobileSidebarOpen ? ' layout--mobile-nav-open' : ''}`}>
        <Sidebar collapsed={!isMobile && isSidebarCollapsed}>
          <div className="app-sidebar__header">
            <div className="app-sidebar__brand">
              <div className="app-sidebar__logo">
                <img src="/phantomwall-icon.png" alt="PhantomWall" />
              </div>
              <div>
                <h1>PhantomWall</h1>
                <p>{sidebarDisplayName}</p>
              </div>
            </div>
            {isMobile ? (
              mobileSidebarOpen && (
                <button
                  type="button"
                  className="mobile-nav-close"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Close navigation"
                >
                  ✕
                </button>
              )
            ) : (
              <button
                type="button"
                className="sidebar-toggle"
                onClick={handleToggleSidebar}
                aria-label={isSidebarCollapsed ? (isVietnamese ? 'Mở rộng điều hướng' : 'Expand navigation') : (isVietnamese ? 'Thu gọn điều hướng' : 'Collapse navigation')}
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
            )}
          </div>
          {renderNavItems()}
          <div className="app-sidebar__footer">
            <button
              type="button"
              className="app-sidebar__lang-toggle"
              onClick={toggleLanguage}
            >
              {isVietnamese ? '🇺🇸 EN' : '🇻🇳 VI'}
            </button>
            <button
              type="button"
              className="app-sidebar__lang-toggle"
              onClick={logout}
              title="Sign out"
            >
              {isVietnamese ? 'Đăng xuất' : 'Sign out'}
            </button>
            <div>v0.4 · {isVietnamese ? 'Du lieu thoi gian thuc' : 'Live telemetry'}</div>
          </div>
        </Sidebar>

        {mobileSidebarOpen && (
          <div
            className="mobile-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <main className="main">
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          {activePage === 'console' && <QuickAccess onNavigate={navigateTo} language={language} />}
          {activePage === 'traffic-view' && <TrafficView language={language} />}
          {activePage === 'alerts-ledger' && <AlertsLedger language={language} />}
          {activePage === 'fleet' && <HoneypotFleetManager language={language} />}
          {activePage === 'logs' && <S3LogExplorer language={language} />}
          {activePage === 'intel' && <IntelAnalytics language={language} />}
          {activePage === 'posture' && <CloudPosture language={language} />}
          {activePage === 'settings' && <Settings />}

        </main>

        <ChatAssistant />

        <OnboardingModal />

        {sessionLocked && (
          <div className="session-lock" role="dialog" aria-modal="true" aria-label={isVietnamese ? 'Phiên đã bị khóa' : 'Session locked'}>
            <div className="session-lock__card">
              <h2>{isVietnamese ? 'Phiên đã bị khóa' : 'Session Locked'}</h2>
              <p>
                {isVietnamese
                  ? `Thời gian chờ không hoạt động là ${Math.round(sessionTimeoutMs / 60000)} phút. Bấm bên dưới để tiếp tục phiên.`
                  : `Your idle timeout is set to ${Math.round(sessionTimeoutMs / 60000)} minutes. Click below to resume your session.`}
              </p>
              <button type="button" onClick={unlockSession}>{isVietnamese ? 'Tiếp tục phiên' : 'Resume Session'}</button>
            </div>
          </div>
        )}
      </div>
    </ProSidebarProvider>
  )
}


