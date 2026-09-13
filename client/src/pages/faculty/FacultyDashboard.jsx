import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { BookOpen, Users, FileText, AlertTriangle, Clock, ArrowRight } from 'lucide-react';

export default function FacultyDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/faculty/dashboard');
      if (res.success) setData(res);
    } catch (err) {
      console.error('Faculty dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading faculty dashboard...</div>;

  const { stats = {}, recentComplaints = [], notifications = [] } = data || {};

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={28} /> Faculty Dashboard
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Department oversight, student complaints, and case tracking
          </p>
        </div>
        <Link to="/faculty/complaints/new" className="btn btn-emerald">
          <FileText size={16} /> File Complaint for Student
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div className="stat-label">Department Complaints</div>
          <div className="stat-value">{stats.deptTotal || 0}</div>
          <div className="stat-sub">{stats.deptActive || 0} active</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="stat-label">Resolved in Dept</div>
          <div className="stat-value">{stats.deptResolved || 0}</div>
          <div className="stat-sub">Cases closed</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div className="stat-label">Assigned to Me</div>
          <div className="stat-value">{stats.assignedTotal || 0}</div>
          <div className="stat-sub">{stats.assignedActive || 0} active</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="stat-label">Students in Dept</div>
          <div className="stat-value">{stats.deptStudents || 0}</div>
          <div className="stat-sub">Under your department</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/faculty/complaints" className="panel" style={{ textDecoration: 'none', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #3B82F6', transition: 'transform 0.15s' }}>
          <FileText size={22} style={{ color: '#3B82F6' }} />
          <div>
            <div style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontSize: '0.9375rem' }}>View Complaints</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Browse department cases</div>
          </div>
        </Link>
        <Link to="/faculty/complaints/new" className="panel" style={{ textDecoration: 'none', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #10B981', transition: 'transform 0.15s' }}>
          <AlertTriangle size={22} style={{ color: '#10B981' }} />
          <div>
            <div style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontSize: '0.9375rem' }}>File Complaint</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Report on behalf of student</div>
          </div>
        </Link>
        <Link to="/faculty/students" className="panel" style={{ textDecoration: 'none', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #8B5CF6', transition: 'transform 0.15s' }}>
          <Users size={22} style={{ color: '#8B5CF6' }} />
          <div>
            <div style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontSize: '0.9375rem' }}>Student Directory</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>View students in your dept</div>
          </div>
        </Link>
      </div>

      {/* Recent Complaints & Notifications */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title"><Clock size={18} /> Recent Department Complaints</h3>
            <Link to="/faculty/complaints" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)' }}>View All →</Link>
          </div>
          {recentComplaints.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.875rem' }}>No complaints in your department yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentComplaints.map(c => (
                <Link key={c.id} to={`/faculty/complaints/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>{c.referenceId}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)' }}>{c.studentName} • {formatDate(c.createdAt)}</span>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--color-slate-400)' }} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Recent Notifications</h3>
          </div>
          {notifications.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.875rem' }}>No notifications.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {notifications.map(n => (
                <div key={n.id} style={{ padding: '0.75rem', background: n.isRead ? '#fff' : '#F0FDF4', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>{n.title}</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)', margin: '0.2rem 0 0' }}>{n.message}</p>
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
