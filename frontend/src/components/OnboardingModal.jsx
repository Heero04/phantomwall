import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'phantomwall_onboarding_dismissed';

const SECTIONS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 10 14 11 22 21 10 14 10 13 2" />
      </svg>
    ),
    title: 'Command Center',
    desc: 'Real-time overview, fleet status, and quick actions',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </svg>
    ),
    title: 'Traffic Ledger',
    desc: 'Live network event stream from honeypot sensors',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="7" height="5" rx="1" />
        <rect x="14" y="6" width="7" height="5" rx="1" />
        <rect x="8.5" y="15" width="7" height="5" rx="1" />
        <path d="M10 8.5h4M12 11v4" />
      </svg>
    ),
    title: 'Fleet Manager',
    desc: 'Deploy and manage decoy nodes across AWS regions',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: 'Intel & Analytics',
    desc: 'Threat intelligence, attack mapping, and trend analysis',
  },
];

export default function OnboardingModal({ onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* ignore */ }
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <div className="onboarding-modal" role="dialog" aria-modal="true" aria-label="Welcome to PhantomWall">
      <div className="onboarding-modal__backdrop" onClick={handleDismiss} aria-hidden="true" />
      <div className="onboarding-modal__card">
        <div className="onboarding-modal__logo">
          <img src="/phantomwall-icon.png" alt="" width="48" height="48" />
        </div>
        <h2>Welcome to PhantomWall</h2>
        <p className="onboarding-modal__pitch">
          A cloud honeypot security platform for detecting and investigating attacker behavior.
        </p>

        <div className="onboarding-modal__sections">
          {SECTIONS.map((s) => (
            <div key={s.title} className="onboarding-modal__section">
              <div className="onboarding-modal__section-icon">{s.icon}</div>
              <div>
                <strong>{s.title}</strong>
                <span>{s.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="onboarding-modal__note">
          This showcase uses simulated data for demonstration purposes.
        </p>

        <button
          type="button"
          className="onboarding-modal__cta"
          onClick={handleDismiss}
        >
          Got it, explore the dashboard
        </button>
      </div>
    </div>
  );
}
