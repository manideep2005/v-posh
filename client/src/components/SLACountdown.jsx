import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  'on-track': { color: 'var(--text-teal-strong)', bg: 'var(--color-slate-50)', icon: Clock, label: 'On Track' },
  'warning': { color: 'var(--text-amber-strong)', bg: 'var(--color-amber-50)', icon: AlertCircle, label: 'Approaching Deadline' },
  'critical': { color: 'var(--text-crimson-strong)', bg: 'var(--color-crimson-50)', icon: AlertTriangle, label: 'Critical' },
  'breached': { color: 'var(--text-crimson-strong)', bg: 'var(--color-crimson-50)', icon: AlertTriangle, label: 'SLA Breached' },
  'completed': { color: 'var(--text-teal-strong)', bg: 'var(--tint-emerald)', icon: CheckCircle2, label: 'Resolved' },
};

export default function SLACountdown({ sla }) {
  const [remaining, setRemaining] = useState(sla?.hoursRemaining || 0);

  useEffect(() => {
    if (!sla || sla.status === 'completed' || sla.status === 'breached') return;
    const interval = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1/60)); // decrease by 1 minute
    }, 60000);
    return () => clearInterval(interval);
  }, [sla]);

  if (!sla || sla.status === 'unknown') return null;

  const config = STATUS_CONFIG[sla.status] || STATUS_CONFIG['on-track'];
  const Icon = config.icon;
  const hours = Math.floor(remaining);
  const mins = Math.floor((remaining % 1) * 60);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  return (
    <div style={{
      background: config.bg, border: `1px solid ${config.color}40`,
      borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: `${config.color}20`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} style={{ color: config.color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: config.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {config.label} — {sla.label}
        </div>
        {sla.status !== 'completed' && sla.status !== 'breached' ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: config.color, fontFamily: 'monospace' }}>
              {days > 0 ? `${days}d ` : ''}{String(remHours).padStart(2, '0')}:{String(mins).padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)' }}>remaining</span>
          </div>
        ) : (
          <div style={{ fontSize: '0.8125rem', color: config.color, fontWeight: '600', marginTop: '0.15rem' }}>
            {sla.message}
          </div>
        )}
        {/* Progress bar */}
        <div style={{ height: 4, background: `${config.color}20`, borderRadius: 2, marginTop: '0.4rem', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, transition: 'width 1s ease',
            width: `${Math.min(100, sla.pctUsed || 0)}%`,
            background: sla.pctUsed > 90 ? 'var(--text-crimson-strong)' : sla.pctUsed > 70 ? 'var(--text-amber-strong)' : config.color,
          }} />
        </div>
      </div>
    </div>
  );
}
