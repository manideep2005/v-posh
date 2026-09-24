import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { FilePlus, FileText, Clock, CheckCircle2, Shield, AlertTriangle, ArrowRight, Bell, TrendingUp, Settings } from 'lucide-react';
import Announcements from '../../components/Announcements';
import { useAuth } from '../../context/AuthContext';

// ─── Greeting helper ────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good Afternoon', emoji: '🌤️' };
  return { text: 'Good Evening', emoji: '🌙' };
}

// ─── Animated progress ring ─────────────────────────────────────────────────
function ProgressRing({ value, total, size = 80, strokeWidth = 6 }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--color-slate-200)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--color-navy-700)" strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size > 60 ? '1.25rem' : '0.875rem', fontWeight: '800', color: 'var(--color-navy-900)' }}>{pct}%</span>
        <span style={{ fontSize: '0.5rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>resolved</span>
      </div>
    </div>
  );
}

// ─── Status step indicator ──────────────────────────────────────────────────
function StatusTimeline({ status }) {
  const steps = ['Submitted', 'Acknowledged', 'Under Review', 'Investigation', 'Action Taken', 'Resolved'];
  const currentIdx = steps.indexOf(status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', margin: '0.5rem 0' }}>
      {steps.map((step, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={step}>
            <div title={step} style={{
              width: isCurrent ? '10px' : '6px', height: isCurrent ? '10px' : '6px', borderRadius: '50%',
              background: isActive ? 'var(--color-navy-700)' : 'var(--color-slate-300)',
              transition: 'all 0.3s', flexShrink: 0,
              boxShadow: isCurrent ? '0 0 0 3px rgba(15, 23, 42, 0.15)' : 'none',
            }} />
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: i < currentIdx ? 'var(--color-navy-700)' : 'var(--color-slate-200)', transition: 'background 0.3s', minWidth: 8 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch('/student/dashboard');
      if (res.success) setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container page"><div className="loading-state">Loading your dashboard…</div></div>;
  }

  const { stats, recentComplaints = [], recentUpdates = [] } = data || {};
  const greeting = getGreeting();

  return (
    <div className="container page">
      {/* ─── Greeting ─── */}
      <div className="page-head" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            {greeting.emoji} {greeting.text}, {user?.name || 'Student'}!
          </h1>
          <p style={{ color: 'var(--color-slate-500)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Here's what's happening with your complaints today
          </p>
        </div>
        <Link to="/student/complaints/new" className="btn btn-primary">
          <FilePlus size={16} /> Raise Complaint
        </Link>
      </div>

      {/* ─── Announcements ─── */}
      <Announcements />

      {/* ─── Stats Grid ─── */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label">Total Submitted</div>
              <div className="stat-value">{stats?.total || 0}</div>
              <div className="stat-sub">Lifetime registered</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'var(--color-slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={20} style={{ color: 'var(--color-navy-700)' }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label">Active Cases</div>
              <div className="stat-value">{stats?.active || 0}</div>
              <div className="stat-sub">Currently in progress</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'var(--color-slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} style={{ color: 'var(--color-navy-700)' }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label">Under Review</div>
              <div className="stat-value">{stats?.underReview || 0}</div>
              <div className="stat-sub">ICC reviewing</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'var(--color-slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} style={{ color: 'var(--color-navy-700)' }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label">Resolved</div>
              <div className="stat-value">{stats?.resolved || 0}</div>
              <div className="stat-sub">Cases closed</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'var(--color-slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--color-navy-700)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="card-grid" style={{ marginBottom: '2rem' }}>
        {[
          { to: '/student/complaints/new', icon: FilePlus, label: 'Raise Complaint', sub: 'File a new case' },
          { to: '/student/complaints', icon: FileText, label: 'Track Cases', sub: 'View all complaints' },
          { to: '/student/profile', icon: TrendingUp, label: 'My Profile', sub: 'Update details' },
          { to: '/student/settings', icon: Settings, label: 'Settings', sub: 'Preferences' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <Link key={i} to={item.to} style={{
              textDecoration: 'none', padding: '1.25rem', border: '1px solid var(--color-slate-200)',
              borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem',
              transition: 'all 0.2s', background: 'var(--color-slate-50)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-slate-400)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-slate-200)'; }}
            >
              <div style={{ width: 42, height: 42, borderRadius: '10px', background: 'var(--color-slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} style={{ color: 'var(--color-navy-700)' }} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--color-navy-900)' }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{item.sub}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ─── Main Content Grid ─── */}
      <div className="split-sidebar">
        {/* Recent Complaints */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><FileText size={18} /> My Recent Complaints</h2>
            <Link to="/student/complaints" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)' }}>View All →</Link>
          </div>

          {recentComplaints.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <FileText size={28} style={{ color: 'var(--color-slate-300)' }} />
              </div>
              <p style={{ color: 'var(--color-slate-600)', fontWeight: '600', fontSize: '0.9375rem' }}>No complaints yet</p>
              <p style={{ color: 'var(--color-slate-500)', fontSize: '0.8125rem', marginBottom: '1rem' }}>Your submitted complaints will appear here</p>
              <Link to="/student/complaints/new" className="btn btn-primary btn-sm">
                <FilePlus size={14} /> Submit Your First Complaint
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentComplaints.map(c => (
                <Link key={c.id} to={`/student/complaints/${c.id}`} style={{
                  display: 'block', padding: '1rem 1.25rem', border: '1px solid var(--color-slate-200)',
                  borderRadius: 'var(--radius-sm)', textDecoration: 'none', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-slate-400)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-slate-200)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.875rem', color: 'var(--color-navy-900)' }}>{c.referenceId}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--color-slate-400)', marginTop: '2px' }} />
                  </div>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-slate-800)', margin: '0 0 0.25rem' }}>{c.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                    <span>{c.category}</span>
                    <span>•</span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                  <StatusTimeline status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Resolution Progress */}
          {stats?.total > 0 && (
            <div className="panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '1rem' }}>
                <TrendingUp size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> Resolution Progress
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <ProgressRing value={stats.resolved || 0} total={stats.total} size={100} strokeWidth={7} />
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
                {stats.resolved || 0} of {stats.total} complaints resolved
              </p>
            </div>
          )}

          {/* Official Updates */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
                <Bell size={16} /> Committee Updates
              </h3>
            </div>
            {recentUpdates.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>No updates yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentUpdates.map(u => (
                  <div key={u.id} style={{
                    padding: '0.85rem', background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{u.authorName}</span>
                      <span style={{ fontWeight: '400', color: 'var(--color-slate-400)' }}>{formatDate(u.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', lineHeight: '1.45', margin: 0 }}>
                      {u.updateText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div style={{
            padding: '1rem 1.25rem', background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: 'var(--color-navy-700)', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--color-navy-900)', margin: 0 }}>Your Privacy is Protected</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)', margin: '0.3rem 0 0', lineHeight: '1.4' }}>
                  All complaint details are strictly confidential and visible only to ICC members. Your identity is protected under POSH Act.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
