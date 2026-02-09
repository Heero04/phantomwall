import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ForgotPassword = ({ onBackToLogin, onResetSuccess }) => {
  const { forgotPassword, confirmForgotPassword } = useAuth();
  const [step, setStep] = useState('request'); // 'request' or 'confirm'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 12) errors.push('at least 12 characters');
    if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
    if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
    if (!/[0-9]/.test(password)) errors.push('one number');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('one special character');
    
    return errors.length > 0 ? `Password must contain ${errors.join(', ')}` : null;
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await forgotPassword(email);
    
    if (result.success) {
      setStep('confirm');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    const result = await confirmForgotPassword(email, code, newPassword);
    
    if (result.success) {
      onResetSuccess();
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

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
        maxWidth: '480px',
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(100, 116, 139, 0.3)',
        borderRadius: '1rem',
        padding: '3rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 1rem',
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)'
          }}>
            🔑
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '0.5rem'
          }}>
            {step === 'request' ? 'Reset Password' : 'Create New Password'}
          </h1>
          <p style={{
            fontSize: '0.9rem',
            color: '#94a3b8'
          }}>
            {step === 'request' 
              ? 'Enter your email to receive a reset code' 
              : `Code sent to ${email}`
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#ef4444',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {/* Request Code Form */}
        {step === 'request' && (
          <form onSubmit={handleRequestCode}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(245, 158, 11, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: loading 
                  ? 'rgba(100, 116, 139, 0.5)' 
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: loading ? 'none' : '0 0 20px rgba(245, 158, 11, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.3)';
                }
              }}
            >
              {loading ? 'Sending code...' : 'Send Reset Code'}
            </button>
          </form>
        )}

        {/* Confirm Reset Form */}
        {step === 'confirm' && (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  letterSpacing: '0.5rem',
                  outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(245, 158, 11, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(245, 158, 11, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
              />
              <p style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginTop: '0.5rem'
              }}>
                12+ characters, uppercase, lowercase, number, symbol
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(245, 158, 11, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: loading 
                  ? 'rgba(100, 116, 139, 0.5)' 
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: loading ? 'none' : '0 0 20px rgba(245, 158, 11, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.3)';
                }
              }}
            >
              {loading ? 'Resetting password...' : 'Reset Password'}
            </button>

            {/* Resend Code */}
            <div style={{
              marginTop: '1.5rem',
              textAlign: 'center'
            }}>
              <button
                type="button"
                onClick={() => setStep('request')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f59e0b',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.5rem',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(245, 158, 11, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'none';
                }}
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {/* Back to Login */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(100, 116, 139, 0.2)',
          textAlign: 'center'
        }}>
          <button
            onClick={onBackToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.85rem'
            }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
