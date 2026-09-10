import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import { ShieldCheck, Users, FileText, Activity, AlertTriangle, ArrowRight, Settings } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/super-admin/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load super admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading system metrics...</div>;
  }

  const { stats, categoryStats = [], departmentStats = [], recentAuditLogs = [] } = data || {};

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            Super Admin Operational Oversight
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            System-wide compliance monitoring, admin staff provisioning, and statutory audit control
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/super-admin/admins" className="btn btn-emerald">
            <Users size={16} /> Manage Admin Staff
          </Link>
          <Link to="/super-admin/settings" className="btn btn-secondary">
            <Settings size={16} /> Settings
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="stats-grid">
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

      {/* Category Breakdown & Audit Stream */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Category breakdown */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              Complaints Distribution by Category
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {categoryStats.map((c, i) => (
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
            {departmentStats.map((d, i) => (
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
              {recentAuditLogs.map(log => (
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
