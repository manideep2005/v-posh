import React, { useCallback, useEffect, useState } from 'react';
import { EyeOff, BookOpen } from 'lucide-react';

const HIDDEN_KEY = 'vposh_privacy_hidden';

/**
 * Quick-exit privacy shield.
 *
 * On a shared or monitored device a complainant may need the screen to stop
 * showing anything sensitive instantly. Pressing Escape twice (or clicking the
 * floating button) covers the app with a neutral "study materials" screen and
 * blurs the underlying content. Nothing is logged — the app state stays intact,
 * so restoring brings the user exactly back to where they were.
 */
export default function PrivacyGuard() {
  const [hidden, setHidden] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);

  useEffect(() => {
    let lastEscape = 0;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscape < 500) {
          hide();
          lastEscape = 0;
          return;
        }
        lastEscape = now;
      }
      // Ctrl/Cmd + Shift + X — same action, no chance of colliding with Escape.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
        e.preventDefault();
        hide();
      }
    };

    const onVisibility = () => {
      // Returning to a backgrounded tab keeps whatever the user chose.
      if (document.visibilityState === 'visible') setHintVisible(true);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);

    // Remember across reloads so a rushed exit does not reopen the case file.
    try {
      if (sessionStorage.getItem(HIDDEN_KEY) === '1') setHidden(true);
    } catch { /* storage disabled */ }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [hide]);

  useEffect(() => {
    try {
      if (hidden) sessionStorage.setItem(HIDDEN_KEY, '1');
      else sessionStorage.removeItem(HIDDEN_KEY);
    } catch { /* storage disabled */ }
    document.documentElement.classList.toggle('privacy-hidden', hidden);
  }, [hidden]);

  return (
    <>
      {!hidden && (
        <button
          type="button"
          onClick={hide}
          className="privacy-trigger"
          title="Hide this screen instantly (Esc Esc, Ctrl+Shift+X, or click this button)"
          aria-label="Hide this screen instantly. Keyboard shortcuts: double-tap Escape, or Ctrl+Shift+X"
        >
          <EyeOff size={15} /> <span className="privacy-trigger-label">Privacy</span>
        </button>
      )}

      {!hidden && hintVisible && (
        <div className="privacy-hint" role="status">
          Press <kbd>Esc</kbd> twice to hide this screen instantly.
          <button type="button" onClick={() => setHintVisible(false)} aria-label="Dismiss hint">×</button>
        </div>
      )}

      {hidden && (
        <div className="privacy-shield" role="dialog" aria-label="Screen hidden">
          <div className="privacy-shield-card">
            <BookOpen size={26} />
            <h2>Study materials</h2>
            <p>This page is temporarily unavailable. Content resumes when you continue.</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', marginBottom: '1rem' }}>
              Keyboard: press <kbd>Esc</kbd> twice or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> to restore.
            </p>
            <button type="button" onClick={show} className="btn btn-primary btn-sm" autoFocus>
              Continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}
