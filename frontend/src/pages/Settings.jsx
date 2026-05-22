import React, { useCallback, useEffect, useMemo, useState } from 'react'
import '../components/Settings.css'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

/* ═══════════════════════════════════════════════════════════════
   Defaults — persisted to localStorage
   ═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'phantomwall_settings'
const SETTINGS_SAVED_EVENT = 'phantomwall:settings-saved'

const DEFAULT_SETTINGS = {
  /* Profile */
  displayName: 'Lawrence',
  email: 'admin@phantomwall.io',
  role: 'Administrator',
  timezone: 'America/New_York',
  /* Notifications */
  notif_criticalAlerts: true,
  notif_highAlerts: true,
  notif_mediumAlerts: false,
  notif_lowAlerts: false,
  notif_fleetStatus: true,
  notif_costAlerts: true,
  notif_weeklyDigest: true,
  notif_sound: true,
  notif_email: false,
  notif_slack: false,
  notif_slackWebhook: '',
  /* API & Integrations */
  api_endpoint: API_URL || 'https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod',
  api_timeout: 30,
  api_retries: 3,
  api_rateLimitRpm: 100,
  api_key: '',
  api_showKey: false,
  /* Appearance */
  theme: 'dark',
  accentColor: 'cyan',
  sidebarCollapsed: false,
  animationsEnabled: true,
  compactMode: false,
  fontSize: 'medium',
  mapTileProvider: 'voyager',
  /* Data & Retention */
  data_autoRefreshSec: 30,
  data_retentionDays: 90,
  data_archiveEnabled: true,
  data_exportFormat: 'json',
  data_maxTableRows: 500,
  data_cacheEnabled: true,
  data_cacheTtlMin: 5,
  /* Security */
  sec_sessionTimeoutMin: 60,
  sec_mfaEnabled: true,
  sec_auditLogging: true,
  sec_ipWhitelist: '',
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

const ACCENT_COLORS = [
  { key: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { key: 'emerald', label: 'Emerald', hex: '#10b981' },
  { key: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { key: 'amber', label: 'Amber', hex: '#f59e0b' },
  { key: 'rose', label: 'Rose', hex: '#f43f5e' },
  { key: 'blue', label: 'Blue', hex: '#3b82f6' },
]

const MAP_PROVIDERS = [
  { key: 'voyager', label: 'CARTO Voyager (Colored)' },
  { key: 'dark', label: 'CARTO Dark Matter' },
  { key: 'light', label: 'CARTO Positron (Light)' },
  { key: 'osm', label: 'OpenStreetMap' },
]

const FONT_SIZES = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
]

const EXPORT_FORMATS = [
  { key: 'json', label: 'JSON' },
  { key: 'csv', label: 'CSV' },
  { key: 'parquet', label: 'Parquet' },
]

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

/* Toggle Switch */
const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    className={`settings__toggle ${checked ? 'settings__toggle--on' : ''}`}
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
  >
    <span className="settings__toggle-knob" />
  </button>
)

/* Section wrapper */
const Section = ({ icon, title, description, children, badge }) => (
  <section className="settings__section">
    <div className="settings__section-header">
      <div className="settings__section-title-row">
        <span className="settings__section-icon">{icon}</span>
        <div>
          <h3 className="settings__section-title">{title}{badge && <span className="settings__section-badge">{badge}</span>}</h3>
          {description && <p className="settings__section-desc">{description}</p>}
        </div>
      </div>
    </div>
    <div className="settings__section-body">{children}</div>
  </section>
)

/* Form row */
const FormRow = ({ label, hint, children, stacked = false }) => (
  <div className={`settings__row ${stacked ? 'settings__row--stacked' : ''}`}>
    <div className="settings__row-label">
      <span className="settings__label">{label}</span>
      {hint && <span className="settings__hint">{hint}</span>}
    </div>
    <div className="settings__row-control">{children}</div>
  </div>
)

/* ═══════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════ */
export default function Settings() {
  /* ── State ──────────────────────────────────────────────── */
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS }
    } catch { return { ...DEFAULT_SETTINGS } }
  })
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [apiTestResult, setApiTestResult] = useState(null)
  const [apiTesting, setApiTesting] = useState(false)
  const deployedLambdaCount = 10

  /* ── Helpers ────────────────────────────────────────────── */
  const update = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const save = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      window.dispatchEvent(new CustomEvent(SETTINGS_SAVED_EVENT, { detail: settings }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      console.error('Settings save failed:', e)
    }
  }, [settings])

  const resetAll = useCallback(() => {
    if (window.confirm('Reset all settings to defaults? This cannot be undone.')) {
      setSettings({ ...DEFAULT_SETTINGS })
      localStorage.removeItem(STORAGE_KEY)
      window.dispatchEvent(new CustomEvent(SETTINGS_SAVED_EVENT, { detail: { ...DEFAULT_SETTINGS } }))
      setSaved(false)
    }
  }, [])

  const testApiConnection = useCallback(async () => {
    setApiTesting(true)
    setApiTestResult(null)
    try {
      const start = performance.now()
      const base = (settings.api_endpoint || '').replace(/\/+$/, '')
      const probePaths = ['/health', '/metrics', '/events?limit=1']
      let finalResult = null
      for (const path of probePaths) {
        const res = await fetch(`${base}${path}`, {
          method: 'GET',
          signal: AbortSignal.timeout(settings.api_timeout * 1000),
        })
        if (res.ok) {
          finalResult = { ok: true, status: res.status, path }
          break
        }
        if (!finalResult) {
          finalResult = { ok: false, status: res.status, path }
        }
      }
      const latency = Math.round(performance.now() - start)
      setApiTestResult({ ...finalResult, latency })
    } catch (err) {
      setApiTestResult({ ok: false, error: err.message })
    } finally {
      setApiTesting(false)
    }
  }, [settings.api_endpoint, settings.api_timeout])

  const generateApiKey = useCallback(() => {
    const key = 'pw_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    update('api_key', key)
  }, [update])

  /* ── Tabs ───────────────────────────────────────────────── */
  const TABS = [
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'api', label: 'API & Integrations', icon: '🔌' },
    { key: 'appearance', label: 'Appearance', icon: '🎨' },
    { key: 'data', label: 'Data & Retention', icon: '💾' },
    { key: 'security', label: 'Security', icon: '🛡️' },
    { key: 'about', label: 'About', icon: 'ℹ️' },
  ]

  /* ── Changed count ──────────────────────────────────────── */
  const changedCount = Object.keys(settings).filter(k => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return settings[k] !== DEFAULT_SETTINGS[k]
      const parsed = JSON.parse(stored)
      return JSON.stringify(settings[k]) !== JSON.stringify(parsed[k])
    } catch { return false }
  }).length

  const apiGatewayId = useMemo(() => {
    try {
      const host = new URL(settings.api_endpoint).hostname
      const first = host.split('.')[0]
      return first || 'Not configured'
    } catch {
      return 'Not configured'
    }
  }, [settings.api_endpoint])

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="settings">
      {/* Hero */}
      <header className="settings__hero">
        <div className="settings__hero-text">
          <p className="settings__eyebrow">⚙️ Configuration</p>
          <h2>Settings</h2>
          <p className="settings__hero-sub">
            Manage your PhantomWall preferences, integrations, and system configuration.
          </p>
        </div>
        <div className="settings__hero-actions">
          <button className="settings__save-btn" onClick={save} disabled={changedCount === 0 && !saved}>
            {saved ? '✓ Saved' : changedCount > 0 ? `Save (${changedCount})` : 'Save'}
          </button>
          <button className="settings__reset-btn" onClick={resetAll}>Reset Defaults</button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="settings__tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`settings__tab ${activeTab === t.key ? 'settings__tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <span className="settings__tab-icon">{t.icon}</span>
            <span className="settings__tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="settings__content">

        {/* ─── Profile ─── */}
        {activeTab === 'profile' && (
          <Section icon="👤" title="Profile & Account" description="Your identity and account preferences.">
            <FormRow label="Display Name" hint="Shown in the sidebar and chat">
              <input
                type="text"
                className="settings__input"
                value={settings.displayName}
                onChange={e => update('displayName', e.target.value)}
                placeholder="Your name"
              />
            </FormRow>
            <FormRow label="Email" hint="Used for notifications and recovery">
              <input
                type="email"
                className="settings__input"
                value={settings.email}
                onChange={e => update('email', e.target.value)}
                placeholder="you@example.com"
              />
            </FormRow>
            <FormRow label="Role">
              <span className="settings__role-badge">{settings.role}</span>
            </FormRow>
            <FormRow label="Timezone">
              <select
                className="settings__select"
                value={settings.timezone}
                onChange={e => update('timezone', e.target.value)}
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
              </select>
            </FormRow>
          </Section>
        )}

        {/* ─── Notifications ─── */}
        {activeTab === 'notifications' && (
          <Section icon="🔔" title="Notification Preferences" description="Control which alerts reach you and how.">
            <div className="settings__notif-group">
              <h4 className="settings__subhead">Alert Severity Levels</h4>
              <FormRow label="Critical Alerts" hint="Severity 1 — always recommended">
                <Toggle checked={settings.notif_criticalAlerts} onChange={v => update('notif_criticalAlerts', v)} />
              </FormRow>
              <FormRow label="High Alerts" hint="Severity 2">
                <Toggle checked={settings.notif_highAlerts} onChange={v => update('notif_highAlerts', v)} />
              </FormRow>
              <FormRow label="Medium Alerts" hint="Severity 3">
                <Toggle checked={settings.notif_mediumAlerts} onChange={v => update('notif_mediumAlerts', v)} />
              </FormRow>
              <FormRow label="Low Alerts" hint="Severity 4 — informational">
                <Toggle checked={settings.notif_lowAlerts} onChange={v => update('notif_lowAlerts', v)} />
              </FormRow>
            </div>
            <div className="settings__notif-group">
              <h4 className="settings__subhead">System Notifications</h4>
              <FormRow label="Fleet Status Changes" hint="Instance start/stop/terminate">
                <Toggle checked={settings.notif_fleetStatus} onChange={v => update('notif_fleetStatus', v)} />
              </FormRow>
              <FormRow label="Cost Threshold Alerts" hint="When monthly spend exceeds budget">
                <Toggle checked={settings.notif_costAlerts} onChange={v => update('notif_costAlerts', v)} />
              </FormRow>
              <FormRow label="Weekly Digest" hint="Summary email every Monday">
                <Toggle checked={settings.notif_weeklyDigest} onChange={v => update('notif_weeklyDigest', v)} />
              </FormRow>
            </div>
            <div className="settings__notif-group">
              <h4 className="settings__subhead">Delivery Channels</h4>
              <FormRow label="In-App Sound">
                <Toggle checked={settings.notif_sound} onChange={v => update('notif_sound', v)} />
              </FormRow>
              <FormRow label="Email Notifications">
                <Toggle checked={settings.notif_email} onChange={v => update('notif_email', v)} />
              </FormRow>
              <FormRow label="Slack Integration">
                <Toggle checked={settings.notif_slack} onChange={v => update('notif_slack', v)} />
              </FormRow>
              {settings.notif_slack && (
                <FormRow label="Slack Webhook URL" hint="Incoming webhook for your channel">
                  <input
                    type="url"
                    className="settings__input"
                    value={settings.notif_slackWebhook}
                    onChange={e => update('notif_slackWebhook', e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </FormRow>
              )}
            </div>
          </Section>
        )}

        {/* ─── API & Integrations ─── */}
        {activeTab === 'api' && (
          <Section icon="🔌" title="API & Integrations" description="Configure API endpoints, keys, and rate limits.">
            <FormRow label="API Endpoint" hint="PhantomWall REST API base URL">
              <div className="settings__input-group">
                <input
                  type="url"
                  className="settings__input settings__input--wide"
                  value={settings.api_endpoint}
                  onChange={e => update('api_endpoint', e.target.value)}
                />
                <button
                  className="settings__inline-btn"
                  onClick={testApiConnection}
                  disabled={apiTesting}
                >
                  {apiTesting ? 'Testing…' : 'Test'}
                </button>
              </div>
              {apiTestResult && (
                <div className={`settings__api-result ${apiTestResult.ok ? 'settings__api-result--ok' : 'settings__api-result--fail'}`}>
                  {apiTestResult.ok
                    ? `✓ Connected via ${apiTestResult.path} — ${apiTestResult.status} (${apiTestResult.latency}ms)`
                    : `✗ Failed — ${apiTestResult.error || `${apiTestResult.path || 'probe'} returned status ${apiTestResult.status}`}`}
                </div>
              )}
            </FormRow>
            <FormRow label="Request Timeout" hint="Seconds before API calls abort">
              <div className="settings__slider-row">
                <input
                  type="range"
                  min={5} max={120} step={5}
                  className="settings__slider"
                  value={settings.api_timeout}
                  onChange={e => update('api_timeout', +e.target.value)}
                />
                <span className="settings__slider-value">{settings.api_timeout}s</span>
              </div>
            </FormRow>
            <FormRow label="Max Retries" hint="Automatic retry on failure">
              <select
                className="settings__select settings__select--sm"
                value={settings.api_retries}
                onChange={e => update('api_retries', +e.target.value)}
              >
                {[0, 1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </FormRow>
            <FormRow label="Rate Limit" hint="Requests per minute">
              <div className="settings__slider-row">
                <input
                  type="range"
                  min={10} max={500} step={10}
                  className="settings__slider"
                  value={settings.api_rateLimitRpm}
                  onChange={e => update('api_rateLimitRpm', +e.target.value)}
                />
                <span className="settings__slider-value">{settings.api_rateLimitRpm} rpm</span>
              </div>
            </FormRow>
            <FormRow label="API Key" hint="Used for external integrations">
              <div className="settings__input-group">
                <input
                  type={settings.api_showKey ? 'text' : 'password'}
                  className="settings__input settings__input--mono settings__input--wide"
                  value={settings.api_key}
                  onChange={e => update('api_key', e.target.value)}
                  placeholder="No key generated"
                  readOnly
                />
                <button className="settings__inline-btn" onClick={() => update('api_showKey', !settings.api_showKey)}>
                  {settings.api_showKey ? 'Hide' : 'Show'}
                </button>
                <button className="settings__inline-btn settings__inline-btn--accent" onClick={generateApiKey}>
                  Generate
                </button>
              </div>
            </FormRow>
          </Section>
        )}

        {/* ─── Appearance ─── */}
        {activeTab === 'appearance' && (
          <Section icon="🎨" title="Appearance" description="Customize the look and feel of PhantomWall.">
            <FormRow label="Theme">
              <div className="settings__theme-picker">
                {['dark', 'light', 'system'].map(t => {
                  const implemented = t === 'dark'
                  return (
                    <button
                      key={t}
                      className={`settings__theme-btn ${settings.theme === t ? 'settings__theme-btn--active' : ''} ${!implemented ? 'settings__theme-btn--disabled' : ''}`}
                      onClick={() => implemented && update('theme', t)}
                      disabled={!implemented}
                      title={!implemented ? 'Coming soon' : ''}
                    >
                      <span className="settings__theme-preview" data-theme={t} />
                      <span>{t.charAt(0).toUpperCase() + t.slice(1)}{!implemented ? ' (soon)' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </FormRow>
            <FormRow label="Accent Color">
              <div className="settings__color-picker">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c.key}
                    className={`settings__color-swatch ${settings.accentColor === c.key ? 'settings__color-swatch--active' : ''}`}
                    style={{ '--swatch': c.hex }}
                    onClick={() => update('accentColor', c.key)}
                    title={c.label}
                  />
                ))}
              </div>
            </FormRow>
            <FormRow label="Font Size">
              <div className="settings__radio-group">
                {FONT_SIZES.map(f => (
                  <label key={f.key} className="settings__radio">
                    <input
                      type="radio"
                      name="fontSize"
                      checked={settings.fontSize === f.key}
                      onChange={() => update('fontSize', f.key)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </FormRow>
            <FormRow label="Map Tile Provider" hint="Tile style for IntelAnalytics map">
              <select
                className="settings__select"
                value={settings.mapTileProvider}
                onChange={e => update('mapTileProvider', e.target.value)}
              >
                {MAP_PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </FormRow>
            <FormRow label="Animations">
              <Toggle checked={settings.animationsEnabled} onChange={v => update('animationsEnabled', v)} />
            </FormRow>
            <FormRow label="Compact Mode" hint="Tighter spacing and smaller cards">
              <Toggle checked={settings.compactMode} onChange={v => update('compactMode', v)} />
            </FormRow>
            <FormRow label="Sidebar Default Collapsed">
              <Toggle checked={settings.sidebarCollapsed} onChange={v => update('sidebarCollapsed', v)} />
            </FormRow>
          </Section>
        )}

        {/* ─── Data & Retention ─── */}
        {activeTab === 'data' && (
          <Section icon="💾" title="Data & Retention" description="Auto-refresh, caching, exports, and retention policies.">
            <FormRow label="Auto-Refresh Interval" hint="How often dashboards pull new data">
              <div className="settings__slider-row">
                <input
                  type="range"
                  min={5} max={120} step={5}
                  className="settings__slider"
                  value={settings.data_autoRefreshSec}
                  onChange={e => update('data_autoRefreshSec', +e.target.value)}
                />
                <span className="settings__slider-value">{settings.data_autoRefreshSec}s</span>
              </div>
            </FormRow>
            <FormRow label="Data Retention" hint="Days before events archive to Glacier">
              <div className="settings__slider-row">
                <input
                  type="range"
                  min={7} max={365} step={7}
                  className="settings__slider"
                  value={settings.data_retentionDays}
                  onChange={e => update('data_retentionDays', +e.target.value)}
                />
                <span className="settings__slider-value">{settings.data_retentionDays} days</span>
              </div>
            </FormRow>
            <FormRow label="Auto-Archive to Glacier">
              <Toggle checked={settings.data_archiveEnabled} onChange={v => update('data_archiveEnabled', v)} />
            </FormRow>
            <FormRow label="Default Export Format">
              <div className="settings__radio-group">
                {EXPORT_FORMATS.map(f => (
                  <label key={f.key} className="settings__radio">
                    <input
                      type="radio"
                      name="exportFormat"
                      checked={settings.data_exportFormat === f.key}
                      onChange={() => update('data_exportFormat', f.key)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </FormRow>
            <FormRow label="Max Table Rows" hint="Limit rows fetched per table view">
              <select
                className="settings__select settings__select--sm"
                value={settings.data_maxTableRows}
                onChange={e => update('data_maxTableRows', +e.target.value)}
              >
                {[100, 250, 500, 1000, 2500].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}
              </select>
            </FormRow>
            <FormRow label="Client-Side Cache">
              <Toggle checked={settings.data_cacheEnabled} onChange={v => update('data_cacheEnabled', v)} />
            </FormRow>
            {settings.data_cacheEnabled && (
              <FormRow label="Cache TTL" hint="Minutes before cached data expires">
                <div className="settings__slider-row">
                  <input
                    type="range"
                    min={1} max={30} step={1}
                    className="settings__slider"
                    value={settings.data_cacheTtlMin}
                    onChange={e => update('data_cacheTtlMin', +e.target.value)}
                  />
                  <span className="settings__slider-value">{settings.data_cacheTtlMin} min</span>
                </div>
              </FormRow>
            )}
          </Section>
        )}

        {/* ─── Security ─── */}
        {activeTab === 'security' && (
          <Section icon="🛡️" title="Security" description="Session management, MFA, and audit logging.">
            <FormRow label="Session Timeout" hint="Minutes of inactivity before auto-logout">
              <div className="settings__slider-row">
                <input
                  type="range"
                  min={5} max={480} step={5}
                  className="settings__slider"
                  value={settings.sec_sessionTimeoutMin}
                  onChange={e => update('sec_sessionTimeoutMin', +e.target.value)}
                />
                <span className="settings__slider-value">{settings.sec_sessionTimeoutMin} min</span>
              </div>
            </FormRow>
            <FormRow label="Multi-Factor Authentication" hint="Require MFA for sign-in">
              <Toggle checked={settings.sec_mfaEnabled} onChange={v => update('sec_mfaEnabled', v)} />
            </FormRow>
            <FormRow label="Audit Logging" hint="Log all user actions for compliance">
              <Toggle checked={settings.sec_auditLogging} onChange={v => update('sec_auditLogging', v)} />
            </FormRow>
            <FormRow label="IP Whitelist" hint="Comma-separated CIDRs (leave blank for any)" stacked>
              <input
                type="text"
                className="settings__input settings__input--mono"
                value={settings.sec_ipWhitelist}
                onChange={e => update('sec_ipWhitelist', e.target.value)}
                placeholder="e.g. 10.0.0.0/8, 192.168.1.0/24"
              />
            </FormRow>
          </Section>
        )}

        {/* ─── About ─── */}
        {activeTab === 'about' && (
          <Section icon="ℹ️" title="About PhantomWall" description="System information and version details.">
            <div className="settings__about-grid">
              <div className="settings__about-card">
                <span className="settings__about-label">Application</span>
                <span className="settings__about-value">PhantomWall</span>
              </div>
              <div className="settings__about-card">
                <span className="settings__about-label">Version</span>
                <span className="settings__about-value settings__about-value--mono">v0.4.0-beta</span>
              </div>
              <div className="settings__about-card">
                <span className="settings__about-label">Environment</span>
                <span className="settings__about-value settings__about-value--mono">dev</span>
              </div>
              <div className="settings__about-card">
                <span className="settings__about-label">Region</span>
                <span className="settings__about-value settings__about-value--mono">us-east-1</span>
              </div>
              <div className="settings__about-card">
                <span className="settings__about-label">Stack</span>
                <span className="settings__about-value">React 18 · Vite · Terraform</span>
              </div>
              <div className="settings__about-card">
                <span className="settings__about-label">API Gateway</span>
                <span className="settings__about-value settings__about-value--mono">{apiGatewayId}</span>
              </div>
              <div className="settings__about-card">
                <span className="settings__about-label">Lambda Functions</span>
                <span className="settings__about-value">{deployedLambdaCount} deployed</span>
              </div>
              <div className="settings__about-card">
                <span className="settings__about-label">Last Deploy</span>
                <span className="settings__about-value">Feb 22, 2026</span>
              </div>
            </div>
            <div className="settings__about-footer">
              <p>Built by <strong>Lawrence</strong> — Heero04/phantomwall</p>
              <p className="settings__about-copy">Honeypot-as-a-Service threat monitoring platform. All data is processed in your own AWS account.</p>
            </div>
          </Section>
        )}
      </div>

      {/* Floating save bar */}
      {changedCount > 0 && (
        <div className="settings__save-bar">
          <span className="settings__save-bar-text">
            {changedCount} unsaved change{changedCount !== 1 ? 's' : ''}
          </span>
          <div className="settings__save-bar-actions">
            <button className="settings__save-bar-discard" onClick={() => {
              try {
                const stored = localStorage.getItem(STORAGE_KEY)
                setSettings(stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS })
              } catch { setSettings({ ...DEFAULT_SETTINGS }) }
            }}>Discard</button>
            <button className="settings__save-bar-save" onClick={save}>Save Changes</button>
          </div>
        </div>
      )}
    </div>
  )
}
