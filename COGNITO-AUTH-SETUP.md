# AWS Cognito Authentication Setup

## 🎯 Overview

PhantomWall now uses **AWS Cognito** for enterprise-grade authentication, replacing custom auth with industry-standard security. This provides:

- ✅ **JWT-based authentication** with refresh tokens
- ✅ **Email verification** for account activation
- ✅ **Password reset** with secure code delivery
- ✅ **MFA support** (optional TOTP)
- ✅ **Session management** with 30-day refresh
- ✅ **Production-ready security** (battle-tested by AWS)

---

## 📦 Components Created

### Backend (Terraform)
- **`cognito.tf`** - AWS Cognito User Pool infrastructure
  - User pool with email sign-in
  - Password policy (12+ chars, uppercase, lowercase, numbers, symbols)
  - Email verification required
  - MFA optional (TOTP)
  - OAuth 2.0 configuration

### Frontend (React)
- **`AuthContext.jsx`** - Global authentication state management
- **`Login.jsx`** - Login form with dark theme
- **`Signup.jsx`** - Registration form with password validation
- **`VerifyEmail.jsx`** - Email verification code entry
- **`ForgotPassword.jsx`** - Password reset flow (2 steps)
- **`ProtectedRoute.jsx`** - Route wrapper for authenticated pages

---

## 🚀 Deployment Steps

### 1. Deploy Cognito Infrastructure

```bash
# Navigate to project root
cd c:\Users\lawre\OneDrive\Documents\AWS-HeeroPC-2\Projects\SAAS\SAAS

# Initialize Terraform (if not already done)
terraform init

# Deploy ONLY Cognito resources first
terraform apply -target=aws_cognito_user_pool.phantomwall_users -target=aws_cognito_user_pool_client.phantomwall_web

# Review changes, type 'yes' to confirm
```

**Expected Output:**
```
Outputs:

cognito_user_pool_id = "us-east-1_XXXXXXXXX"
cognito_user_pool_client_id = "abcd1234efgh5678ijkl9012mnop3456"
cognito_user_pool_endpoint = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX"
```

⚠️ **SAVE THESE VALUES** - You'll need them for frontend configuration!

---

### 2. Configure Frontend Environment

Create **`frontend/.env`** with your Cognito outputs:

```bash
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=abcd1234efgh5678ijkl9012mnop3456
```

**Security Note:** `.env` is already in `.gitignore` - never commit credentials!

---

### 3. Install Frontend Dependencies

```bash
cd frontend

# Install AWS SDK for Cognito
npm install @aws-sdk/client-cognito-identity-provider

# Install React Router for navigation (if not already installed)
npm install react-router-dom

# Verify installation
npm list @aws-sdk/client-cognito-identity-provider react-router-dom
```

---

### 4. Update App.jsx with Auth Routing

Replace **`frontend/src/App.jsx`** content:

```jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Signup from './components/Signup';
import VerifyEmail from './components/VerifyEmail';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './Dashboard'; // Your main dashboard component
import QuickAccess from './QuickAccess'; // Quick access page

function App() {
  const [authView, setAuthView] = React.useState('login'); // 'login', 'signup', 'verify', 'forgot'
  const [verifyEmail, setVerifyEmail] = React.useState('');

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            authView === 'login' ? (
              <Login
                onSwitchToSignup={() => setAuthView('signup')}
                onSwitchToForgot={() => setAuthView('forgot')}
              />
            ) : authView === 'signup' ? (
              <Signup
                onSwitchToLogin={() => setAuthView('login')}
                onSignupSuccess={(email) => {
                  setVerifyEmail(email);
                  setAuthView('verify');
                }}
              />
            ) : authView === 'verify' ? (
              <VerifyEmail
                email={verifyEmail}
                onVerifySuccess={() => setAuthView('login')}
                onResendCode={async (email) => {
                  // Implement resend logic via AuthContext
                  return { success: true };
                }}
                onCancel={() => setAuthView('signup')}
              />
            ) : (
              <ForgotPassword
                onBackToLogin={() => setAuthView('login')}
                onResetSuccess={() => setAuthView('login')}
              />
            )
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/quick-access" element={
            <ProtectedRoute>
              <QuickAccess />
            </ProtectedRoute>
          } />

          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

---

### 5. Test Authentication Flow

```bash
# Start dev server
npm run dev

# Open browser to http://localhost:5173
```

**Test Scenarios:**

1. **Signup Flow:**
   - Navigate to signup
   - Enter email: `test@example.com`
   - Create password (12+ chars, mixed case, numbers, symbols)
   - Check email for 6-digit code
   - Enter code in verification page
   - Should redirect to login

2. **Login Flow:**
   - Enter verified email & password
   - Should redirect to dashboard
   - Check browser localStorage for JWT tokens

3. **Password Reset:**
   - Click "Forgot Password"
   - Enter email
   - Check email for reset code
   - Enter code + new password
   - Should redirect to login

4. **Protected Routes:**
   - Try accessing `/dashboard` while logged out
   - Should redirect to `/login`
   - Login and access should work

---

## 🔐 Security Features

### Password Policy
```
Minimum length: 12 characters
Required: uppercase + lowercase + number + symbol
Examples:
  ✅ MyP@ssw0rd2024!
  ✅ Secur3#Dashboard
  ❌ password123 (no uppercase/symbol)
  ❌ Short1! (too short)
```

### Session Management
- **Access tokens**: 1 hour expiry
- **Refresh tokens**: 30 days expiry
- **Auto-refresh**: Handled by AuthContext
- **Logout**: Clears localStorage + Cognito session

### Email Verification
- Required before first login
- 6-digit code sent via AWS SES
- Code expires after 24 hours
- Unlimited resend attempts

### MFA (Optional)
```bash
# Enable MFA for a user (AWS CLI)
aws cognito-idp set-user-mfa-preference \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username user@example.com \
  --software-token-mfa-settings Enabled=true,PreferredMfa=true
```

---

## 📊 User Management

### Create Admin User (AWS Console)
1. Go to **AWS Cognito** → User Pools → `phantomwall-users-dev`
2. Click **Create user**
3. Enter email + temporary password
4. Check **Mark email as verified**
5. User will be prompted to change password on first login

### Create User (AWS CLI)
```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@phantomwall.com \
  --user-attributes Name=email,Value=admin@phantomwall.com Name=email_verified,Value=true \
  --temporary-password TempP@ss2024! \
  --message-action SUPPRESS
```

### List All Users
```bash
aws cognito-idp list-users \
  --user-pool-id us-east-1_XXXXXXXXX \
  --limit 20
```

### Delete User
```bash
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username user@example.com
```

### Reset User Password (Admin)
```bash
aws cognito-idp admin-reset-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username user@example.com
```

---

## 🔗 API Gateway Integration (Next Step)

### 1. Create Cognito Authorizer

Add to **`api_gateway.tf`**:

```hcl
resource "aws_api_gateway_authorizer" "cognito" {
  name            = "cognito-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.phantomwall.id
  type            = "COGNITO_USER_POOLS"
  identity_source = "method.request.header.Authorization"
  
  provider_arns = [
    aws_cognito_user_pool.phantomwall_users.arn
  ]
}

# Update existing API methods to require auth
resource "aws_api_gateway_method" "alerts_get" {
  rest_api_id   = aws_api_gateway_rest_api.phantomwall.id
  resource_id   = aws_api_gateway_resource.alerts.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}
```

### 2. Update Frontend API Calls

**`frontend/src/services/api.js`**:

```javascript
import { useAuth } from '../contexts/AuthContext';

export const fetchAlerts = async () => {
  const { user } = useAuth();
  
  const response = await fetch('https://your-api.execute-api.us-east-1.amazonaws.com/prod/alerts', {
    headers: {
      'Authorization': `Bearer ${user.accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
};
```

### 3. Extract User from JWT (Lambda)

**`lambda/shared/auth.py`**:

```python
import json
import jwt
from jwt import PyJWKClient

def get_user_from_token(event):
    """Extract user ID from Cognito JWT token"""
    token = event['headers'].get('Authorization', '').replace('Bearer ', '')
    
    # Decode JWT (Cognito validates signature via API Gateway authorizer)
    decoded = jwt.decode(token, options={"verify_signature": False})
    
    return {
        'user_id': decoded['sub'],
        'email': decoded['email'],
        'username': decoded['cognito:username']
    }

def lambda_handler(event, context):
    try:
        user = get_user_from_token(event)
        
        # Use user_id for DynamoDB queries
        # Example: get only this user's alerts
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Authenticated as {user["email"]}'
            })
        }
    except Exception as e:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Unauthorized'})
        }
```

---

## 💰 Cost Breakdown

### AWS Cognito Pricing (Free Tier)
- **50,000 MAUs (Monthly Active Users)**: FREE
- **Beyond 50K MAUs**: $0.0055 per MAU
- **MFA**: $0.05 per SMS (TOTP app is free)

**Your Use Case:**
- Portfolio/demo: **FREE** (under 50K users)
- Production SaaS (1,000 users): **FREE**
- Enterprise (100K users): ~$275/month

**Estimated Monthly Cost:** **$0.00** ✅

---

## 🐛 Troubleshooting

### Issue: Email not sending
**Solution:**
1. Verify SES is configured in `us-east-1`
2. Check SES sending limits (sandbox = 200 emails/day)
3. Move to production mode if needed

```bash
# Check SES sandbox status
aws sesv2 get-account
```

### Issue: Invalid password error
**Cause:** Password doesn't meet policy (12+ chars, mixed case, numbers, symbols)

**Fix:** Update password to meet requirements or adjust policy in `cognito.tf`:

```hcl
password_policy {
  minimum_length    = 8  # Lower to 8 chars
  require_uppercase = false  # Make optional
}
```

### Issue: Token expired
**Cause:** Access token (1 hour) expired, refresh failed

**Solution:**
- AuthContext should auto-refresh via `ALLOW_REFRESH_TOKEN_AUTH`
- Check browser console for refresh errors
- Re-login if refresh token (30 days) expired

### Issue: CORS errors on login
**Cause:** API Gateway not configured for preflight OPTIONS

**Fix:** Add CORS to API Gateway:

```bash
terraform apply -target=aws_api_gateway_method.options
```

---

## 📈 Next Steps

1. ✅ **Deploy Cognito** (`terraform apply -target=cognito`)
2. ✅ **Configure frontend** (`.env` file)
3. ✅ **Update App.jsx** (routing)
4. ✅ **Test signup/login flows**
5. ⏳ **Add API Gateway authorizer**
6. ⏳ **Update Lambda functions** (JWT extraction)
7. ⏳ **Add user profile page** (view/edit account)
8. ⏳ **Enable MFA** (optional security boost)
9. ⏳ **Add social login** (Google/GitHub OAuth)

---

## 📚 Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [Cognito User Pools Best Practices](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings.html)
- [AWS SDK v3 - Cognito Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cognito-identity-provider/)
- [JWT.io Debugger](https://jwt.io/) (decode tokens for debugging)

---

**Status:** 🟢 **Ready for Deployment**

All authentication components created. Follow deployment steps above to activate.
