import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { BarChart3, Users, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, Shield, ArrowLeft } from 'lucide-react';

// ─── Reusable mini-chart components (pure CSS, zero dependencies) ─────────

function BarChart({ data, maxVal, barColor = 'var(--color-emerald-600)', labelKey = 'label', valueKey = 'value', height = 120 }) {
  const max = maxVal || Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height, padding: '0 4px' }}>
      {data.map((d, i) => {
        const h = Math.max((d[valueKey] / max) * (height - 28), 4);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: '700', color: 'var(--color-slate-700)' }}>{d[valueKey]}</span>
            <div style={{ width: '100%', height: h, background: barColor, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', minWidth: 12 }} />
            <span style={{ fontSize: '0.6rem', color: 'var(--color-slate-500)', textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

function DonutSegment({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
      <div style={{ width: 10, height: 10, borderRadius: '2px', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, color: 'var(--color-slate-700)' }}>{label}</span>
      <span style={{ fontWeight: '700', color: 'var(--color-navy-900)' }}>{count}</span>
      <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', width: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Icon size={16} style={{ color }} />
        <div className="stat-label" style={{ marginBottom: 0 }}>{label}</div>
      </div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

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

  if (loading) return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading workload analytics...</div>;
  if (error) return <div className="container" style={{ padding: '3rem 0' }}><div className="alert alert-danger">{error}</div></div>;

  const { officerMetrics = [], systemOverview = {}, monthlyData = [] } = data || {};
  const { statusDistribution = {}, priorityDistribution = {} } = systemOverview;

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

  // Sort status by display order
  const statusOrder = ['Submitted', 'Acknowledged', 'Under Review', 'Investigation', 'Action Taken', 'Resolved'];
  const sortedStatus = statusOrder.filter(s => statusDistribution[s]).map(s => ({ label: s, value: statusDistribution[s] }));
  const maxStatus = Math.max(...sortedStatus.map(s => s.value), 1);

  const sortedPriority = ['Low', 'Medium', 'High', 'Urgent'].filter(p => priorityDistribution[p]).map(p => ({ label: p, value: priorityDistribution[p] }));

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/super-admin/dashboard" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
            <BarChart3 size={28} /> Workload Analytics & Officer Performance
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Officer case assignments, resolution metrics, SLA compliance, and monthly trends
          </p>
        </div>
      </div>

      {/* ─── System Overview Metrics ─── */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <MetricCard icon={FileText} label="Total Complaints" value={systemOverview.totalComplaints || 0} color="#3B82F6" sub={`${systemOverview.totalActive || 0} active`} />
        <MetricCard icon={CheckCircle2} label="Resolved Cases" value={systemOverview.totalResolved || 0} color="#10B981" sub={`${systemOverview.overallResolutionRate || 0}% resolution rate`} />
        <MetricCard icon={Users} label="Active Officers" value={systemOverview.totalOfficers || 0} color="#8B5CF6" sub={`${systemOverview.unassigned || 0} unassigned cases`} />
        <MetricCard icon={AlertTriangle} label="SLA Breaches" value={systemOverview.totalSlaBreaches || 0} color={systemOverview.totalSlaBreaches > 0 ? '#EF4444' : '#10B981'} sub="Cases open > 7 days" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* ─── Monthly Trends Chart ─── */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              <TrendingUp size={18} /> Monthly Complaint Trends (Last 6 Months)
            </h3>
          </div>
          {monthlyData.length > 0 ? (
            <div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--color-slate-600)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, background: '#6366F1', borderRadius: 2, display: 'inline-block' }} /> Total Filed</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, background: '#10B981', borderRadius: 2, display: 'inline-block' }} /> Resolved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: 140, padding: '0 4px' }}>
                {monthlyData.map((d, i) => {
                  const max = Math.max(...monthlyData.map(m => m.total), 1);
                  const totalH = Math.max((d.total / max) * 110, 4);
                  const resolvedH = Math.max((d.resolved / max) * 110, 4);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 110 }}>
                        <div style={{ width: '45%', height: totalH, background: '#6366F1', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} title={`Filed: ${d.total}`} />
                        <div style={{ width: '45%', height: resolvedH, background: '#10B981', borderRadius: '3px 3px 0 0', transition: 'height 0.4s' }} title={`Resolved: ${d.resolved}`} />
                      </div>
                      <div style={{ fontSize: '0.625rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>{d.total}/{d.resolved}</div>
                      <span style={{ fontSize: '0.625rem', color: 'var(--color-slate-500)' }}>{d.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', textAlign: 'center', padding: '2rem' }}>No monthly data available.</p>
          )}
        </div>

        {/* ─── Status Distribution ─── */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              <BarChart3 size={18} /> Case Status Distribution
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedStatus.map((s, i) => {
              const pct = maxStatus > 0 ? Math.round((s.value / maxStatus) * 100) : 0;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-slate-700)' }}>{s.label}</span>
                    <span style={{ fontWeight: '700', color: 'var(--color-navy-900)' }}>{s.value}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-slate-200)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLORS[s.label] || '#6366F1', borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-slate-200)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '0.75rem' }}>Priority Breakdown</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {sortedPriority.map((p, i) => (
                <DonutSegment key={i} label={p.label} count={p.value} total={Object.values(priorityDistribution).reduce((a, b) => a + b, 0)} color={PRIORITY_COLORS[p.label]} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Officer Performance Cards ─── */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: '1rem' }}>
            <Users size={18} /> Officer Performance Metrics
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
            Sorted by active workload (highest first)
          </span>
        </div>

        {officerMetrics.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', textAlign: 'center', padding: '2rem' }}>No officers found.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {officerMetrics.map(off => (
              <div key={off.id} style={{ border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', background: '#fff', position: 'relative', overflow: 'hidden' }}>
                {/* Load indicator stripe */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: off.activeCases > 5 ? '#EF4444' : off.activeCases > 2 ? '#F59E0B' : '#10B981' }} />

                {/* Officer header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9375rem', color: 'var(--color-navy-900)' }}>{off.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{off.designation} • {off.department}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-slate-400)' }}>{off.email}</div>
                  </div>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: '700', padding: '2px 10px', borderRadius: '99px',
                    background: off.activeCases > 5 ? '#FEE2E2' : off.activeCases > 2 ? '#FEF3C7' : '#D1FAE5',
                    color: off.activeCases > 5 ? '#991B1B' : off.activeCases > 2 ? '#92400E' : '#065F46'
                  }}>
                    {off.activeCases} Active
                  </span>
                </div>

                {/* Metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--color-slate-50)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '800', color: 'var(--color-navy-900)' }}>{off.totalAssigned}</div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.5rem', background: '#D1FAE5', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#065F46' }}>{off.resolvedCases}</div>
                    <div style={{ fontSize: '0.625rem', color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.5rem', background: off.urgentCases > 0 ? '#FEE2E2' : 'var(--color-slate-50)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '800', color: off.urgentCases > 0 ? '#991B1B' : 'var(--color-slate-700)' }}>{off.urgentCases}</div>
                    <div style={{ fontSize: '0.625rem', color: off.urgentCases > 0 ? '#991B1B' : 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgent</div>
                  </div>
                </div>

                {/* Performance bar */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--color-slate-600)' }}>Resolution Rate</span>
                    <span style={{ fontWeight: '700', color: off.resolutionRate >= 70 ? '#065F46' : off.resolutionRate >= 40 ? '#92400E' : '#991B1B' }}>{off.resolutionRate}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-slate-200)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${off.resolutionRate}%`, background: off.resolutionRate >= 70 ? '#10B981' : off.resolutionRate >= 40 ? '#F59E0B' : '#EF4444', borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                </div>

                {/* Bottom stats row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderTop: '1px solid var(--color-slate-100)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: off.avgResolutionHours !== null ? 'var(--color-slate-600)' : 'var(--color-slate-400)' }}>
                    <Clock size={12} /> {off.avgResolutionHours !== null ? `~${off.avgResolutionHours}h avg` : 'No resolved'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: off.slaBreaches > 0 ? '#991B1B' : 'var(--color-slate-500)' }}>
                    <AlertTriangle size={12} /> {off.slaBreaches} SLA {off.slaBreaches === 1 ? 'breach' : 'breaches'}
                  </span>
                </div>

                {/* Status breakdown mini */}
                {Object.keys(off.statusBreakdown).length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {Object.entries(off.statusBreakdown).map(([status, count]) => (
                      <span key={status} style={{ fontSize: '0.625rem', padding: '1px 6px', borderRadius: '99px', background: STATUS_COLORS[status] || '#6B7280', color: '#fff', fontWeight: '600' }}>
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
