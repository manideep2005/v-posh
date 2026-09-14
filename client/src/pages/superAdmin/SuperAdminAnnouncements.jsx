import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate } from '../../utils/api';
import { Megaphone, Plus, Trash2, AlertTriangle, Info, Star, CheckCircle2, AlertCircle } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', icon: AlertTriangle, color: '#DC2626' },
  { value: 'high', label: 'High', icon: AlertTriangle, color: '#EA580C' },
  { value: 'normal', label: 'Normal', icon: Info, color: '#2563EB' },
  { value: 'low', label: 'Low', icon: Star, color: '#6B7280' },
];

export default function SuperAdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ title: '', message: '', priority: 'normal', targetRoles: ['student', 'faculty', 'admin', 'super_admin'] });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await apiFetch('/super-admin/announcements');
      if (res.success) setAnnouncements(res.announcements);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      const res = await apiFetch('/super-admin/announcements', { method: 'POST', body: JSON.stringify(form) });
      if (res.success) {
        setMsg('Announcement published successfully.');
        setShowModal(false);
        setForm({ title: '', message: '', priority: 'normal', targetRoles: ['student', 'faculty', 'admin', 'super_admin'] });
        fetchAnnouncements();
      }
    } catch (e) { alert(e.message || 'Failed.'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this announcement?')) return;
    try {
      await apiFetch(`/super-admin/announcements/${id}`, { method: 'DELETE' });
      fetchAnnouncements();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            <Megaphone size={24} style={{ display: 'inline', verticalAlign: '-4px', marginRight: '0.5rem' }} />
            System Announcements
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Post system-wide announcements visible to all users
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-emerald"><Plus size={16} /> New Announcement</button>
      </div>

      {msg && <div className="alert alert-success"><CheckCircle2 size={16} /> <span>{msg}</span></div>}

      {loading ? <p>Loading...</p> : announcements.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Megaphone size={40} style={{ color: 'var(--color-slate-300)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--color-slate-500)' }}>No announcements yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {announcements.map(a => {
            const priority = PRIORITY_OPTIONS.find(p => p.value === a.priority) || PRIORITY_OPTIONS[2];
            const Icon = priority.icon;
            return (
              <div key={a.id} className="panel" style={{ padding: '1.25rem', borderLeft: `4px solid ${priority.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <Icon size={16} style={{ color: priority.color }} />
                      <strong style={{ color: 'var(--color-navy-900)', fontSize: '1rem' }}>{a.title}</strong>
                      <span style={{ fontSize: '0.6875rem', padding: '1px 8px', borderRadius: '99px', background: `${priority.color}15`, color: priority.color, fontWeight: '600' }}>{a.priority}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-700)', margin: '0 0 0.5rem', lineHeight: '1.5' }}>{a.message}</p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>
                      By {a.authorName} • {formatDate(a.createdAt)} • Target: {a.targetRoles?.join(', ')}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="btn btn-danger btn-sm" title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>New Announcement</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title <span className="required">*</span></label>
                  <input type="text" className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="e.g. Holiday Notice" />
                </div>
                <div className="form-group">
                  <label>Message <span className="required">*</span></label>
                  <textarea rows={4} className="form-control" value={form.message} onChange={e => setForm({...form, message: e.target.value})} required placeholder="Write your announcement..." />
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {PRIORITY_OPTIONS.map(p => (
                      <button key={p.value} type="button" onClick={() => setForm({...form, priority: p.value})} style={{
                        padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: `2px solid ${form.priority === p.value ? p.color : 'var(--color-slate-200)'}`,
                        background: form.priority === p.value ? `${p.color}10` : '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '600',
                        color: form.priority === p.value ? p.color : 'var(--color-slate-600)', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}>{p.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-emerald" disabled={submitting}>{submitting ? 'Publishing...' : 'Publish Announcement'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
