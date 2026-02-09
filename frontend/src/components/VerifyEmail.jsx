import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const VerifyEmail = ({ email, onVerifySuccess, onCancel }) => {
  const { confirmSignup, resendConfirmationCode } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await confirmSignup(email, code);
    
    if (result.success) {
      onVerifySuccess();
    } else {
      setError(result.error || 'Invalid verification code');
    }
    
    setLoading(false);
  };

  const handleResend = async () => {
    setResendSuccess(false);
    setError('');
    const result = await resendConfirmationCode(email);
    if (result.success) {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } else {
      setError(result.error);
    }
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
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 1rem',
            boxShadow: '0 0 30px rgba(6, 182, 212, 0.4)'
          }}>
            📧
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '0.5rem'
          }}>
            Verify Your Email
          </h1>
          <p style={{
            fontSize: '0.9rem',
            color: '#94a3b8',
            lineHeight: 1.6
          }}>
            We've sent a 6-digit code to<br />
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>{email}</span>
          </p>
        </div>

        {/* Success Message */}
        {resendSuccess && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#22c55e',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            ✓ New code sent successfully
          </div>
        )}

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

        {/* Verification Form */}
        <form onSubmit={handleSubmit}>
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
                transition: 'all 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(6, 182, 212, 0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
            />
            <p style={{
              fontSize: '0.75rem',
              color: '#64748b',
              marginTop: '0.5rem',
              textAlign: 'center'
            }}>
              Enter the 6-digit code from your email
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              width: '100%',
              padding: '1rem',
              background: (loading || code.length !== 6) 
                ? 'rgba(100, 116, 139, 0.5)' 
                : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: (loading || code.length !== 6) ? 'none' : '0 0 20px rgba(6, 182, 212, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!loading && code.length === 6) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && code.length === 6) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.3)';
              }
            }}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        {/* Resend Code */}
        <div style={{
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '0.9rem',
            color: '#94a3b8',
            marginBottom: '0.75rem'
          }}>
            Didn't receive the code?
          </p>
          <button
            onClick={handleResend}
            style={{
              background: 'none',
              border: 'none',
              color: '#06b6d4',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              borderRadius: '0.5rem',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(6, 182, 212, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            Resend Code
          </button>
        </div>

        {/* Cancel Link */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(100, 116, 139, 0.2)',
          textAlign: 'center'
        }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.85rem'
            }}
          >
            ← Back to signup
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
