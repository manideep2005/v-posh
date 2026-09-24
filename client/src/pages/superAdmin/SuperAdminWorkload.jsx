import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import {
  BarChart3, Users, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  ArrowLeft, Gauge, UserCheck,
} from 'lucide-react';

// ─── Reusable mini-chart components (pure CSS, zero dependencies) ─────────

function DonutSegment({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', minWidth: 0 }}>
      <span style={{ width: 10, height: 10, borderRadius: '2px', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, color: 'var(--color-slate-700)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {pct}%
      </span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="stat-head">
        <span className="stat-icon" style={{ background: 'var(--color-slate-100)', color }}>
          <Icon size={15} />
        </span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const STATUS_COLORS = {
  Submitted: '#6366F1',
  Acknowledged: '#3B82F6',
  Investigation: '#8B5CF6',
  'Under Review': '#F59E0B',
  'Action Taken': '#F97316',
  Resolved: '#10B981',
};

const PRIORITY_COLORS = {
  Low: '#6B7280',
  Medium: '#F59E0B',
  High: '#EF4444',
  Urgent: '#DC2626',
};

// ─── Main Component ───────────────────────────────────────────────────────

export default function SuperAdminWorkload() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await apiFetch('/super-admin/workload');
      if (res.success) setData(res);
      else setError(res.message || 'Failed to load workload data.');
    } catch (err) {
      setError(err.message || 'Failed to load workload analytics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <div className="loading-block"><span className="spinner" /> Loading workload analytics…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container page">
        <div className="alert alert-danger"><AlertTriangle size={16} /> <span>{error}</span></div>
      </div>
    );
  }

  const { officerMetrics = [], systemOverview = {}, monthlyData = [] } = data || {};
  const { statusDistribution = {}, priorityDistribution = {} } = systemOverview;

  const statusOrder = ['Submitted', 'Acknowledged', 'Under Review', 'Investigation', 'Action Taken', 'Resolved'];
  const sortedStatus = statusOrder.filter(s => statusDistribution[s]).map(s => ({ label: s, value: statusDistribution[s] }));
  const maxStatus = Math.max(...sortedStatus.map(s => s.value), 1);

  const sortedPriority = ['Low', 'Medium', 'High', 'Urgent']
    .filter(p => priorityDistribution[p])
    .map(p => ({ label: p, value: priorityDistribution[p] }));
  const priorityTotal = Object.values(priorityDistribution).reduce((a, b) => a + b, 0);

  const monthlyMax = Math.max(...monthlyData.map(m => m.total), 1);
  const overloaded = officerMetrics.filter(o => (o.activeCases || 0) > 5).length;

  return (
    <div className="container page">
      {/* Header */}
      <div className="page-head">
        <div className="page-head-main">
          <Link to="/super-admin/dashboard" className="crumbs">
            <ArrowLeft size={13} /> Back to dashboard
          </Link>
          <h1><BarChart3 size={22} /> Workload Analytics</h1>
          <p className="page-sub">
            Officer case assignments, resolution metrics, SLA compliance and monthly filing trends
            across the committee.
          </p>
        </div>
        {overloaded > 0 && (
          <div className="page-actions">
            <span className="chip chip-crimson">
              <AlertTriangle size={12} /> {overloaded} officer{overloaded === 1 ? '' : 's'} over 5 active cases
            </span>
          </div>
        )}
      </div>

      {/* System overview */}
      <div className="stats-grid">
        <MetricCard
          icon={FileText}
          label="Total Complaints"
          value={systemOverview.totalComplaints || 0}
          color="#3B82F6"
          sub={`${systemOverview.totalActive || 0} currently active`}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Resolved Cases"
          value={systemOverview.totalResolved || 0}
          color="#10B981"
          sub={`${systemOverview.overallResolutionRate || 0}% resolution rate`}
        />
        <MetricCard
          icon={Users}
          label="Active Officers"
          value={systemOverview.totalOfficers || 0}
          color="#8B5CF6"
          sub={`${systemOverview.unassigned || 0} unassigned cases`}
        />
        <MetricCard
          icon={AlertTriangle}
          label="SLA Breaches"
          value={systemOverview.totalSlaBreaches || 0}
          color={systemOverview.totalSlaBreaches > 0 ? '#EF4444' : '#10B981'}
          sub="Cases open beyond 7 days"
        />
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Monthly trends */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              <TrendingUp size={17} /> Monthly filings (last 6 months)
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: 'var(--color-slate-600)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, background: '#6366F1', borderRadius: 2 }} /> Filed
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, background: '#10B981', borderRadius: 2 }} /> Resolved
              </span>
            </div>
          </div>

          {monthlyData.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <BarChart3 size={28} />
              <strong>No filing history yet</strong>
              <p>Monthly trends appear once complaints are registered.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.65rem', height: 168, padding: '0 0.25rem' }}>
              {monthlyData.map((d, i) => {
                const totalH = Math.max((d.total / monthlyMax) * 112, 4);
                const resolvedH = Math.max((d.resolved / monthlyMax) * 112, 4);
                return (
                  <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-navy-900)' }}>
                      {d.total}/{d.resolved}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 112, width: '100%' }}>
                      <span
                        style={{ width: '38%', maxWidth: 20, height: totalH, background: '#6366F1', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }}
                        title={`Filed: ${d.total}`}
                      />
                      <span
                        style={{ width: '38%', maxWidth: 20, height: resolvedH, background: '#10B981', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }}
                        title={`Resolved: ${d.resolved}`}
                      />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-slate-500)', whiteSpace: 'nowrap' }}>{d.month}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status distribution */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              <Gauge size={17} /> Case status distribution
            </h3>
          </div>

          {sortedStatus.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <Gauge size={28} />
              <strong>No status data</strong>
              <p>Case statuses will be summarised here once filings exist.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {sortedStatus.map((s, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-slate-700)' }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-navy-900)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                  </div>
                  <div className="meter">
                    <span
                      className="meter-fill"
                      style={{
                        width: `${Math.max(Math.round((s.value / maxStatus) * 100), 3)}%`,
                        background: STATUS_COLORS[s.label] || '#6366F1',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {sortedPriority.length > 0 && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-slate-200)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-navy-900)', marginBottom: '0.75rem' }}>
                Priority breakdown
              </h4>
              <div className="grid-2" style={{ gap: '0.5rem 1rem' }}>
                {sortedPriority.map((p, i) => (
                  <DonutSegment key={i} label={p.label} count={p.value} total={priorityTotal} color={PRIORITY_COLORS[p.label]} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Officer performance */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: '1rem' }}>
            <UserCheck size={17} /> Officer performance
          </h3>
          <span className="toolbar-meta">Sorted by active workload</span>
        </div>

        {officerMetrics.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <strong>No committee officers yet</strong>
            <p>Provision ICC administrators to start tracking case load and resolution performance.</p>
          </div>
        ) : (
          <div className="card-grid">
            {officerMetrics.map(off => {
              const breakdown = off.statusBreakdown || {};
              const load = off.activeCases || 0;
              const accent = load > 5 ? '#EF4444' : load > 2 ? '#F59E0B' : '#10B981';
              return (
                <div key={off.id} className="person-card">
                  <span className="person-card-accent" style={{ background: accent }} />

                  <div className="person-head">
                    <div style={{ minWidth: 0 }}>
                      <div className="cell-strong" style={{ fontSize: '0.9375rem' }}>{off.name}</div>
                      <div className="cell-muted">{off.designation} • {off.department}</div>
                      <div className="cell-muted truncate" style={{ maxWidth: '100%' }} title={off.email}>{off.email}</div>
                    </div>
                    <span
                      className={`chip ${load > 5 ? 'chip-crimson' : load > 2 ? 'chip-amber' : 'chip-emerald'}`}
                    >
                      {load} active
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div style={{ textAlign: 'center', padding: '0.5rem 0.25rem', background: 'var(--color-slate-50)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="dist-count" style={{ fontSize: '1.125rem' }}>{off.totalAssigned}</div>
                      <div className="cell-muted" style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.5rem 0.25rem', background: 'var(--color-emerald-50)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="dist-count" style={{ fontSize: '1.125rem', color: 'var(--color-emerald-900)' }}>{off.resolvedCases}</div>
                      <div className="cell-muted" style={{ fontSize: '0.625rem', color: 'var(--color-emerald-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.5rem 0.25rem', background: off.urgentCases > 0 ? 'var(--color-crimson-50)' : 'var(--color-slate-50)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="dist-count" style={{ fontSize: '1.125rem', color: off.urgentCases > 0 ? 'var(--color-crimson-700)' : 'var(--color-slate-700)' }}>{off.urgentCases}</div>
                      <div className="cell-muted" style={{ fontSize: '0.625rem', color: off.urgentCases > 0 ? 'var(--color-crimson-700)' : undefined, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgent</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--color-slate-600)' }}>Resolution rate</span>
                      <span style={{ fontWeight: 700, color: off.resolutionRate >= 70 ? 'var(--color-emerald-700)' : off.resolutionRate >= 40 ? 'var(--color-amber-700)' : 'var(--color-crimson-700)' }}>
                        {off.resolutionRate}%
                      </span>
                    </div>
                    <div className="meter">
                      <span
                        className="meter-fill"
                        style={{
                          width: `${off.resolutionRate}%`,
                          background: off.resolutionRate >= 70 ? '#10B981' : off.resolutionRate >= 40 ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderTop: '1px solid var(--color-slate-100)', paddingTop: '0.6rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: off.avgResolutionHours !== null ? 'var(--color-slate-600)' : 'var(--color-slate-400)' }}>
                      <Clock size={12} /> {off.avgResolutionHours !== null ? `~${off.avgResolutionHours}h avg` : 'No resolved cases'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: off.slaBreaches > 0 ? 'var(--color-crimson-700)' : 'var(--color-slate-500)' }}>
                      <AlertTriangle size={12} /> {off.slaBreaches} SLA {off.slaBreaches === 1 ? 'breach' : 'breaches'}
                    </span>
                  </div>

                  {Object.keys(breakdown).length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                      {Object.entries(breakdown).map(([status, count]) => (
                        <span key={status} style={{ fontSize: '0.625rem', padding: '1px 7px', borderRadius: '99px', background: STATUS_COLORS[status] || '#6B7280', color: '#fff', fontWeight: 600 }}>
                          {status}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
