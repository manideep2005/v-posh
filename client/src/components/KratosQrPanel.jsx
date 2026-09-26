import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Maximize2, X, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toErrorState } from './RateLimitAlert';

// ─────────────────────────────────────────────────────────────────────────────
// KratosID QR login panel
//
// One implementation shared by all four login pages. The rules it encodes:
//
//   * One code per session, never rotated. KratosID sets the session lifetime
//     server-side (currently 50s, not a request parameter) and swaps the code
//     out from under a scan if we generate a new one, which is exactly what the
//     mobile app reports as "expired". The countdown is therefore always derived
//     from the expiry KratosID returned, and a lapsed code offers a fresh start
//     instead of silently disappearing.
//
//   * The code is always black on a plain white card that extends at least four
//     modules past the symbol. qrcode.react paints its background only over the
//     symbols and defaults to marginSize 0, so a themed (dark) surround used to
//     sit flush against the modules — no quiet zone, and a scanner that cannot
//     locate the finder patterns reports "invalid". The card here is fixed to
//     #FFFFFF no matter what the theme does, and marginSize adds the spec's
//     four-module quiet zone inside the symbol.
//
//   * A scan that is refused by the app is made visible: the raw KratosID status
//     (pending / claiming / claimed) is shown live, because "pending" forever
//     means the app never parsed the code, while claiming/claimed means it did.
//     The exact string that was on screen is available under Diagnostics.
//
//   * A bigger code is one tap away, since a phone pointed at a laptop screen
//     is the main reason a scan fails outright.
// ─────────────────────────────────────────────────────────────────────────────

const PALETTE = {
  accent: '#14B8A6',
  accentHover: '#0D9488',
  text: '#E2E8F0',
  muted: '#94A3B8',
  link: '#93C5FD',
  good: '#5EEAD4',
  bad: '#FCA5A5',
  line: 'rgba(255,255,255,0.15)',
};

const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function KratosQrPanel({ onApproved, onUsePush, onBusyChange }) {
  const { startQrLogin, pollQrLogin } = useAuth();

  const [qr, setQr] = useState(null);          // { qrPayload, expiresAt, expiresIn, qrVariant }
  const [state, setState] = useState('idle');  // idle | starting | active | expired
  const [countdown, setCountdown] = useState(0);
  const [total, setTotal] = useState(0);
  const [kratosStatus, setKratosStatus] = useState('pending');
  const [error, setError] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [size, setSize] = useState(200);

  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const boxRef = useRef(null);

  const stopTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
  }, []);

  useEffect(() => () => stopTimers(), [stopTimers]);

  // Tell the parent whether a scan is in flight, so it can disable the other
  // sign-in buttons while we wait.
  useEffect(() => {
    if (typeof onBusyChange === 'function') onBusyChange(state === 'starting' || state === 'active');
  }, [state, onBusyChange]);

  // Size the code to the space actually available, never larger than the card.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => {
      const width = el.clientWidth || 0;
      if (!width) return;
      setSize(Math.max(196, Math.min(264, Math.round(width - 8))));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [qr]);

  const cancel = useCallback(() => {
    stopTimers();
    setQr(null);
    setCountdown(0);
    setZoomed(false);
    setState('idle');
    setKratosStatus('pending');
  }, [stopTimers]);

  const start = useCallback(async () => {
    setError('');
    setState('starting');
    setKratosStatus('pending');
    setZoomed(false);
    try {
      const res = await startQrLogin();
      const expiresAtMs = res.expiresAt ? res.expiresAt * 1000 : Date.now() + (res.expiresIn || 60) * 1000;
      const remaining = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
      setQr(res);
      setTotal(remaining);
      setCountdown(remaining);
      setState('active');

      tickRef.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
        setCountdown(left);
        if (left <= 0) {
          // The code lapsed on its own — stop polling but keep the panel, so a
          // new code is one click away rather than a dead end.
          stopTimers();
          setState('expired');
        }
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const user = await pollQrLogin(res.token, { onStatus: setKratosStatus });
          if (!user) return; // not scanned (or not approved) yet
          stopTimers();
          setZoomed(false);
          setState('idle');
          onApproved(user);
        } catch (err) {
          const msg = (err && err.message) || '';
          if (err && err.isRateLimit) {
            stopTimers();
            setState('idle');
            setQr(null);
            setError(toErrorState(err, 'Too many attempts. Please wait a moment.'));
            return;
          }
          if (/denied/i.test(msg)) {
            stopTimers();
            setState('idle');
            setQr(null);
            setError('You declined the sign-in on your phone.');
          }
          // Anything else is transient — keep polling until the code lapses.
        }
      }, 3000);
    } catch (err) {
      setState('idle');
      setQr(null);
      setError(toErrorState(err, 'Failed to start QR login.'));
    }
  }, [onApproved, pollQrLogin, startQrLogin, stopTimers]);

  // Escape closes the enlarged view.
  useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setZoomed(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  const live = state === 'active' || state === 'expired';
  const dangerAfter = Math.max(8, Math.round(total * 0.2));
  const urgent = countdown <= dangerAfter;
  const payload = qr ? qr.qrPayload : '';

  const qrNode = (px) => (
    <QRCodeSVG
      value={payload || ' '}
      size={px}
      level="M"
      bgColor="#FFFFFF"
      fgColor="#000000"
      marginSize={4}
      title="KratosID sign-in code"
    />
  );

  const whiteCard = (px, pad) => ({
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: `${pad}px`,
    display: 'inline-block',
    lineHeight: 0,
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  });

  if (!live) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.8125rem', color: PALETTE.muted, marginBottom: '1rem' }}>
          Scan a code with the <strong style={{ color: PALETTE.text }}>KratosID app</strong> on your
          phone. KratosID gives each code a short life, so have the app open before you generate one.
        </p>
        {error && (
          <p style={{ fontSize: '0.78rem', color: PALETTE.bad, marginBottom: '0.75rem' }}>{error}</p>
        )}
        <button
          type="button"
          onClick={start}
          disabled={state === 'starting'}
          style={{
            width: '100%', padding: '0.65rem', borderRadius: '6px',
            background: state === 'starting' ? 'rgba(94,234,212,0.2)' : PALETTE.accent,
            color: '#fff', fontWeight: '700', fontSize: '0.9rem',
            border: 'none', cursor: state === 'starting' ? 'wait' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.5rem',
          }}
        >
          <QrCode size={16} />
          {state === 'starting' ? 'Preparing code…' : 'Generate QR Code'}
        </button>
        {typeof onUsePush === 'function' && (
          <button
            type="button"
            onClick={onUsePush}
            style={{
              marginTop: '0.6rem', background: 'none', border: 'none', cursor: 'pointer',
              color: PALETTE.muted, fontSize: '0.75rem', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            <Mail size={13} /> Prefer a push notification? Use the Push tab.
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div ref={boxRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          title="Tap to enlarge"
          aria-label="Enlarge QR code"
          style={{ ...whiteCard(size, 10), border: 'none', cursor: 'zoom-in', position: 'relative', padding: 10 }}
        >
          {qrNode(size)}
          <span style={{
            position: 'absolute', right: 6, bottom: 6, display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: '0.6rem', color: '#64748B', fontFamily: 'inherit', background: 'rgba(255,255,255,0.9)',
            padding: '1px 5px', borderRadius: 4,
          }}>
            <Maximize2 size={10} /> tap to enlarge
          </span>
        </button>
      </div>

      <div style={{ fontSize: '0.8125rem', color: PALETTE.link, marginBottom: '0.35rem' }}>
        {state === 'expired' ? 'This code has lapsed' : <>Scan with your <strong style={{ color: PALETTE.text }}>KratosID app</strong></>}
      </div>

      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: urgent ? PALETTE.bad : PALETTE.good, fontFamily: 'monospace', marginBottom: '0.35rem' }}>
        {state === 'expired' ? '0:00' : formatClock(countdown)}
      </div>

      {state === 'active' && total > 0 && (
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginBottom: '0.6rem' }}>
          <div style={{
            height: '100%', width: `${Math.max(0, Math.min(100, (countdown / total) * 100))}%`,
            background: urgent ? PALETTE.bad : PALETTE.good, transition: 'width 0.9s linear',
          }} />
        </div>
      )}

      {state === 'active' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '0.9rem' }}>⏳</span>
            <span style={{ fontSize: '0.8125rem', color: PALETTE.muted }}>
              {kratosStatus === 'pending' ? 'Waiting for the app to read it…' : `KratosID: ${kratosStatus}…`}
            </span>
          </div>
          {kratosStatus === 'pending' && countdown < total - 10 && (
            <p style={{ fontSize: '0.72rem', color: PALETTE.muted, margin: '0 0 0.5rem' }}>
              Still unscanned. If the app says the code is <em>invalid</em>, tap the code to enlarge it
              and hold the phone steady over the whole square.
            </p>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: '0.75rem', color: PALETTE.muted, margin: '0 0 0.6rem' }}>
            Codes lapse quickly. Generate a fresh one and scan it straight away.
          </p>
          <button
            type="button"
            onClick={start}
            style={{
              width: '100%', padding: '0.6rem', borderRadius: '6px', background: PALETTE.accent,
              color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: '0.5rem',
            }}
          >
            Generate a new code
          </button>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={cancel}
          style={{
            padding: '0.4rem 0.9rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)',
            color: PALETTE.muted, border: `1px solid ${PALETTE.line}`, fontSize: '0.75rem',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        {typeof onUsePush === 'function' && (
          <button
            type="button"
            onClick={() => { cancel(); onUsePush(); }}
            style={{
              padding: '0.4rem 0.9rem', borderRadius: '4px', background: 'transparent',
              color: PALETTE.link, border: `1px solid ${PALETTE.line}`, fontSize: '0.75rem',
              cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            <Mail size={12} /> Use push instead
          </button>
        )}
      </div>

      {qr && (
        <details style={{ marginTop: '0.75rem', textAlign: 'left' }}>
          <summary style={{ fontSize: '0.68rem', color: PALETTE.muted, cursor: 'pointer' }}>
            Diagnostics (for support)
          </summary>
          <div style={{ fontSize: '0.65rem', color: PALETTE.muted, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '0.35rem' }}>
            <div>variant: {qr.qrVariant || 'asis'}</div>
            <div>kratos status: {kratosStatus}</div>
            <div>expires in: {qr.expiresIn}s</div>
            <div>payload: {payload}</div>
          </div>
        </details>
      )}

      {zoomed && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged KratosID sign-in code"
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2,6,23,0.97)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
          <div style={whiteCard(0, 16)}>
            {qrNode(Math.max(240, Math.min(640, Math.min(window.innerWidth, window.innerHeight) - 140)))}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: urgent ? PALETTE.bad : PALETTE.good, fontFamily: 'monospace' }}>
            {state === 'expired' ? 'expired' : formatClock(countdown)}
          </div>
          <div style={{ fontSize: '0.8rem', color: PALETTE.muted, textAlign: 'center', maxWidth: 380 }}>
            Fill most of the camera frame, keep the phone steady, and avoid glare on the screen.
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
