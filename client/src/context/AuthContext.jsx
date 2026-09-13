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

  // KratosID passwordless — sends push to user's phone, long-polls server-side
  const kratosLogin = async (email) => {
    const res = await apiFetch('/auth/kratosid/verify', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (res.success && res.token) {
      localStorage.setItem('vposh_token', res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'KratosID authentication failed');
  };

  // KratosID QR Login — starts QR session, then polls for approval
  const startQrLogin = async () => {
    const res = await apiFetch('/auth/kratosid/qr/start', { method: 'POST', body: '{}' });
    return res; // { token, qrPayload, expiresAt, expiresIn }
  };

  const pollQrLogin = async (qrToken) => {
    const res = await apiFetch('/auth/kratosid/qr/poll', {
      method: 'POST',
      body: JSON.stringify({ token: qrToken })
    });
    if (res.success && res.token) {
      localStorage.setItem('vposh_token', res.token);
      setUser(res.user);
      return res.user;
    }
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

