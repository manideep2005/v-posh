import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import Sparkline from '../../components/Sparkline';
import {
  Users, Settings, ArrowRight, Clock, AlertTriangle,
  FolderTree, Building2, ShieldCheck, BarChart3, Scale,
  TrendingUp, Activity,
} from 'lucide-react';
import Announcements from '../../components/Announcements';

/* ─── Shared Metric Row ──────────────────────────────────────────────────── */
function MetricPill({ icon: Icon, label, value, sub }) {
  return (
    <div style={{
      background: 'var(--color-slate-50)',
      border: '1px solid var(--color-slate-200)',
      borderRadius: 'var(--radius-md)',
      padding: '0.85rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.85rem',
      minWidth: 0,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-slate-100)', border: '1px solid var(--color-slate-200)',
        flexShrink: 0, color: 'var(--color-navy-700)',
      }}>
        <Icon size={17} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-navy-900)', lineHeight: 1.2, marginTop: '1px' }}>{value}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Distribution Bar ───────────────────────────────────────────────────── */
function DistBar({ title, icon: Icon, rows }) {
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="panel-header">
        <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
          <Icon size={16} /> {title}
        </h3>
        <span className="toolbar-meta">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="cell-muted" style={{ textAlign: 'center', padding: '1.25rem 0', fontSize: '0.8125rem' }}>No data yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {rows.map((r, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-navy-800)' }}>{r.name}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-500)' }}>{r.count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--color-slate-200)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(Math.round((r.count / max) * 100), 4)}%`,
                  height: '100%',
                  background: 'var(--color-navy-700)',
                  borderRadius: 999,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Compliance Grid ────────────────────────────────────────────────────── */
function ComplianceGrid({ compliance, escalations }) {
  if (!compliance) return null;
  const items = [
    { label: 'Open cases', value: compliance.openCases || 0, sub: `${compliance.unassigned || 0} unassigned` },
    { label: 'Past deadline', value: compliance.overdue || 0, sub: 'Statutory clock' },
    { label: 'Due in 7 days', value: compliance.dueSoon || 0, sub: 'Act before lapse' },
    { label: 'Escalations (7d)', value: escalations?.last7Days || 0, sub: `L1 ${escalations?.byLevel?.L1 || 0} · L2 ${escalations?.byLevel?.L2 || 0} · L3 ${escalations?.byLevel?.L3 || 0}` },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
      {items.map((it, i) => <MetricPill key={i} {...it} icon={Clock} />)}
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */
export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/super-admin/dashboard');
      if (res.success) setData(res);
      else setError(res.message || 'Failed to load dashboard.');
    } catch (err) {
      setError(err.message || 'Failed to load super admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="container page">
      <div className="loading-block"><span className="spinner" /> Loading system metrics…</div>
    </div>
  );

  if (error) return (
    <div className="container page">
      <div className="alert alert-danger"><AlertTriangle size={16} /> <span>{error}</span></div>
    </div>
  );

  const { stats, categoryStats = [], departmentStats = [], recentAuditLogs = [], compliance, escalations, ledger, feedback, monthlyData = [] } = data || {};

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const activeShare = stats?.totalComplaints
    ? Math.round(((stats.activeComplaints || 0) / stats.totalComplaints) * 100)
    : 0;

  return (
    <div className="container page" style={{ paddingBottom: '3rem' }}>
      {/* ─── Hero Header ──────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--color-navy-900)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.75rem 2rem 1.5rem',
        marginBottom: '1.5rem',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
              {getGreeting()}, Administrator
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)', maxWidth: '480px', lineHeight: 1.5, margin: 0 }}>
              System-wide compliance monitoring and statutory oversight for VIT-AP University's POSH grievance platform.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to="/super-admin/workload" style={{
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex',
              alignItems: 'center', gap: '0.4rem', textDecoration: 'none', transition: 'background 0.15s',
            }}>
              <BarChart3 size={14} /> Workload
            </Link>
            <Link to="/super-admin/admins" style={{
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex',
              alignItems: 'center', gap: '0.4rem', textDecoration: 'none',
            }}>
              <Users size={14} /> Manage Staff
            </Link>
            <Link to="/super-admin/settings" style={{
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex',
              alignItems: 'center', gap: '0.4rem', textDecoration: 'none',
            }}>
              <Settings size={14} /> Settings
            </Link>
          </div>
        </div>
      </div>

      <Announcements />

      {/* ─── Primary Metrics ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <MetricPill icon={Users} label="Total Users" value={stats?.totalUsers || 0} sub={`${stats?.studentsCount || 0} students · ${stats?.adminsCount || 0} staff`} />
        <MetricPill icon={FolderTree} label="Grievances" value={stats?.totalComplaints || 0} sub="All departments" />
        <MetricPill icon={TrendingUp} label="Active Cases" value={stats?.activeComplaints || 0} sub={`${activeShare}% in inquiry`} />
        <MetricPill icon={Activity} label="Audit Entries" value={stats?.auditLogsCount || 0} sub="Immutable logs" />
      </div>

      {/* ─── Sparklines Row ────────────────────────────────────────────── */}
      {monthlyData.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monthly Filings</div>
            </div>
            <Sparkline data={monthlyData.map(m => m.total)} width={140} height={32} color="var(--color-navy-700)" label="Monthly filings" />
          </div>
          <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Backlog</div>
            </div>
            <Sparkline data={monthlyData.map(m => m.total - m.resolved)} width={140} height={32} color="var(--color-navy-700)" label="Pending backlog" />
          </div>
        </div>
      )}

      {/* ─── Compliance Section ────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
            <Scale size={16} /> Statutory Compliance
          </h3>
          <span className={`chip ${compliance?.overdue > 0 ? 'chip-crimson' : 'chip-emerald'}`}>
            {compliance?.overdue > 0 ? `${compliance.overdue} past deadline` : 'All deadlines met'}
          </span>
        </div>

        <ComplianceGrid compliance={compliance} escalations={escalations} />

        {/* Case Age Distribution */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-200)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Open Case Age Distribution
          </span>
          {(() => {
            const buckets = compliance?.buckets || {};
            const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
            const segments = [
              ['0-7', '#10B981'], ['8-30', '#F59E0B'], ['31-90', '#F97316'], ['90+', '#DC2626']
            ];
            return (
              <>
                <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--color-slate-200)', marginTop: '0.5rem' }}>
                  {segments.map(([key, color]) => (
                    buckets[key] ? (
                      <span key={key} title={`${key} days: ${buckets[key]}`} style={{ width: `${(buckets[key] / total) * 100}%`, background: color }} />
                    ) : null
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                  {segments.map(([key, color]) => (
                    <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                      {key}d: <strong style={{ color: 'var(--color-navy-800)' }}>{buckets[key] || 0}</strong>
                    </span>
                  ))}
                </div>
              </>
            );
          })()}

          {/* Record Integrity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-slate-200)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>
              Record Integrity
            </span>
            <span className={`chip ${ledger?.verified ? 'chip-emerald' : 'chip-crimson'}`}>
              <ShieldCheck size={11} /> {ledger?.verified ? 'Ledger intact' : 'Anomaly detected'}
            </span>
            <span className="chip chip-slate">{ledger?.chainedEntries || 0} chained</span>
            {feedback?.responses > 0 && <span className="chip chip-blue">{feedback.responses} feedback</span>}
          </div>
        </div>

        {/* Overdue Cases Table */}
        {(compliance?.offenders || []).length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-200)' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Missed deadline</th>
                    <th className="hide-sm">Officer</th>
                    <th className="num nowrap">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.offenders.map(o => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/admin/complaints/${o.id}`} className="cell-mono" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                          {o.referenceId}
                        </Link>
                      </td>
                      <td><span className="chip chip-crimson">{(o.overdueMilestones || []).join(', ')}</span></td>
                      <td className="hide-sm" style={{ fontSize: '0.8125rem' }}>{o.assignedAdminName || '—'}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{o.daysOpen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Distributions ─────────────────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <DistBar
          title="Complaints by Category"
          icon={FolderTree}
          rows={categoryStats.map(c => ({ name: c.name, count: c.count }))}
        />
        <DistBar
          title="Complaints by Department"
          icon={Building2}
          rows={departmentStats.map(d => ({ name: d.code ? `${d.name} (${d.code})` : d.name, count: d.count }))}
        />
      </div>

      {/* ─── Audit Trail ──────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
            <Activity size={16} /> Recent Audit Trail
          </h3>
          <Link to="/super-admin/audit-logs" className="crumbs" style={{ marginBottom: 0 }}>
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {recentAuditLogs.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={28} />
            <strong>No audit entries yet</strong>
            <p>Actions and status changes will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {recentAuditLogs.slice(0, 8).map((log, i) => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.65rem 0',
                borderBottom: i < recentAuditLogs.length - 1 ? '1px solid var(--color-slate-100)' : 'none',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-navy-700)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-navy-800)' }}>
                    {log.action}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', margin: '0 0.35rem' }}>by</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-navy-700)' }}>
                    {log.actorName}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', flexShrink: 0 }}>
                  {formatDate(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
