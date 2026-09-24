import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import {
  BookOpen, Users, FileText, AlertTriangle, Clock, ArrowRight, ShieldCheck,
  BarChart3, CalendarClock, CheckCircle2,
} from 'lucide-react';

export default function FacultyDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    setError('');
    try {
      const res = await apiFetch('/faculty/dashboard');
      if (res.success) setData(res);
    } catch (err) {
      setError(err.message || 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container page"><div className="loading-state">Loading faculty dashboard…</div></div>;
  }

  const { stats = {}, recentComplaints = [], notifications = [], compliance = {} } = data || {};
  const buckets = compliance.buckets || {};
  const offenders = compliance.offenders || [];
  const openCases = compliance.openCases || 0;

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><BookOpen size={22} /> Faculty Dashboard</h1>
          <p className="page-sub">
            Department oversight, student grievances and the statutory clock for every open case.
          </p>
        </div>
        <div className="page-actions">
          <Link to="/faculty/complaints/new" className="btn btn-emerald btn-sm">
            <FileText size={15} /> File Complaint for Student
          </Link>
          <Link to="/faculty/complaints" className="btn btn-secondary btn-sm">
            Department Cases
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={16} /> <span>{error}</span>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Department Complaints</div>
          <div className="stat-value">{stats.deptTotal || 0}</div>
          <div className="stat-sub">{stats.deptActive || 0} active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Resolved in Dept</div>
          <div className="stat-value">{stats.deptResolved || 0}</div>
          <div className="stat-sub">Cases closed</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Assigned to Me</div>
          <div className="stat-value">{stats.assignedTotal || 0}</div>
          <div className="stat-sub">{stats.assignedActive || 0} active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deadlines at Risk</div>
          <div className="stat-value">{stats.statutoryOverdue || 0}</div>
          <div className="stat-sub">{stats.statutoryDueSoon || 0} due soon</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Students in Dept</div>
          <div className="stat-value">{stats.deptStudents || 0}</div>
          <div className="stat-sub">Under your department</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <Link to="/faculty/complaints" className="panel" style={{ textDecoration: 'none', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={22} style={{ color: 'var(--color-navy-700)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--color-navy-900)', fontSize: '0.9375rem' }}>View Complaints</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Browse department cases</div>
          </div>
        </Link>
        <Link to="/faculty/complaints/new" className="panel" style={{ textDecoration: 'none', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={22} style={{ color: 'var(--color-navy-700)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--color-navy-900)', fontSize: '0.9375rem' }}>File Complaint</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Report on behalf of a student</div>
          </div>
        </Link>
        <Link to="/faculty/students" className="panel" style={{ textDecoration: 'none', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Users size={22} style={{ color: 'var(--color-navy-700)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--color-navy-900)', fontSize: '0.9375rem' }}>Student Directory</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Students in your department</div>
          </div>
        </Link>
      </div>

      <div className="split-sidebar">
        <div>
          {/* Department statutory health */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><ShieldCheck size={18} /> Department Compliance Clock</h3>
              <span className="toolbar-meta">{openCases} open case{openCases === 1 ? '' : 's'}</span>
            </div>

            <div className="stat-row" style={{ marginBottom: '1.25rem' }}>
              <div>
                <span className="field-label">Overdue</span>
                <strong style={{ color: (compliance.overdue || 0) > 0 ? 'var(--color-crimson-700)' : undefined }}>
                  {compliance.overdue || 0}
                </strong>
              </div>
              <div>
                <span className="field-label">Due soon</span>
                <strong>{compliance.dueSoon || 0}</strong>
              </div>
              <div>
                <span className="field-label">Unassigned</span>
                <strong>{compliance.unassigned || 0}</strong>
              </div>
            </div>

            <span className="field-label"><BarChart3 size={11} style={{ verticalAlign: '-1px' }} /> Case age</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {['0-7', '8-30', '31-90', '90+'].map(range => (
                <span key={range} className={`chip ${range === '90+' ? 'chip-crimson' : range === '31-90' ? 'chip-amber' : 'chip-slate'}`}>
                  {range} days · {buckets[range] || 0}
                </span>
              ))}
            </div>

            {offenders.length === 0 ? (
              <div className="alert alert-success" style={{ marginBottom: 0 }}>
                <CheckCircle2 size={16} />
                <span>No missed statutory deadlines in your department.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {offenders.map(c => (
                  <Link
                    key={c.id}
                    to={`/faculty/complaints/${c.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.85rem',
                      border: '1px solid var(--border-crimson)', background: 'var(--color-crimson-50)', borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                    }}
                  >
                    <AlertTriangle size={16} style={{ color: 'var(--color-crimson-700)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>{c.referenceId}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="truncate" style={{ fontSize: '0.75rem', color: 'var(--text-crimson-strong)' }}>
                        {c.overdueMilestones?.join(', ') || 'Deadline missed'} · open {c.daysOpen} days
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--color-slate-400)', flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent department complaints */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><Clock size={18} /> Recent Department Complaints</h3>
              <Link to="/faculty/complaints" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-900)' }}>View all →</Link>
            </div>
            {recentComplaints.length === 0 ? (
              <div className="empty-state">
                <FileText size={26} />
                <strong>No complaints in your department yet</strong>
                <p>Cases raised by students of your department will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentComplaints.map(c => (
                  <Link
                    key={c.id}
                    to={`/faculty/complaints/${c.id}`}
                    className="list-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                      border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>{c.referenceId}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="truncate" style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', margin: 0 }}>{c.title}</p>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)' }}>
                        {c.studentName} • {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--color-slate-400)', flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>Recent Notifications</h3>
          </div>
          {notifications.length === 0 ? (
            <div className="empty-state">
              <CalendarClock size={24} />
              <strong>Nothing new</strong>
              <p>Updates about your department's cases will show up here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    padding: '0.75rem',
                    background: n.isRead ? 'var(--color-slate-100)' : 'var(--color-emerald-50)',
                    border: '1px solid var(--color-slate-200)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>{n.title}</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)', margin: '0.2rem 0 0', overflowWrap: 'anywhere' }}>{n.message}</p>
                  <span style={{ fontSize: '0.625rem', color: 'var(--color-slate-400)' }}>{formatDate(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
