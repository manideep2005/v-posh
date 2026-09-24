import React, { useState, useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';

/**
 * RateLimitAlert — live countdown banner for HTTP 429 rate-limit errors.
 *
 * Props:
 *  - error:      the thrown error from apiFetch (check `err.isRateLimit`)
 *  - onRetry:    called when countdown hits zero (leave undefined to just re-enable the UI)
 *  - onDismiss:  optional dismiss handler
 */
export default function RateLimitAlert({ error, onRetry, onDismiss }) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!error || !error.isRateLimit) return;
    const secs = Math.max(1, Math.ceil(error.retryAfter || 0));
    setSecondsLeft(secs);

    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (onRetry) onRetry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (!error || !error.isRateLimit) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const isLong = secondsLeft > 60;

  return (
    <div
      role="alert"
      style={{
        marginBottom: '1.25rem', padding: '0.9rem 1.1rem',
        background: 'var(--color-crimson-50)', border: '1px solid var(--border-crimson)', borderLeft: '4px solid #DC2626',
        borderRadius: 8
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
        <Timer size={18} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-crimson-strong)' }}>
            Too many attempts — please wait
          </strong>
          <p style={{ fontSize: '0.8rem', color: '#B91C1C', margin: '0.2rem 0 0.55rem' }}>
            For security, this login method is temporarily locked. You can try again in:
          </p>
          <div style={{
            display: 'inline-block', padding: '0.35rem 0.9rem', borderRadius: 6,
            background: '#DC2626', color: '#fff', fontWeight: 700,
            fontSize: '1.05rem', fontFamily: 'monospace', letterSpacing: '0.05em'
          }}>
            {mm}:{ss}
          </div>
          {isLong && (
            <p style={{ fontSize: '0.72rem', color: '#B91C1C', marginTop: '0.5rem' }}>
              Tip: the QR Code tab and Google Sign-In use separate rate limits, so you can still sign in that way.
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#B91C1C', padding: 4, display: 'flex', fontSize: '1rem', lineHeight: 1
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Preserves the rate-limit error object (so RateLimitAlert can render) while
 * flattening every other failure to a display string.
 */
export function toErrorState(err, fallback) {
  if (err && err.isRateLimit) return err;
  return (err && err.message) || fallback || 'Something went wrong. Please try again.';
}

// Small helper hook so pages can gate submit buttons while the countdown runs.
export function useRateLimited(error) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (error && error.isRateLimit) {
      setBlocked(true);
      const ms = Math.max(1000, Math.ceil(error.retryAfter || 0) * 1000);
      const t = setTimeout(() => setBlocked(false), ms);
      return () => clearTimeout(t);
    }
    if (!error) setBlocked(false);
  }, [error]);
  return blocked;
}
