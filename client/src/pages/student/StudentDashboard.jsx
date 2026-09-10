import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { FilePlus, FileText, Clock, CheckCircle2, Shield, AlertCircle, ArrowRight } from 'lucide-react';

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/student/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading your dashboard...</div>;
  }

  const { stats, recentComplaints = [], recentUpdates = [] } = data || {};

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            Student Grievance Dashboard
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Real-time status overview of your submitted confidential complaints
          </p>
        </div>
        <Link to="/student/complaints/new" className="btn btn-emerald">
          <FilePlus size={16} /> Raise New Complaint
        </Link>
      </div>

      {/* Overview Metric Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Submitted</div>
          <div className="stat-value">{stats?.total || 0}</div>
          <div className="stat-sub">Lifetime registered</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-amber-700)' }}>
          <div className="stat-label">Active / In-Progress</div>
          <div className="stat-value">{stats?.active || 0}</div>
          <div className="stat-sub">Currently undergoing inquiry</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-blue-700)' }}>
          <div className="stat-label">Under ICC Review</div>
          <div className="stat-value">{stats?.underReview || 0}</div>
          <div className="stat-sub">Preliminary scrutiny</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-emerald-700)' }}>
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{stats?.resolved || 0}</div>
          <div className="stat-sub">Final action executed</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* Recent Complaints List */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <FileText size={18} /> My Complaints
            </h2>
            <Link to="/student/complaints" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)' }}>
              View All →
            </Link>
          </div>

          {recentComplaints.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-slate-600)' }}>
              <p>You have not submitted any complaints yet.</p>
              <Link to="/student/complaints/new" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                Submit Your First Complaint
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference ID</th>
                    <th>Category</th>
                    <th>Submitted Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentComplaints.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: '700', color: 'var(--color-navy-900)' }}>
                        {c.referenceId}
                      </td>
                      <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.category}
                      </td>
                      <td>{formatDate(c.createdAt)}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <Link to={`/student/complaints/${c.id}`} className="btn btn-secondary btn-sm">
                          Track Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar: Latest Official Updates */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              <Shield size={16} /> Official Committee Updates
            </h3>
          </div>
          {recentUpdates.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>No official updates posted yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentUpdates.map(u => (
                <div key={u.id} style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-navy-900)', marginBottom: '0.2rem' }}>
                    {u.authorName} ({u.authorRole})
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', lineHeight: '1.4' }}>
                    "{u.updateText}"
                  </p>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-slate-600)', marginTop: '0.4rem' }}>
                    {formatDate(u.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
