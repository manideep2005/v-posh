import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import { ShieldCheck, Users, FileText, Activity, AlertTriangle, ArrowRight, Settings, Sparkles, Megaphone } from 'lucide-react';
import Announcements from '../../components/Announcements';

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/super-admin/dashboard');
      if (res.success) {
        setData(res);
      } else {
        setError(res.message || 'Failed to load dashboard data.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load super admin dashboard. Make sure you are logged in as a super admin.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading system metrics...</div>;
  }

  if (error) {
    return <div className="container" style={{ padding: '3rem 0' }}><div className="alert alert-danger">{error}</div></div>;
  }

  const { stats, categoryStats = [], departmentStats = [], recentAuditLogs = [] } = data || {};

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Good Morning', emoji: '☀️', color: '#F59E0B' };
    if (h < 17) return { text: 'Good Afternoon', emoji: '🌤️', color: '#3B82F6' };
    return { text: 'Good Evening', emoji: '🌙', color: '#8B5CF6' };
  };
  const greeting = getGreeting();

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            {greeting.emoji} {greeting.text}, Admin!
          </h1>
          <p style={{ color: 'var(--color-slate-500)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            System-wide compliance monitoring and statutory oversight
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/super-admin/admins" className="btn btn-emerald btn-sm"><Users size={14} /> Manage Staff</Link>
          <Link to="/super-admin/settings" className="btn btn-secondary btn-sm"><Settings size={14} /> Settings</Link>
        </div>
      </div>

      {/* Announcements */}
      <Announcements />

      {/* Metrics Grid */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total System Users</div>
          <div className="stat-value">{stats?.totalUsers || 0}</div>
          <div className="stat-sub">{stats?.studentsCount} Students • {stats?.adminsCount} Staff</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-blue-700)' }}>
          <div className="stat-label">Total Registered Grievances</div>
          <div className="stat-value">{stats?.totalComplaints || 0}</div>
          <div className="stat-sub">Across all departments</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-amber-700)' }}>
          <div className="stat-label">Active Cases Underway</div>
          <div className="stat-value">{stats?.activeComplaints || 0}</div>
          <div className="stat-sub">Inquiry in progress</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-emerald-700)' }}>
          <div className="stat-label">Total Audit Trail Logs</div>
          <div className="stat-value">{stats?.auditLogsCount || 0}</div>
          <div className="stat-sub">Immutable statutory logs</div>
        </div>
      </div>

      {/* Category Breakdown & Department Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Category breakdown */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              Complaints Distribution by Category
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {categoryStats.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', textAlign: 'center', padding: '1rem' }}>No categories defined.</p>
              ) : categoryStats.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-slate-100)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--color-navy-900)', fontWeight: '500' }}>{c.name}</span>
                <span className="badge badge-submitted">{c.count} Case(s)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department breakdown */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              Complaints Distribution by Department
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {departmentStats.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', textAlign: 'center', padding: '1rem' }}>No departments defined.</p>
              ) : departmentStats.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-slate-100)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--color-navy-900)', fontWeight: '500' }}>{d.name} ({d.code})</span>
                <span className="badge badge-acknowledged">{d.count} Case(s)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Audit Log Feed */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <Activity size={18} /> System Audit Trail Stream
          </h3>
          <Link to="/super-admin/audit-logs" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)' }}>
            View Full Audit Logs →
          </Link>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Target ID</th>
                <th>Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentAuditLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-slate-500)' }}>No audit logs yet.</td></tr>
              ) : recentAuditLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontSize: '0.8125rem' }}>{log.action}</td>
                  <td>{log.actorName}</td>
                  <td><span className="role-badge" style={{ fontSize: '0.7rem' }}>{log.actorRole}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{log.targetId}</td>
                  <td style={{ fontSize: '0.8125rem' }}>{log.details}</td>
                  <td style={{ fontSize: '0.8125rem' }}>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
