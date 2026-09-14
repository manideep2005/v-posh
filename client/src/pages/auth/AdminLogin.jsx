import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { ShieldCheck, AlertCircle, Smartphone, QrCode, Mail } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5932 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1732 0 7.5477 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9255L15.0218 2.3441C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
    </svg>
  );
}

export default function AdminLogin() {
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authTab, setAuthTab] = useState('push'); // push | qr
  const [kratosEmail, setKratosEmail] = useState('');
  const [kratosState, setKratosState] = useState('idle');
  const [qrData, setQrData] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(0);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const { kratosLogin, startQrLogin, pollQrLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const redirectByRole = (user) => {
    if (user.role === 'super_admin') navigate('/super-admin/dashboard');
    else if (user.role === 'faculty') navigate('/faculty/dashboard');
    else navigate('/admin/dashboard');
  };

  const handleKratosLogin = async (e) => {
    e.preventDefault();
    if (!kratosEmail) return;
    setError('');
    setKratosState('waiting');
    try {
      const user = await kratosLogin(kratosEmail);
      redirectByRole(user);
    } catch (err) {
      setKratosState('idle');
      setError(err.message || 'KratosID authentication failed.');
    }
  };

  const handleStartQR = async () => {
    setError('');
    setKratosState('waiting');
    try {
      const res = await startQrLogin();
      setQrData(res);
      setQrCountdown(Math.floor(res.expiresIn || 90));
      countdownRef.current = setInterval(() => {
        setQrCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
      pollRef.current = setInterval(async () => {
        try {
          const user = await pollQrLogin(res.token);
          clearInterval(pollRef.current);
          clearInterval(countdownRef.current);
          redirectByRole(user);
        } catch (err) {
          if (err.message && (err.message.includes('timed out') || err.message.includes('denied') || err.message.includes('expired'))) {
            clearInterval(pollRef.current);
            clearInterval(countdownRef.current);
            setKratosState('idle');
            setQrData(null);
            setError(err.message);
          }
        }
      }, 3000);
    } catch (err) {
      setKratosState('idle');
      setQrData(null);
      setError(err.message || 'Failed to start QR login.');
    }
  };

  const cancelQR = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setKratosState('idle');
    setQrData(null);
    setQrCountdown(0);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError('');
      try {
        const res = await fetch('/api/auth/google-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: tokenResponse.access_token })
        }).then(r => r.json());
        if (res.success && res.token) {
          localStorage.setItem('vposh_token', res.token);
          const role = res.user?.role || 'admin';
          if (role === 'super_admin') window.location.href = '/super-admin/dashboard';
          else if (role === 'faculty') window.location.href = '/faculty/dashboard';
          else window.location.href = '/admin/dashboard';
        } else {
          setError(res.message || 'Google sign-in failed.');
        }
      } catch (err) {
        setError(err.message || 'Google sign-in failed.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError('Google sign-in was cancelled. Please try again.'),
    flow: 'implicit',
  });

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '440px', padding: '2.25rem', borderTop: '4px solid #14B8A6' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#14B8A6', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem auto' }}>
            <ShieldCheck size={24} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            Admin Sign In
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: '0.3rem' }}>
            V-POSH · ICC Admin Portal
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={15} /><span>{error}</span>
          </div>
        )}

        {/* ── KratosID Section ── */}
        <div style={{ background: 'var(--color-navy-900)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px' }}>
            <button
              onClick={() => { setAuthTab('push'); cancelQR(); setError(''); }}
              style={{
                flex: 1, padding: '0.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: '600', fontFamily: 'inherit',
                background: authTab === 'push' ? 'rgba(94,234,212,0.2)' : 'transparent',
                color: authTab === 'push' ? '#5EEAD4' : '#94A3B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              <Mail size={14} /> Push
            </button>
            <button
              onClick={() => { setAuthTab('qr'); setKratosState('idle'); setError(''); }}
              style={{
                flex: 1, padding: '0.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: '600', fontFamily: 'inherit',
                background: authTab === 'qr' ? 'rgba(94,234,212,0.2)' : 'transparent',
                color: authTab === 'qr' ? '#5EEAD4' : '#94A3B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              }}
            >
              <QrCode size={14} /> QR Code
            </button>
          </div>

          {/* Push Tab */}
          {authTab === 'push' && (
            <form onSubmit={handleKratosLogin}>
              <input
                type="email"
                className="form-control"
                placeholder="your-email@vitap.ac.in"
                value={kratosEmail}
                onChange={e => { setKratosEmail(e.target.value); setError(''); }}
                required
                disabled={kratosState === 'waiting'}
                style={{ marginBottom: '0.65rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
              <button
                type="submit"
                disabled={kratosState === 'waiting' || !kratosEmail}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '6px',
                  background: kratosState === 'waiting' ? 'rgba(94,234,212,0.2)' : '#14B8A6',
                  color: '#fff', fontWeight: '700', fontSize: '0.9rem',
                  border: 'none', cursor: kratosState === 'waiting' ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                {kratosState === 'waiting' ? (
                  <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '1rem' }}>⏳</span> Waiting for approval…</>
                ) : 'Send Push Notification'}
              </button>
            </form>
          )}

          {/* QR Tab */}
          {authTab === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              {!qrData ? (
                <>
                  <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginBottom: '1rem' }}>
                    Scan a QR code with your KratosID mobile app to sign in.
                  </p>
                  <button
                    onClick={handleStartQR}
                    style={{
                      width: '100%', padding: '0.65rem', borderRadius: '6px',
                      background: '#14B8A6', color: '#fff', fontWeight: '700', fontSize: '0.9rem',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}
                  >
                    <QrCode size={16} /> Generate QR Code
                  </button>
                </>
              ) : (
                <>
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', display: 'inline-block', marginBottom: '0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                    <QRCodeSVG value={qrData.qrPayload} size={180} level="M" />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#93C5FD', marginBottom: '0.5rem' }}>
                    Scan with your <strong style={{ color: '#fff' }}>KratosID app</strong>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '700', color: qrCountdown < 15 ? '#FCA5A5' : '#5EEAD4', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
                    {formatTime(qrCountdown)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '0.9rem' }}>⏳</span>
                    <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>Waiting for scan…</span>
                  </div>
                  <button
                    onClick={cancelQR}
                    style={{ marginTop: '0.75rem', padding: '0.4rem 1rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-slate-200)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-slate-200)' }} />
        </div>

        {/* ── Google OAuth ── */}
        <button
          type="button"
          onClick={() => { setError(''); handleGoogleLogin(); }}
          disabled={googleLoading || kratosState === 'waiting'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.65rem', padding: '0.72rem 1rem',
            backgroundColor: '#FFFFFF', border: '1.5px solid #E2E8F0',
            borderRadius: '6px', fontSize: '0.9375rem', fontWeight: '600', color: '#1E293B',
            cursor: (googleLoading || kratosState === 'waiting') ? 'not-allowed' : 'pointer',
            opacity: (googleLoading || kratosState === 'waiting') ? 0.6 : 1,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (!googleLoading) { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)'; }}}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
        >
          <GoogleIcon />
          {googleLoading ? 'Signing in…' : 'Continue with Google (VIT-AP)'}
        </button>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)', textAlign: 'center', marginTop: '0.4rem' }}>
          <strong>@vitap.ac.in</strong> admin email required
        </p>

        <div style={{ backgroundColor: 'var(--color-slate-100)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--color-slate-600)', textAlign: 'center' }}>
          <strong>Notice:</strong> All staff access is logged under statutory audit regulations.
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
