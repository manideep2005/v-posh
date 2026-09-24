import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate } from '../../utils/api';
import {
  Megaphone, Plus, Trash2, AlertTriangle, Info, Star, CheckCircle2, AlertCircle, X, Users,
} from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', icon: AlertTriangle, color: '#DC2626', chip: 'chip-crimson' },
  { value: 'high', label: 'High', icon: AlertTriangle, color: '#EA580C', chip: 'chip-amber' },
  { value: 'normal', label: 'Normal', icon: Info, color: '#2563EB', chip: 'chip-blue' },
  { value: 'low', label: 'Low', icon: Star, color: '#6B7280', chip: 'chip-slate' },
];

const TARGET_ROLES = [
  { value: 'student', label: 'Students' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'admin', label: 'ICC Admins' },
  { value: 'super_admin', label: 'Super Admins' },
];

const EMPTY_FORM = {
  title: '',
  message: '',
  priority: 'normal',
  targetRoles: TARGET_ROLES.map(r => r.value),
};

export default function SuperAdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await apiFetch('/super-admin/announcements');
      if (res.success) setAnnouncements(res.announcements || []);
      else setErr(res.message || 'Failed to load announcements.');
    } catch (e) {
      setErr(e.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    setErr('');
    try {
      const res = await apiFetch('/super-admin/announcements', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.success) {
        setMsg('Announcement published successfully.');
        setShowModal(false);
        setForm(EMPTY_FORM);
        fetchAnnouncements();
      }
    } catch (e) {
      setErr(e.message || 'Failed to publish announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this announcement?')) return;
    setMsg('');
    setErr('');
    try {
      const res = await apiFetch(`/super-admin/announcements/${id}`, { method: 'DELETE' });
      if (res && res.success === false) setErr(res.message || 'Failed to remove announcement.');
      fetchAnnouncements();
    } catch (e) {
      setErr(e.message || 'Failed to remove announcement.');
    }
  };

  const toggleRole = (role) => {
    setForm(prev => {
      const has = prev.targetRoles.includes(role);
      if (has && prev.targetRoles.length === 1) return prev; // keep at least one audience
      return {
        ...prev,
        targetRoles: has
          ? prev.targetRoles.filter(r => r !== role)
          : [...prev.targetRoles, role],
      };
    });
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><Megaphone size={22} /> System Announcements</h1>
          <p className="page-sub">
            Publish institution-wide notices — holidays, policy reminders and committee updates — to
            selected audiences.
          </p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowModal(true)} className="btn btn-emerald btn-sm">
            <Plus size={15} /> New announcement
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} /> <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="alert alert-danger">
          <AlertCircle size={16} /> <span>{err}</span>
        </div>
      )}

      {loading ? (
        <div className="panel">
          <div className="loading-block"><span className="spinner" /> Loading announcements…</div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <Megaphone size={34} />
            <strong>No announcements published</strong>
            <p>Notices you publish will appear on every user's dashboard for the selected audiences.</p>
            <button onClick={() => setShowModal(true)} className="btn btn-emerald btn-sm" style={{ marginTop: '0.5rem' }}>
              <Plus size={14} /> New announcement
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {announcements.map(a => {
            const priority = PRIORITY_OPTIONS.find(p => p.value === a.priority) || PRIORITY_OPTIONS[2];
            const Icon = priority.icon;
            return (
              <div key={a.id} className="panel" style={{ padding: '1.25rem', marginBottom: 0, borderLeft: `3px solid ${priority.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                      <Icon size={15} style={{ color: priority.color }} />
                      <strong style={{ color: 'var(--color-navy-900)', fontSize: '1rem' }}>{a.title}</strong>
                      <span className={`chip ${priority.chip}`}>{priority.label}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-700)', margin: '0 0 0.6rem', lineHeight: 1.6 }}>
                      {a.message}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                      <span>By {a.authorName}</span>
                      <span aria-hidden="true">•</span>
                      <span>{formatDate(a.createdAt)}</span>
                      {(a.targetRoles || []).length > 0 && (
                        <span className="chip chip-slate" title={(a.targetRoles || []).join(', ')}>
                          <Users size={11} /> {(a.targetRoles || []).length} audience{(a.targetRoles || []).length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="btn btn-danger btn-sm"
                    title="Delete announcement"
                    aria-label={`Delete announcement: ${a.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy-900)' }}>New announcement</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm" aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    required
                    placeholder="e.g. Holiday notice"
                  />
                </div>
                <div className="form-group">
                  <label>Message <span className="required">*</span></label>
                  <textarea
                    rows={4}
                    className="form-control"
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    required
                    placeholder="Write your announcement…"
                  />
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {PRIORITY_OPTIONS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setForm({ ...form, priority: p.value })}
                        aria-pressed={form.priority === p.value}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: `1.5px solid ${form.priority === p.value ? p.color : 'var(--color-slate-200)'}`,
                          background: form.priority === p.value ? `${p.color}12` : '#fff',
                          color: form.priority === p.value ? p.color : 'var(--color-slate-600)',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          fontFamily: 'inherit',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Visible to</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {TARGET_ROLES.map(r => {
                      const active = form.targetRoles.includes(r.value);
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => toggleRole(r.value)}
                          aria-pressed={active}
                          className={`chip ${active ? 'chip-emerald' : 'chip-slate'}`}
                          style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit', padding: '0.35rem 0.7rem' }}
                        >
                          {active ? '✓ ' : ''}{r.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="form-hint">Select the roles that should see this notice on their dashboard.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-emerald" disabled={submitting}>
                  {submitting ? 'Publishing…' : 'Publish announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
