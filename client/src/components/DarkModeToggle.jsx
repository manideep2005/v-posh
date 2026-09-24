import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const KEY = 'vposh_theme';

export default function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) return saved === 'dark';
    } catch { /* fall through */ }
    // Always start in light mode — user must explicitly opt in to dark.
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* ok */ }
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark(d => !d)}
      className="btn btn-secondary btn-sm"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ padding: '0.35rem 0.5rem' }}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
