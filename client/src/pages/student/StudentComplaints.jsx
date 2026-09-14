import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import ConfirmActionModal from '../../components/ConfirmActionModal';
import { FileText, Plus, FileSearch, Pause, Play, Trash2, AlertCircle } from 'lucide-react';

export default function StudentComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [modal, setModal] = useState({ open: false, action: null, complaintId: null, complaintRef: null });

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = async () => {
    try {
      const res = await apiFetch('/student/complaints');
      if (res.success) setComplaints(res.complaints);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleModalConfirm = async ({ reason, email }) => {
    const { action, complaintId } = modal;
    const method = action === 'delete' ? 'DELETE' : 'PUT';
    const url = action === 'delete'
      ? `/student/complaints/${complaintId}`
      : `/student/complaints/${complaintId}/pause`;
    const res = await apiFetch(url, { method, body: { reason, email } });
    if (res.success) {
      setMsg(res.message);
      setModal({ open: false, action: null, complaintId: null, complaintRef: null });
      fetchComplaints();
    } else {
      throw new Error(res.message || 'Action failed.');
    }
  };

  if (loading) return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading...</div>;

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>My Complaints</h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Track, pause, or manage your registered grievances
          </p>
        </div>
        <Link to="/student/complaints/new" className="btn btn-emerald"><Plus size={16} /> Raise New Complaint</Link>
      </div>

      {msg && <div style={{ padding: '0.65rem 1rem', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-sm)', color: '#065F46', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>{msg}</div>}

      <div className="panel">
        {complaints.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <FileSearch size={40} color="var(--color-slate-400)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-navy-900)', marginBottom: '0.5rem' }}>No Complaints</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>You haven't submitted any complaints yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id} style={{ opacity: c.paused ? 0.55 : 1 }}>
                    <td style={{ fontWeight: '700', fontFamily: 'monospace', color: 'var(--color-navy-900)' }}>{c.referenceId}</td>
                    <td style={{ fontWeight: '600' }}>{c.title}{c.paused && <span style={{ fontSize: '0.7rem', color: 'var(--color-amber-700)', marginLeft: '0.35rem' }}>(Paused)</span>}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{c.category}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{formatDate(c.createdAt)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link to={`/student/complaints/${c.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>Track</Link>
                        <button onClick={() => setModal({ open: true, action: 'pause', complaintId: c.id, complaintRef: c.referenceId })} className="btn btn-sm" title={c.paused ? 'Resume' : 'Pause'} style={{ padding: '0.3rem 0.5rem', background: c.paused ? '#FEF3C7' : 'var(--color-slate-100)', border: '1px solid var(--color-slate-300)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {c.paused ? <><Play size={11} style={{ color: '#D97706' }} /> Resume</> : <><Pause size={11} style={{ color: 'var(--color-slate-500)' }} /> Pause</>}
                        </button>
                        {['Submitted', 'Acknowledged'].includes(c.status) && (
                          <button onClick={() => setModal({ open: true, action: 'delete', complaintId: c.id, complaintRef: c.referenceId })} className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
