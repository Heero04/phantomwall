import React, { createContext, useContext } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const MockAuthProvider = ({ children }) => {
  const mockAuth = {
    user: null,
    loading: false,
    error: null,
    
    login: async (email, password) => {
      console.log('Mock login:', email);
      return { success: true };
    },
    
    signup: async (email, password, name, organization) => {
      console.log('Mock signup:', email, name);
      return { success: true };
    },
    
    confirmSignup: async (email, code) => {
      console.log('Mock confirm signup:', email, code);
      return { success: true };
    },
    
    resendConfirmationCode: async (email) => {
      console.log('Mock resend code:', email);
      return { success: true };
    },
    
    forgotPassword: async (email) => {
      console.log('Mock forgot password:', email);
      return { success: true };
    },
    
    confirmForgotPassword: async (email, code, newPassword) => {
      console.log('Mock confirm forgot password:', email, code);
      return { success: true };
    },
    
    logout: () => {
      console.log('Mock logout');
    },
    
    getIdToken: () => 'mock-token',
    getAccessToken: () => 'mock-access-token',
    isAuthenticated: false,
  };

  return <AuthContext.Provider value={mockAuth}>{children}</AuthContext.Provider>;
};
