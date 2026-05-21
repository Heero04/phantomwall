import React, { useState } from 'react'

export default function OrgOnboarding({ user, onComplete, onLogout }) {
  const [formData, setFormData] = useState({
    organizationName: '',
    awsAccountId: '',
    organizationId: '',
    roleArn: '',
    externalId: '',
    homeRegion: 'us-east-1',
  })

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onComplete(formData)
  }

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Organization Onboarding</h1>
          <p style={styles.subtitle}>
            Connect your AWS account so each customer can run PhantomWall in their own environment.
          </p>
          <p style={styles.userText}>Signed in as {user?.email || 'operator'}</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.fieldLabel}>
            Organization Name
            <input
              name="organizationName"
              value={formData.organizationName}
              onChange={handleChange}
              required
              placeholder="Acme Security"
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            AWS Account ID
            <input
              name="awsAccountId"
              value={formData.awsAccountId}
              onChange={handleChange}
              required
              placeholder="123456789012"
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            AWS Organization ID (optional)
            <input
              name="organizationId"
              value={formData.organizationId}
              onChange={handleChange}
              placeholder="o-123456abcd"
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            Cross-Account Role ARN
            <input
              name="roleArn"
              value={formData.roleArn}
              onChange={handleChange}
              required
              placeholder="arn:aws:iam::123456789012:role/PhantomWallReadOnlyRole"
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            External ID
            <input
              name="externalId"
              value={formData.externalId}
              onChange={handleChange}
              required
              placeholder="phantomwall-demo-external-id"
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            Home Region
            <select
              name="homeRegion"
              value={formData.homeRegion}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="us-east-1">us-east-1</option>
              <option value="us-east-2">us-east-2</option>
              <option value="us-west-2">us-west-2</option>
              <option value="eu-west-1">eu-west-1</option>
            </select>
          </label>

          <button type="submit" style={styles.primaryButton}>
            Save and Continue to Dashboard
          </button>
        </form>

        <button type="button" onClick={onLogout} style={styles.linkButton}>
          Sign out
        </button>
      </div>
    </div>
  )
}

const styles = {
  screen: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
  },
  card: {
    width: '100%',
    maxWidth: '680px',
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    borderRadius: '1rem',
    boxShadow: '0 22px 70px rgba(2, 6, 23, 0.6)',
    padding: '2rem',
  },
  header: {
    marginBottom: '1.5rem',
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: '1.7rem',
  },
  subtitle: {
    marginTop: '0.5rem',
    marginBottom: '0.5rem',
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  userText: {
    margin: 0,
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
  form: {
    display: 'grid',
    gap: '0.85rem',
  },
  fieldLabel: {
    color: '#e2e8f0',
    fontSize: '0.9rem',
    display: 'grid',
    gap: '0.35rem',
  },
  input: {
    border: '1px solid rgba(100, 116, 139, 0.4)',
    borderRadius: '0.5rem',
    background: 'rgba(15, 23, 42, 0.8)',
    color: '#f8fafc',
    padding: '0.65rem 0.75rem',
    fontSize: '0.95rem',
  },
  primaryButton: {
    marginTop: '0.75rem',
    border: 'none',
    borderRadius: '0.6rem',
    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    color: '#f8fafc',
    padding: '0.85rem 1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  linkButton: {
    marginTop: '1rem',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 0,
  },
}
