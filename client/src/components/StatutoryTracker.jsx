import React from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, CalendarClock, ShieldCheck, Info,
} from 'lucide-react';

const STUDENT_LABELS = {
  filingWindow: 'Submitted within the 3-month window',
  acknowledgement: 'ICC acknowledged your complaint',
  respondentNotice: 'Copy shared with the respondent',
  inquiry: 'Inquiry completed',
  report: 'Findings submitted to the institution',
  employerAction: 'Institution acted on the recommendation',
};

function formatDay(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusMeta(status) {
  switch (status) {
    case 'met': return { chip: 'chip-emerald', label: 'Completed', Icon: CheckCircle2 };
    case 'overdue': return { chip: 'chip-crimson', label: 'Overdue', Icon: AlertTriangle };
    case 'due-soon': return { chip: 'chip-amber', label: 'Due soon', Icon: Clock };
    default: return { chip: 'chip-blue', label: 'Scheduled', Icon: CalendarClock };
  }
}

function remainingText(milestone) {
  if (milestone.status === 'met') return milestone.metAt ? `Recorded ${formatDay(milestone.metAt)}` : 'Completed';
  const days = milestone.daysRemaining;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

/**
 * Shows the statutory clock for one case.
 * `variant="student"` uses plain-language labels; `variant="staff"` shows the
 * exact section of the Act the deadline comes from.
 */
export default function StatutoryTracker({ statutory, variant = 'staff', title = 'Statutory timeline' }) {
  const milestones = statutory?.milestones || [];
  const health = statutory?.health;
  if (!milestones.length) return null;

  const isStudent = variant === 'student';

  // Compute progress: how many milestones are met vs total.
  const metCount = milestones.filter(m => m.status === 'met').length;
  const progressPct = Math.round((metCount / milestones.length) * 100);

  return (
    <div className="panel" style={{ marginBottom: '1.5rem' }}>
      <div className="panel-header">
        <h3 className="panel-title" style={{ fontSize: '1rem' }}>
          <ShieldCheck size={17} /> {title}
        </h3>
        {health && (
          <span className={`chip ${health.state === 'overdue' ? 'chip-crimson' : health.state === 'due-soon' ? 'chip-amber' : health.state === 'closed' ? 'chip-slate' : 'chip-emerald'}`}>
            {health.state === 'overdue'
              ? `${health.overdueCount} deadline${health.overdueCount === 1 ? '' : 's'} missed`
              : health.state === 'due-soon'
                ? 'Deadline approaching'
                : health.state === 'closed'
                  ? 'Case closed'
                  : 'All deadlines on track'}
          </span>
        )}
      </div>

      {/* ── Visual progress bar ── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
            Case progress
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-navy-900)', fontVariantNumeric: 'tabular-nums' }}>
            {metCount}/{milestones.length} milestones
          </span>
        </div>
        <div className="meter" style={{ height: 8 }}>
          <span
            className="meter-fill"
            style={{
              width: `${progressPct}%`,
              background: progressPct === 100
                ? 'var(--color-emerald-700)'
                : health?.state === 'overdue'
                  ? 'var(--color-crimson-700)'
                  : 'var(--color-navy-700)',
            }}
          />
        </div>
      </div>

      {health && (
        <div className="stat-row">
          <div>
            <span className="field-label">Case age</span>
            <strong>{health.daysOpen} day{health.daysOpen === 1 ? '' : 's'}</strong>
          </div>
          <div>
            <span className="field-label">Age bucket</span>
            <strong>{health.ageBucket} days</strong>
          </div>
          {health.nextDue && (
            <div>
              <span className="field-label">Next deadline</span>
              <strong>{health.nextDue.label} · {formatDay(health.nextDue.dueAt)}</strong>
            </div>
          )}
        </div>
      )}

      <ol className="milestone-list">
        {milestones.map(m => {
          const meta = statusMeta(m.status);
          const label = isStudent ? (STUDENT_LABELS[m.key] || m.label) : m.label;
          return (
            <li key={m.key} className={`milestone milestone-${m.status}`}>
              <span className={`milestone-dot milestone-dot-${m.status}`} />
              <div className="milestone-body">
                <div className="milestone-head">
                  <span className="milestone-title">{label}</span>
                  <span className={`chip ${meta.chip}`}>
                    <meta.Icon size={11} /> {meta.label}
                  </span>
                </div>
                <div className="milestone-meta">
                  <span>{remainingText(m)}</span>
                  <span aria-hidden="true">•</span>
                  <span>
                    {m.status === 'met' ? 'Due was' : 'Due'} {formatDay(m.dueAt)}
                  </span>
                  {m.extendedBy > 0 && (
                    <span className="chip chip-slate">extended by {m.extendedBy} days</span>
                  )}
                </div>
                {!isStudent && (
                  <div className="milestone-legal">
                    <Info size={11} /> {m.legalRef}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isStudent && (
        <p className="form-hint" style={{ marginTop: '0.75rem' }}>
          These dates come from the POSH Act, 2013. If a date passes without an update, the case is
          escalated to the ICC committee and the system administrators automatically.
        </p>
      )}
    </div>
  );
}
