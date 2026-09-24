import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, LogOut } from 'lucide-react';

const WARNING_MS = 5 * 60 * 1000; // warn 5 minutes before expiry
const POLL_MS = 30_000;           // check every 30 seconds

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

export default function SessionExpiryBanner() {
  const { user, logout } = useAuth();
  const [remaining, setRemaining] = useState(null);

  const check = useCallback(() => {
    const token = localStorage.getItem('vposh_token');
    if (!token) { setRemaining(null); return; }
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) { setRemaining(null); return; }
    const msLeft = payload.exp * 1000 - Date.now();
    if (msLeft <= 0) { logout(); return; }
    if (msLeft < WARNING_MS) setRemaining(msLeft);
    else setRemaining(null);
  }, [logout]);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  if (!remaining || !user) return null;

  const mins = Math.ceil(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);

  return (
    <div className="session-expiry-banner" role="alert" aria-live="polite">
      <span className="session-expiry-icon"><Clock size={15} /></span>
      <span>
        Your session expires in <strong>{mins}:{String(secs).padStart(2, '0')}</strong>.
        Save any drafts before you are signed out.
      </span>
      <button onClick={logout} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
        <LogOut size={13} /> Sign out now
      </button>
    </div>
  );
}
