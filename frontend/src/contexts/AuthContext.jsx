import React, { createContext, useState, useContext, useEffect } from 'react';

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Cognito Configuration (populated by Terraform outputs)
const COGNITO_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('idToken');
      const userInfo = localStorage.getItem('userInfo');
      
      if (token && userInfo) {
        // Validate token expiration
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiry = payload.exp * 1000;
        
        if (Date.now() < expiry) {
          setUser(JSON.parse(userInfo));
        } else {
          // Token expired, try to refresh
          await refreshSession();
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
          },
          body: JSON.stringify({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: COGNITO_CONFIG.clientId,
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Handle successful authentication
      const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
      
      // Decode ID token to get user info
      const payload = JSON.parse(atob(IdToken.split('.')[1]));
      const userInfo = {
        email: payload.email,
        sub: payload.sub,
        name: payload.name || payload.email,
        organization: payload['custom:organization'] || '',
      };

      // Store tokens and user info
      localStorage.setItem('idToken', IdToken);
      localStorage.setItem('accessToken', AccessToken);
      localStorage.setItem('refreshToken', RefreshToken);
      localStorage.setItem('userInfo', JSON.stringify(userInfo));

      setUser(userInfo);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, name, organization) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
          },
          body: JSON.stringify({
            ClientId: COGNITO_CONFIG.clientId,
            Username: email,
            Password: password,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'name', Value: name },
              { Name: 'custom:organization', Value: organization || '' },
            ],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      return { success: true, userSub: data.UserSub };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const confirmSignup = async (email, code) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp',
          },
          body: JSON.stringify({
            ClientId: COGNITO_CONFIG.clientId,
            Username: email,
            ConfirmationCode: code,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Confirmation failed');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      logout();
      return;
    }

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
          },
          body: JSON.stringify({
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: COGNITO_CONFIG.clientId,
            AuthParameters: {
              REFRESH_TOKEN: refreshToken,
            },
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const { IdToken, AccessToken } = data.AuthenticationResult;
        localStorage.setItem('idToken', IdToken);
        localStorage.setItem('accessToken', AccessToken);
        
        const payload = JSON.parse(atob(IdToken.split('.')[1]));
        const userInfo = {
          email: payload.email,
          sub: payload.sub,
          name: payload.name || payload.email,
          organization: payload['custom:organization'] || '',
        };
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        setUser(userInfo);
      } else {
        logout();
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
    setUser(null);
  };

  const resendConfirmationCode = async (email) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ResendConfirmationCode',
          },
          body: JSON.stringify({
            ClientId: COGNITO_CONFIG.clientId,
            Username: email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend code');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ForgotPassword',
          },
          body: JSON.stringify({
            ClientId: COGNITO_CONFIG.clientId,
            Username: email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset request failed');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const confirmForgotPassword = async (email, code, newPassword) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
          },
          body: JSON.stringify({
            ClientId: COGNITO_CONFIG.clientId,
            Username: email,
            ConfirmationCode: code,
            Password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset failed');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const getIdToken = () => localStorage.getItem('idToken');
  const getAccessToken = () => localStorage.getItem('accessToken');

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    confirmSignup,
    resendConfirmationCode,
    logout,
    forgotPassword,
    confirmForgotPassword,
    getIdToken,
    getAccessToken,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
