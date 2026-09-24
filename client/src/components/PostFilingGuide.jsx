import React from 'react';
import { Clock, FileText, Users, Gavel, CheckCircle2, ArrowRight } from 'lucide-react';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date) {
  return new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Shows a plain-language, date-specific timeline after a complaint is filed.
 * `filedAt` — ISO date string of when the complaint was registered.
 * `variant` — "student" or "staff" (faculty/admin see slightly different wording).
 */
export default function PostFilingGuide({ filedAt, variant = 'student' }) {
  const filed = new Date(filedAt || Date.now());

  const steps = [
    {
      icon: FileText,
      title: 'Your complaint is registered',
      detail: `Filed on ${fmt(filed)}. A unique reference ID has been generated for tracking.`,
      deadline: fmt(filed),
      done: true,
    },
    {
      icon: Users,
      title: 'ICC acknowledges your case',
      detail: 'The Internal Complaints Committee reviews your submission and confirms receipt.',
      deadline: `By ${fmt(addDays(filed, 7))}`,
      done: false,
    },
    {
      icon: Clock,
      title: 'Inquiry begins',
      detail: 'The committee examines evidence, speaks with both parties, and applies any interim protective measures.',
      deadline: `Within 90 days of filing`,
      done: false,
    },
    {
      icon: Gavel,
      title: 'Findings and recommendations',
      detail: 'The inquiry committee submits its report with recommendations to the institution.',
      deadline: `Within 10 days of inquiry completion`,
      done: false,
    },
    {
      icon: CheckCircle2,
      title: 'Institution acts on the report',
      detail: 'The employer implements the committee\'s recommendations. You receive written notification of the outcome.',
      deadline: 'After recommendations are submitted',
      done: false,
    },
  ];

  return (
    <div className="panel" style={{ marginTop: '1.5rem' }}>
      <div className="panel-header">
        <h3 className="panel-title" style={{ fontSize: '1rem' }}>
          <ArrowRight size={17} /> What happens next
        </h3>
        <span className="chip chip-blue">Plain-language guide</span>
      </div>
      <ol className="step-list" style={{ listStyle: 'none' }}>
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={i} className="step" style={{ opacity: s.done ? 0.65 : 1 }}>
              <span className={`step-index${s.done ? ' milestone-dot-met' : ''}`}>
                {i + 1}
              </span>
              <div className="step-body">
                <strong>{s.title}</strong>
                <p>{s.detail}</p>
                <span className="chip chip-slate" style={{ marginTop: '0.35rem' }}>
                  <Icon size={11} /> {s.deadline}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {variant === 'student' && (
        <p className="field-hint" style={{ marginTop: '1rem' }}>
          Every step is recorded on the tamper-evident audit ledger. If any deadline is
          missed, the system automatically escalates to the ICC and system administrators.
        </p>
      )}
    </div>
  );
}
