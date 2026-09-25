import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { Shield, AlertCircle, Smartphone, QrCode, Mail} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import RateLimitAlert, { useRateLimited, toErrorState } from '../../components/RateLimitAlert';

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

export default function SuperAdminLogin() {
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authTab, setAuthTab] = useState('push');
  const [kratosEmail, setKratosEmail] = useState('');
  const [kratosState, setKratosState] = useState('idle');
  const [qrData, setQrData] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(0);
  const [pushCountdown, setPushCountdown] = useState(0);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const qrRefreshRef = useRef(null);
  const rateLimited = useRateLimited(error);
  const { kratosLogin, startPushLogin, pollPushLogin, startQrLogin, pollQrLogin, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    };
  }, []);

  // Push waits a full 90s (like QR) and tolerates transient poll errors.
  const handleKratosLogin = async (e) => {
    e.preventDefault();
    if (!kratosEmail) return;
    setError('');
    setKratosState('waiting');
    setPushCountdown(90);
    try {
      const startRes = await startPushLogin(kratosEmail);
      const pushToken = startRes.token;
      const startedAt = Date.now();
      const WAIT_MS = 90 * 1000;
      pollRef.current = setInterval(async () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= WAIT_MS) {
          clearInterval(pollRef.current);
          setKratosState('idle');
          setPushCountdown(0);
          setError('Push authentication timed out after 90s. Please try again or use the QR Code tab.');
          return;
        }
        setPushCountdown(Math.ceil((WAIT_MS - elapsed) / 1000));
        try {
          const user = await pollPushLogin(pushToken);
          if (user) { clearInterval(pollRef.current); setPushCountdown(0); if (user.role === 'super_admin') navigate('/super-admin/dashboard'); else if (user.role === 'faculty') navigate('/faculty/dashboard'); else navigate('/admin/dashboard'); }
        } catch (err) {
          const msg = (err && err.message) || '';
          const definitive = err.isRateLimit || /denied|expired|not found|not registered|deactivated/i.test(msg);
          if (definitive) {
            clearInterval(pollRef.current);
            setKratosState('idle');
            setPushCountdown(0);
            setError(toErrorState(err, 'Push authentication failed.'));
          }
          // Transient error — keep polling until the 90s cap
        }
      }, 2000);
    } catch (err) { setKratosState('idle'); setPushCountdown(0); setError(toErrorState(err, 'Failed to send push notification.')); }
  };

  const handleStartQR = async () => {
    setError('');
    setKratosState('waiting');
    try {
      const res = await startQrLogin();
      setQrData(res);
      const QR_TOTAL_MS = 100 * 1000;
      // KratosID hard-codes each QR code to ~18s, so rotate just before expiry.
      const QR_REFRESH_MS = Math.max(8, (res.expiresIn || 18) - 3) * 1000;
      const sessionStart = Date.now();
      setQrCountdown(100);

      countdownRef.current = setInterval(() => {
        const remaining = Math.ceil((QR_TOTAL_MS - (Date.now() - sessionStart)) / 1000);
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          clearInterval(qrRefreshRef.current);
          clearInterval(pollRef.current);
          setKratosState('idle'); setQrData(null); setQrCountdown(0);
          setError('QR code session expired after 100s. Please try again.');
          return;
        }
        setQrCountdown(remaining);
      }, 1000);

      // Roll a window of codes: the one on screen plus the recent ones the user
      // may already have scanned. The server approves on any of them, so a slow
      // scan is no longer lost when the display rotates.
      let currentToken = [res.token];
      qrRefreshRef.current = setInterval(async () => {
        try {
          const fresh = await startQrLogin();
          currentToken = [fresh.token, ...currentToken].slice(0, 4);
          setQrData(fresh);
        } catch (_) {}
      }, QR_REFRESH_MS);

      pollRef.current = setInterval(async () => {
        try {
          const user = await pollQrLogin(currentToken);
          if (!user) return; // not scanned yet — keep polling
          clearInterval(pollRef.current); clearInterval(countdownRef.current); clearInterval(qrRefreshRef.current);
          if (user.role === 'super_admin') navigate('/super-admin/dashboard');
          else if (user.role === 'faculty') navigate('/faculty/dashboard');
          else navigate('/admin/dashboard');
        } catch (err) {
          if (err && err.isRateLimit) {
            clearInterval(pollRef.current); clearInterval(countdownRef.current); clearInterval(qrRefreshRef.current);
            setKratosState('idle'); setQrData(null); setError(err);
            return;
          }
          if (err.message && err.message.includes('denied')) {
            clearInterval(pollRef.current); clearInterval(countdownRef.current); clearInterval(qrRefreshRef.current);
            setKratosState('idle'); setQrData(null); setError(err.message);
          }
          // Pending / refreshing — keep polling
        }
      }, 3000);
    } catch (err) { setKratosState('idle'); setQrData(null); setError(toErrorState(err, 'Failed to start QR login.')); }
  };

  const cancelQR = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    setKratosState('idle'); setQrData(null); setQrCountdown(0);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true); setError('');
      try {
        const res = await fetch('/api/auth/google-access', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: tokenResponse.access_token })
        }).then(r => r.json());
        if (res.success && res.token) {
          localStorage.setItem('vposh_token', res.token);
          const role = res.user?.role || 'super_admin';
          if (role === 'super_admin') window.location.href = '/super-admin/dashboard';
          else if (role === 'faculty') window.location.href = '/faculty/dashboard';
          else window.location.href = '/admin/dashboard';
        } else { setError(res.message || 'Google sign-in failed.'); }
      } catch (err) { setError(err.message || 'Google sign-in failed.'); }
      finally { setGoogleLoading(false); }
    },
    onError: () => setError('Google sign-in was cancelled.'),
    flow: 'implicit',
  });

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '440px', padding: '2.25rem', borderTop: '4px solid #8B5CF6' }}>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#8B5CF6', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem auto' }}>
            <Shield size={24} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>Super Admin Sign In</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: '0.3rem' }}>V-POSH · System Administration</p>
        </div>

        {error && error.isRateLimit ? (
          <RateLimitAlert error={error} onDismiss={() => setError('')} />
        ) : error && <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}><AlertCircle size={15} /><span>{error}</span></div>}

        {/* KratosID Section */}
        <div style={{ background: 'var(--color-slate-100)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem', border: '1px solid var(--color-slate-200)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <img src="/vit-ap-logo.png" alt="VIT-AP" style={{ height: 48, marginBottom: '0.5rem', filter: 'brightness(1.3)' }} />
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px' }}>
            <button onClick={() => { setAuthTab('push'); cancelQR(); setError(''); }} style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', fontFamily: 'inherit', background: authTab === 'push' ? 'var(--tint-emerald)' : 'transparent', color: authTab === 'push' ? 'var(--text-teal-strong)' : 'var(--color-slate-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <Mail size={13} /> Push
            </button>
            <button onClick={() => { setAuthTab('qr'); setKratosState('idle'); setError(''); }} style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', fontFamily: 'inherit', background: authTab === 'qr' ? 'var(--tint-emerald)' : 'transparent', color: authTab === 'qr' ? 'var(--text-teal-strong)' : 'var(--color-slate-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <QrCode size={13} /> QR Code
            </button>
          </div>

          {authTab === 'push' && (
            <form onSubmit={handleKratosLogin}>
              <input type="email" className="form-control" placeholder="your-email@vitap.ac.in" value={kratosEmail} onChange={e => { setKratosEmail(e.target.value); setError(''); }} required disabled={kratosState === 'waiting'} style={{ marginBottom: '0.65rem' }} />
              <button type="submit" disabled={rateLimited || kratosState === 'waiting' || !kratosEmail} className="btn btn-primary" style={{ width: '100%', padding: '0.65rem', fontWeight: '700', fontSize: '0.9rem', cursor: kratosState === 'waiting' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {kratosState === 'waiting' ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Waiting for approval… {formatTime(pushCountdown)}</> : 'Send Push Notification'}
              </button>
            </form>
          )}

          {authTab === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              {!qrData ? (
                <>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '1rem' }}>Scan a QR code with your KratosID mobile app.</p>
                  <button onClick={handleStartQR} className="btn btn-primary" style={{ width: '100%', padding: '0.65rem', fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><QrCode size={16} /> Generate QR Code</button>
                </>
              ) : (
                <>
                  <div style={{ background: 'var(--color-slate-50)', borderRadius: '12px', padding: '1.25rem', display: 'inline-block', marginBottom: '0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}><QRCodeSVG value={qrData.qrPayload} size={180} level="M" /></div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-blue-strong)', marginBottom: '0.5rem' }}>Scan with your <strong style={{ color: 'var(--color-navy-900)' }}>KratosID app</strong></div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '700', color: qrCountdown < 15 ? 'var(--text-crimson-strong)' : 'var(--text-teal-strong)', marginBottom: '0.75rem', fontFamily: 'monospace' }}>{formatTime(qrCountdown)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>Waiting for scan…</span>
                  </div>                    <button onClick={cancelQR} className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>Cancel</button>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-slate-200)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-slate-200)' }} />
        </div>

        <button type="button" onClick={() => { setError(''); handleGoogleLogin(); }} disabled={googleLoading || rateLimited || kratosState === 'waiting'} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', padding: '0.72rem 1rem', backgroundColor: 'var(--color-slate-50)', border: '1.5px solid var(--color-slate-300)', borderRadius: '6px', fontSize: '0.9375rem', fontWeight: '600', color: 'var(--color-navy-900)', cursor: (googleLoading || kratosState === 'waiting') ? 'not-allowed' : 'pointer', opacity: (googleLoading || kratosState === 'waiting') ? 0.6 : 1, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontFamily: 'inherit' }}>
          <GoogleIcon />{googleLoading ? 'Signing in…' : 'Continue with Google (VIT-AP)'}
        </button>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)', textAlign: 'center', marginTop: '0.4rem' }}>
          <strong>@vitap.ac.in</strong> authorized admin email required
        </p>

        <div className="alert alert-warning" style={{ marginTop: '1.25rem', fontSize: '0.75rem', textAlign: 'center' }}>
          <strong>⚠️ Restricted Access:</strong> Only authorized Super Administrators may sign in here.
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
