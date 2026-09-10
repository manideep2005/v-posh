import React from 'react';
import { formatDate } from '../utils/api';

// Canonical workflow pipeline. This mirrors the server-side whitelist in
// server/routes/admin.js; if statuses become fully DB-configurable, this
// list should be fetched from the backend instead.
const STATUS_PIPELINE = [
  { id: 'Submitted', label: 'Complaint Registered' },
  { id: 'Acknowledged', label: 'ICC Acknowledged' },
  { id: 'Under Review', label: 'Under Review' },
  { id: 'Investigation', label: 'Investigation' },
  { id: 'Action Taken', label: 'Action Taken' },
  { id: 'Resolved', label: 'Resolved' }
];

export default function Timeline({ history = [], currentStatus }) {
  const pipelineIndex = STATUS_PIPELINE.findIndex(s => s.id === currentStatus);
  const entriesByStatus = {};
  history.forEach(h => {
    if (!entriesByStatus[h.newStatus]) entriesByStatus[h.newStatus] = [];
    entriesByStatus[h.newStatus].push(h);
  });

  return (
    <div className="timeline-container">
      <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--color-navy-900)' }}>
        Redressal Progress
      </h3>

      {/* Full pipeline with completed / current / pending states */}
      <ol className="pipeline" aria-label="Complaint status pipeline">
        {STATUS_PIPELINE.map((step, idx) => {
          const state =
            pipelineIndex === -1
              ? idx === 0 ? 'active' : 'pending'
              : idx < pipelineIndex ? 'completed' : idx === pipelineIndex ? 'active' : 'pending';
          return (
            <li key={step.id} className={`pipeline-step pipeline-${state}`}>
              <span className="pipeline-dot" aria-hidden="true" />
              <span className="pipeline-label">
                {step.label}
                {state === 'completed' && <span className="visually-hidden"> (completed)</span>}
                {state === 'active' && <span className="visually-hidden"> (current stage)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Chronological status-change log */}
      <h4 style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--color-navy-900)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '1.5rem 0 0.75rem 0' }}>
        Status History
      </h4>
      {history.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>No status changes recorded yet.</p>
      ) : (
        <div className="timeline">
          {[...history].reverse().map((step, idx) => (
            <div key={step.id || idx} className="timeline-item completed">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <h4>
                  Status changed to: <strong>{step.newStatus}</strong>
                </h4>
                {step.comment && <p>{step.comment}</p>}
                <div className="timeline-date">
                  Recorded by {step.changedByName} ({step.changedByRole}) on {formatDate(step.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
