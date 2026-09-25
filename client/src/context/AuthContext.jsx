import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkCurrentSession();
  }, []);

  const checkCurrentSession = async () => {
    const token = localStorage.getItem('vposh_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        logout();
      }
    } catch (err) {
      console.warn('Session verification failed:', err.message);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, expectedRole) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, expectedRole })
    });

    if (res.success && res.token) {
      localStorage.setItem('vposh_token', res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  // KratosID Push Login — client-side polling (avoids Vercel timeout)
  const startPushLogin = async (email) => {
    const res = await apiFetch('/auth/kratosid/push/start', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (!res.success) throw new Error(res.message || 'Failed to send push notification');
    return res; // { token }
  };

  const pollPushLogin = async (pushToken) => {
    const res = await apiFetch('/auth/kratosid/push/poll', {
      method: 'POST',
      body: JSON.stringify({ token: pushToken })
    });
    if (res.success && res.token) {
      localStorage.setItem('vposh_token', res.token);
      setUser(res.user);
      return res.user;
    }
    if (res.approved === false && res.status === 'pending') return null; // still waiting
    throw new Error(res.message || 'Push authentication failed');
  };

  // Keep old name for backward compat
  const kratosLogin = startPushLogin;

  // KratosID QR Login — starts QR session, then polls for approval
  const startQrLogin = async () => {
    const res = await apiFetch('/auth/kratosid/qr/start', { method: 'POST', body: '{}' });
    return res; // { token, qrPayload, expiresAt, expiresIn }
  };

  // Accepts one code or the list of codes issued during this attempt. KratosID's
  // QR session lives only ~18s, so callers rotate codes and pass every recent
  // one; the server approves on whichever code the user actually scanned.
  const pollQrLogin = async (qrTokens) => {
    const tokens = Array.isArray(qrTokens) ? qrTokens : [qrTokens];
    const res = await apiFetch('/auth/kratosid/qr/poll', {
      method: 'POST',
      body: JSON.stringify({ tokens })
    });
    if (res.success && res.token) {
      localStorage.setItem('vposh_token', res.token);
      setUser(res.user);
      return res.user;
    }
    // Still waiting: unscanned, or the current code lapsed and a fresh one was
    // generated. Only a real failure (denied / rate limit) surfaces as an error.
    if (res.approved === false && (res.status === 'pending' || res.status === 'expired')) return null;
    throw new Error(res.message || 'QR login failed');
  };

  // Google OAuth — sends ID token to backend for verification + JWT issuance
  const googleLogin = async (idToken) => {
    const res = await apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken })
    });

    if (res.success && res.token) {
      localStorage.setItem('vposh_token', res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Google sign-in failed');
  };

  const signupStudent = async (studentData) => {
    const res = await apiFetch('/auth/student/signup', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });

    if (res.success && res.token) {
      localStorage.setItem('vposh_token', res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Signup failed');
  };

  const logout = () => {
    localStorage.removeItem('vposh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      googleLogin,
      kratosLogin,
      startPushLogin,
      pollPushLogin,
      startQrLogin,
      pollQrLogin,
      signupStudent,
      logout,
      checkCurrentSession
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

