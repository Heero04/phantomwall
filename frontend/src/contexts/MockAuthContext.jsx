import React, { useState } from 'react';
import { AuthContext } from './AuthContext';

export const MockAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const mockAuth = {
    user,
    loading,
    error,

    login: async (email, password) => {
      setLoading(true)
      setError(null)
      setUser({
        email,
        sub: `mock-${Date.now()}`,
        name: email.split('@')[0] || 'Demo User',
        organization: 'Demo Organization',
      })
      setLoading(false)
      return { success: true };
    },

    signup: async (email, password, name, organization) => {
      return { success: true };
    },

    confirmSignup: async (email, code) => {
      return { success: true };
    },

    resendConfirmationCode: async (email) => {
      return { success: true };
    },

    forgotPassword: async (email) => {
      return { success: true };
    },

    confirmForgotPassword: async (email, code, newPassword) => {
      return { success: true };
    },

    logout: () => {
      setUser(null)
    },

    getIdToken: () => 'mock-token',
    getAccessToken: () => 'mock-access-token',
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={mockAuth}>{children}</AuthContext.Provider>;
};
