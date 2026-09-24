import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate } from '../utils/api';
import { Megaphone, X, AlertTriangle, Info, Star } from 'lucide-react';

const PRIORITY_CONFIG = {
  urgent: { icon: AlertTriangle, color: '#DC2626', bg: 'var(--color-crimson-50)', border: 'var(--border-crimson)' },
  high: { icon: AlertTriangle, color: '#EA580C', bg: 'var(--color-amber-50)', border: 'var(--border-amber)' },
  normal: { icon: Info, color: '#2563EB', bg: 'var(--color-blue-50)', border: 'var(--border-blue)' },
  low: { icon: Star, color: '#6B7280', bg: 'var(--color-slate-50)', border: 'var(--border-emerald)' },
};

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await apiFetch('/admin/announcements');
      if (res.success) {
        setAnnouncements(res.announcements.filter(a => a.isActive));
      }
    } catch { /* silent */ }
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
      {visible.map(a => {
        const config = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal;
        const Icon = config.icon;
        return (
          <div key={a.id} style={{
            background: config.bg, border: `1px solid ${config.border}`,
            borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
          }}>
            <Icon size={18} style={{ color: config.color, flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                <span style={{ fontWeight: '700', fontSize: '0.875rem', color: config.color }}>{a.title}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-slate-400)' }}>{formatDate(a.createdAt)}</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', margin: 0, lineHeight: '1.45' }}>{a.message}</p>
              {a.authorName && <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-400)', marginTop: '0.25rem', display: 'block' }}>— {a.authorName}</span>}
            </div>
            <button onClick={() => setDismissed(prev => new Set([...prev, a.id]))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-slate-400)', padding: '2px', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
