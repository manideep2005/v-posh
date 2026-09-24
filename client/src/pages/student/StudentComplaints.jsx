import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import ConfirmActionModal from '../../components/ConfirmActionModal';
import { FileText, Plus, FileSearch, Pause, Play, Trash2, AlertCircle, ArrowRight, Info } from 'lucide-react';

export default function StudentComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, action: null, complaintId: null, complaintRef: null });

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = async () => {
    setError('');
    try {
      const res = await apiFetch('/student/complaints');
      if (res.success) setComplaints(res.complaints);
    } catch (err) {
      setError(err.message || 'Unable to load your complaints.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalConfirm = async ({ reason, email }) => {
    const { action, complaintId } = modal;
    // Use POST for both pause and delete — Vercel edge may strip DELETE/PUT bodies
    const url = action === 'delete'
      ? `/student/complaints/${complaintId}/delete`
      : `/student/complaints/${complaintId}/pause`;
    const res = await apiFetch(url, { method: 'POST', body: JSON.stringify({ reason, email }) });
    if (res.success) {
      setMsg(res.message);
      setModal({ open: false, action: null, complaintId: null, complaintRef: null });
      fetchComplaints();
    } else {
      throw new Error(res.message || 'Action failed.');
    }
  };

  if (loading) {
    return <div className="container page"><div className="loading-state">Loading your complaints…</div></div>;
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><FileText size={22} /> My Complaints</h1>
          <p className="page-sub">
            Track the statutory stage of every grievance, pause a case, or withdraw one you filed
            by mistake.
          </p>
        </div>
        <div className="page-actions">
          <span className="toolbar-meta">{complaints.length} case{complaints.length === 1 ? '' : 's'}</span>
          <Link to="/student/complaints/new" className="btn btn-emerald btn-sm"><Plus size={15} /> Raise Complaint</Link>
        </div>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><Info size={16} /> <span>{msg}</span></div>}
      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> <span>{error}</span></div>}

      <div className="panel" style={{ padding: complaints.length ? 0 : undefined }}>
        {complaints.length === 0 ? (
          <div className="empty-state">
            <FileSearch size={32} />
            <strong>No complaints filed yet</strong>
            <p>If you experience or witness harassment, you can file a complaint here — it takes a few minutes and stays confidential.</p>
            <Link to="/student/complaints/new" className="btn btn-emerald btn-sm" style={{ marginTop: '0.75rem' }}>
              <Plus size={15} /> Raise your first complaint
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Complaint</th>
                  <th className="hide-md">Category</th>
                  <th className="hide-sm">Filed on</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id} style={{ opacity: c.paused ? 0.6 : 1 }}>
                    <td className="nowrap">
                      <Link to={`/student/complaints/${c.id}`} style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-navy-900)', fontSize: '0.8125rem' }}>
                        {c.referenceId}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/student/complaints/${c.id}`} className="truncate" style={{ display: 'inline-block', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                        {c.title}
                      </Link>
                      {c.paused && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-amber-700)', fontWeight: 600, marginTop: '0.15rem' }}>
                          Paused — the statutory clock is on hold
                        </div>
                      )}
                    </td>
                    <td className="hide-md" style={{ fontSize: '0.8125rem' }}>{c.category}</td>
                    <td className="hide-sm nowrap" style={{ fontSize: '0.8125rem' }}>{formatDate(c.createdAt)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link to={`/student/complaints/${c.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                          Track <ArrowRight size={12} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setModal({ open: true, action: 'pause', complaintId: c.id, complaintRef: c.referenceId })}
                          className="btn btn-sm"
                          title={c.paused ? 'Resume this case' : 'Pause this case'}
                          style={{ padding: '0.3rem 0.5rem', background: c.paused ? 'var(--tint-amber)' : 'var(--color-slate-100)', border: '1px solid var(--color-slate-300)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          {c.paused ? <><Play size={11} style={{ color: '#D97706' }} /> Resume</> : <><Pause size={11} style={{ color: 'var(--color-slate-500)' }} /> Pause</>}
                        </button>
                        {['Submitted', 'Acknowledged'].includes(c.status) && (
                          <button
                            type="button"
                            onClick={() => setModal({ open: true, action: 'delete', complaintId: c.id, complaintRef: c.referenceId })}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmActionModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, action: null, complaintId: null, complaintRef: null })}
        onConfirm={handleModalConfirm}
        action={modal.action}
        complaintRef={modal.complaintRef}
      />
    </div>
  );
}
