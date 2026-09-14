import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { AlertCircle, Clock, CheckCircle2, FileSearch, ShieldAlert, Users, ArrowRight } from 'lucide-react';
import Announcements from '../../components/Announcements';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/admin/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading ICC operational metrics...</div>;
  }

  const { stats, recentComplaints = [], recentLogs = [] } = data || {};

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            ICC Grievance Management Workspace
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Statutory complaint processing dashboard and case load administration
          </p>
        </div>
        <Link to="/admin/complaints" className="btn btn-primary">
          Open Case Repository <ArrowRight size={16} />
        </Link>
      </div>

      {/* Announcements */}
      <Announcements />

      {/* Operational Metric Grid */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-crimson-700)' }}>
          <div className="stat-label">New Registered</div>
          <div className="stat-value">{stats?.newComplaints || 0}</div>
          <div className="stat-sub">Requires initial scrutiny</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-amber-700)' }}>
          <div className="stat-label">Approaching SLA Deadline</div>
          <div className="stat-value">{stats?.approachingSLA || 0}</div>
          <div className="stat-sub">&lt; 48 hours remaining</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-blue-700)' }}>
          <div className="stat-label">Under Active Review</div>
          <div className="stat-value">{stats?.underReview || 0}</div>
          <div className="stat-sub">Inquiry proceedings active</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-emerald-700)' }}>
          <div className="stat-label">Total Resolved</div>
          <div className="stat-value">{stats?.resolved || 0}</div>
          <div className="stat-sub">Finalized cases</div>
        </div>
      </div>

      {/* Recent Action Table & Audit Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* Urgent & Recent Complaints List */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <FileSearch size={18} /> Active Complaints Requiring Attention
            </h2>
            <Link to="/admin/complaints" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)' }}>
              View All Cases ({stats?.total || 0}) →
            </Link>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Student & Dept</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentComplaints.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontFamily: 'monospace' }}>
                      {c.referenceId}
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--color-slate-900)' }}>{c.studentName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{c.studentDept}</div>
                    </td>
                    <td style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.category}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: c.priority === 'Urgent' || c.priority === 'High' ? 'var(--color-crimson-700)' : 'var(--color-slate-700)' }}>
                        {c.priority}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <Link to={`/admin/complaints/${c.id}`} className="btn btn-secondary btn-sm">
                        Manage Case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Activity Stream */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              Recent Audit Log Activity
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {recentLogs.map(log => (
              <div key={log.id} style={{ borderBottom: '1px solid var(--color-slate-100)', paddingBottom: '0.65rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
                  {log.action}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', marginTop: '0.1rem' }}>
                  {log.details}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', marginTop: '0.2rem' }}>
                  By {log.actorName} ({log.actorRole}) • {formatDate(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
