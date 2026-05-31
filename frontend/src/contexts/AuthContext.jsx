import React, { createContext, useState, useContext, useEffect } from 'react';

// Auth Context
export const AuthContext = createContext(null);

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

const AUTH_CONFIG_ERROR = 'Authentication is not configured yet. Please refresh and try again in a moment.';

const simplifyCognitoError = (data, fallbackMessage) => {
  const type = String(data?.__type || data?.code || '').split('#').pop();
  const message = String(data?.message || data?.Message || '').trim();

  if (!COGNITO_CONFIG.clientId || /clientid/i.test(message)) {
    return AUTH_CONFIG_ERROR;
  }

  if (type === 'NotAuthorizedException' || /incorrect username or password/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (type === 'UserNotConfirmedException') {
    return 'Please verify your email before signing in.';
  }
  if (type === 'UserNotFoundException') {
    return 'No account was found for that email.';
  }
  if (type === 'CodeMismatchException') {
    return 'That verification code is invalid. Please try again.';
  }
  if (type === 'ExpiredCodeException') {
    return 'That code has expired. Please request a new one.';
  }
  if (type === 'LimitExceededException') {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (type === 'InvalidPasswordException') {
    return 'Password does not meet requirements. Use at least 12 chars with upper/lowercase, number, and symbol.';
  }

  return message || fallbackMessage;
};

const getConfigErrorIfMissing = () => {
  if (!COGNITO_CONFIG.clientId) return AUTH_CONFIG_ERROR;
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [mfaChallenge, setMfaChallenge] = useState(null);

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
      setInitializing(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    setLoading(true);

    try {
      const configError = getConfigErrorIfMissing();
      if (configError) throw new Error(configError);

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
        throw new Error(simplifyCognitoError(data, 'Login failed.'));
      }

      if (data.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        setMfaChallenge({ session: data.Session, email });
        return { success: false, mfaRequired: true };
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
      const configError = getConfigErrorIfMissing();
      if (configError) throw new Error(configError);

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
        throw new Error(simplifyCognitoError(data, 'Sign-up failed.'));
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
      const configError = getConfigErrorIfMissing();
      if (configError) throw new Error(configError);

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
        throw new Error(simplifyCognitoError(data, 'Verification failed.'));
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
    if (!COGNITO_CONFIG.clientId) {
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
      const configError = getConfigErrorIfMissing();
      if (configError) throw new Error(configError);

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
        throw new Error(simplifyCognitoError(data, 'Failed to resend code.'));
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
      const configError = getConfigErrorIfMissing();
      if (configError) throw new Error(configError);

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
        throw new Error(simplifyCognitoError(data, 'Password reset request failed.'));
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
      const configError = getConfigErrorIfMissing();
      if (configError) throw new Error(configError);

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
        throw new Error(simplifyCognitoError(data, 'Password reset failed.'));
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const verifyMfaCode = async (code) => {
    setError(null);
    setLoading(true);

    try {
      if (!mfaChallenge) throw new Error('No MFA challenge in progress.');

      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
          },
          body: JSON.stringify({
            ChallengeName: 'SOFTWARE_TOKEN_MFA',
            ClientId: COGNITO_CONFIG.clientId,
            Session: mfaChallenge.session,
            ChallengeResponses: {
              USERNAME: mfaChallenge.email,
              SOFTWARE_TOKEN_MFA_CODE: code,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(simplifyCognitoError(data, 'MFA verification failed.'));
      }

      const { IdToken, AccessToken, RefreshToken } = data.AuthenticationResult;
      const payload = JSON.parse(atob(IdToken.split('.')[1]));
      const userInfo = {
        email: payload.email,
        sub: payload.sub,
        name: payload.name || payload.email,
        organization: payload['custom:organization'] || '',
      };

      localStorage.setItem('idToken', IdToken);
      localStorage.setItem('accessToken', AccessToken);
      localStorage.setItem('refreshToken', RefreshToken);
      localStorage.setItem('userInfo', JSON.stringify(userInfo));

      setUser(userInfo);
      setMfaChallenge(null);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const setupMfa = async () => {
    setError(null);
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) throw new Error('You must be logged in to set up MFA.');

      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.AssociateSoftwareToken',
          },
          body: JSON.stringify({ AccessToken: accessToken }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(simplifyCognitoError(data, 'MFA setup failed.'));

      return { success: true, secretCode: data.SecretCode };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const verifyMfaSetup = async (code) => {
    setError(null);
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) throw new Error('You must be logged in to verify MFA.');

      const response = await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.VerifySoftwareToken',
          },
          body: JSON.stringify({
            AccessToken: accessToken,
            UserCode: code,
            FriendlyDeviceName: 'PhantomWall Authenticator',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(simplifyCognitoError(data, 'MFA verification failed.'));

      // Enable MFA preference for the user
      await fetch(
        `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.SetUserMFAPreference',
          },
          body: JSON.stringify({
            AccessToken: accessToken,
            SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
          }),
        }
      );

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const getIdToken = () => localStorage.getItem('idToken');
  const getAccessToken = () => localStorage.getItem('accessToken');

  const value = {
    user,
    loading,
    initializing,
    error,
    mfaChallenge,
    login,
    signup,
    confirmSignup,
    resendConfirmationCode,
    logout,
    forgotPassword,
    confirmForgotPassword,
    verifyMfaCode,
    setupMfa,
    verifyMfaSetup,
    getIdToken,
    getAccessToken,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
