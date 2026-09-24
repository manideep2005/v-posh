import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import Announcements from '../../components/Announcements';
import {
  AlertTriangle, Clock, CheckCircle2, FileSearch, ShieldAlert, ArrowRight,
  Scale, ShieldCheck, Star, ClipboardList,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          {sub && <div className="stat-sub">{sub}</div>}
        </div>
        {Icon && (
          <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: 'var(--color-slate-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} style={{ color: 'var(--color-navy-700)' }} />
          </span>
        )}
      </div>
    </div>
  );
}

// Student records often carry the roll number inside `studentName`.
function splitStudentName(fullName, rollNo) {
  const name = (fullName || '').trim();
  if (!rollNo) return { displayName: name, rest: '' };
  return { displayName: name.replace(rollNo, '').replace(/\s{2,}/g, ' ').trim() || name, rest: rollNo };
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    setError('');
    try {
      const res = await apiFetch('/admin/dashboard');
      if (res.success) setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load the ICC dashboard.');
    } finally {
      setLoading(false);
    }

    // Anonymous case feedback is optional garnish — never block the dashboard on it.
    try {
      const fb = await apiFetch('/feedback/summary');
      if (fb.success) setFeedback(fb);
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="container page"><div className="loading-state">Loading ICC operational metrics…</div></div>;
  }

  const { stats = {}, compliance = {}, recentComplaints = [], recentLogs = [] } = data || {};
  const buckets = compliance.buckets || {};
  const offenders = compliance.offenders || [];

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><Scale size={22} /> ICC Grievance Management Workspace</h1>
          <p className="page-sub">
            Statutory complaint processing, case load administration and the compliance clock for
            every open inquiry.
          </p>
        </div>
        <div className="page-actions">
          <Link to="/admin/case-allocation" className="btn btn-secondary btn-sm">
            <ClipboardList size={15} /> Allocate Cases
          </Link>
          <Link to="/admin/complaints" className="btn btn-primary btn-sm">
            Case Repository <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <Announcements />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={16} /> <span>{error}</span>
        </div>
      )}

      {/* Operational metrics */}
      <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard icon={ShieldAlert} label="New Registered" value={stats.newComplaints || 0} sub="Requires initial scrutiny" />
        <StatCard
          icon={AlertTriangle}
          label="Past a Deadline"
          value={stats.statutoryOverdue || 0}
          sub={`${stats.statutoryDueSoon || 0} due within 7 days`}
        />
        <StatCard icon={Clock} label="Approaching SLA" value={stats.approachingSLA || 0} sub="< 48 hours remaining" />
        <StatCard icon={FileSearch} label="Under Active Review" value={stats.underReview || 0} sub={`${stats.unassigned || 0} unassigned`} />
        <StatCard icon={CheckCircle2} label="Total Resolved" value={stats.resolved || 0} sub="Finalised cases" />
      </div>

      {/* Statutory compliance */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title"><ShieldCheck size={18} /> Statutory Compliance Clock</h3>
          <span className={`chip ${(compliance.overdue || 0) > 0 ? 'chip-crimson' : 'chip-emerald'}`}>
            {(compliance.overdue || 0) > 0
              ? `${compliance.overdue} case${compliance.overdue === 1 ? '' : 's'} past a deadline`
              : 'All deadlines met'}
          </span>
        </div>

        <div className="stat-row" style={{ marginBottom: '1.25rem' }}>
          <div>
            <span className="field-label">Open cases</span>
            <strong>{compliance.openCases || 0}</strong>
          </div>
          <div>
            <span className="field-label">Unassigned</span>
            <strong>{compliance.unassigned || 0}</strong>
          </div>
          <div>
            <span className="field-label">Case age</span>
            <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {['0-7', '8-30', '31-90', '90+'].map(key => (
                <span key={key} className={`chip ${key === '90+' ? 'chip-crimson' : key === '31-90' ? 'chip-amber' : 'chip-slate'}`}>
                  {key} d · {buckets[key] || 0}
                </span>
              ))}
            </span>
          </div>
        </div>

        {offenders.length === 0 ? (
          <div className="alert alert-success" style={{ marginBottom: 0 }}>
            <CheckCircle2 size={16} />
            <span>No case is past a POSH statutory deadline. Escalations fire automatically the moment one is.</span>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="nowrap">Case</th>
                  <th>Missed deadline</th>
                  <th className="hide-sm">Assigned officer</th>
                  <th className="num nowrap">Days open</th>
                </tr>
              </thead>
              <tbody>
                {offenders.map(o => (
                  <tr key={o.id}>
                    <td>
                      <div className="cell-stack">
                        <Link to={`/admin/complaints/${o.id}`} className="cell-mono" style={{ fontWeight: 600 }}>
                          {o.referenceId}
                        </Link>
                        <span className="cell-muted truncate" style={{ maxWidth: '220px' }} title={o.title}>{o.title}</span>
                      </div>
                    </td>
                    <td><span className="chip chip-crimson">{(o.overdueMilestones || []).join(', ') || 'Statutory deadline'}</span></td>
                    <td className="hide-sm">{o.assignedAdminName || <span className="chip chip-slate">Unassigned</span>}</td>
                    <td className="num">{o.daysOpen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="split-sidebar">
        {/* Active complaints */}
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-header" style={{ padding: '1.25rem 1.4rem 0.75rem' }}>
            <h2 className="panel-title"><FileSearch size={18} /> Cases Requiring Attention</h2>
            <Link to="/admin/complaints" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-900)' }}>
              View all ({stats.total || 0}) →
            </Link>
          </div>

          {recentComplaints.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={28} />
              <strong>Nothing needs your attention</strong>
              <p>New complaints will appear here as soon as students file them.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="nowrap">Ref ID</th>
                    <th>Student</th>
                    <th className="hide-md">Category</th>
                    <th>Status</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {recentComplaints.map(c => {
                    const { displayName, rest } = splitStudentName(c.studentName, c.studentRollNo);
                    return (
                      <tr key={c.id}>
                        <td className="nowrap">
                          <Link to={`/admin/complaints/${c.id}`} className="cell-mono" style={{ fontWeight: 700, color: 'var(--color-navy-900)' }}>
                            {c.referenceId}
                          </Link>
                          {(c.priority === 'Urgent' || c.priority === 'High') && (
                            <div><span className="chip chip-crimson" style={{ marginTop: '0.2rem' }}>{c.priority}</span></div>
                          )}
                        </td>
                        <td>
                          <div className="cell-stack">
                            <span style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{displayName}</span>
                            <span className="cell-muted truncate" title={c.studentDept}>
                              {rest ? `${rest} · ` : ''}{c.studentDept}
                            </span>
                          </div>
                        </td>
                        <td className="hide-md truncate" style={{ maxWidth: '180px' }}>{c.category}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>
                          <Link to={`/admin/complaints/${c.id}`} aria-label={`Manage ${c.referenceId}`} style={{ display: 'inline-flex' }}>
                            <ArrowRight size={15} style={{ color: 'var(--color-slate-400)' }} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          {/* Anonymous feedback */}
          {feedback && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title" style={{ fontSize: '1rem' }}><Star size={16} /> Complainant Feedback</h3>
                <span className="chip chip-slate">{feedback.totalResponses} response{feedback.totalResponses === 1 ? '' : 's'}</span>
              </div>

              <div className="stat-row" style={{ marginBottom: '1rem' }}>
                <div>
                  <span className="field-label">Overall</span>
                  <strong>{feedback.overall != null ? `${feedback.overall}/5` : '—'}</strong>
                </div>
                <div>
                  <span className="field-label">Response rate</span>
                  <strong>{feedback.responseRate}%</strong>
                </div>
                <div>
                  <span className="field-label">Resolved cases</span>
                  <strong>{feedback.resolvedCases}</strong>
                </div>
              </div>

              {!feedback.totalResponses ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', margin: 0 }}>
                  Feedback opens to complainants once their case is resolved. Ratings are stored
                  without any link to the person who gave them.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[['feltHeard', 'Felt heard'], ['processFair', 'Process felt fair'], ['timeliness', 'Timeliness'], ['clearCommunication', 'Clear communication']].map(([key, label]) => {
                    const value = feedback.averages?.[key];
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-slate-600)', marginBottom: '0.2rem' }}>
                          <span>{label}</span>
                          <strong>{value != null ? `${value}/5` : '—'}</strong>
                        </div>
                        <span className="meter">
                          <span className="meter-fill" style={{ width: `${value ? (value / 5) * 100 : 0}%`, background: 'var(--color-emerald-700)' }} />
                        </span>
                      </div>
                    );
                  })}
                  {(feedback.recentComments || []).length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {feedback.recentComments.slice(0, 3).map((c, i) => (
                        <div key={i} style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.7rem' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-700)', margin: 0, overflowWrap: 'anywhere' }}>"{c.comment}"</p>
                          <span style={{ fontSize: '0.625rem', color: 'var(--color-slate-400)' }}>
                            Anonymous · {formatDate(c.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Audit stream */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '1rem' }}>Recent Audit Activity</h3>
              <Link to="/super-admin/audit-logs" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-navy-900)' }}>
                Full trail →
              </Link>
            </div>
            {recentLogs.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', margin: 0 }}>No activity recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentLogs.map(log => (
                  <div key={log.id} style={{ borderBottom: '1px solid var(--color-slate-100)', paddingBottom: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-navy-900)' }}>{log.action}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', marginTop: '0.1rem', overflowWrap: 'anywhere' }}>
                      {log.details}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', marginTop: '0.2rem' }}>
                      By {log.actorName} ({log.actorRole}) • {formatDate(log.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
