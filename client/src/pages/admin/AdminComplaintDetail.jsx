import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import PdfDownloadButton from '../../components/PdfDownloadButton';
import StatutoryTracker from '../../components/StatutoryTracker';
import Timeline from '../../components/Timeline';
import AttachmentList from '../../components/AttachmentList';
import { ShieldCheck, FileText, MessageSquare, CheckCircle2, ArrowLeft, Send } from 'lucide-react';

export default function AdminComplaintDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminsList, setAdminsList] = useState([]);

  // Form states for status update and notes
  const [statusForm, setStatusForm] = useState({
    status: '',
    priority: '',
    assignedAdminId: '',
    comment: ''
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Form state for official update / internal note
  const [updateText, setUpdateText] = useState('');
  const [isPublic, setIsPublic] = useState(true); // true = Official Public Update, false = Internal Note
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  useEffect(() => {
    fetchDetail();
    fetchAdmins();
  }, [id]);

  const fetchDetail = async () => {
    try {
      const res = await apiFetch(`/admin/complaints/${id}`);
      if (res.success) {
        setData(res);
        setStatusForm({
          status: res.complaint.status,
          priority: res.complaint.priority,
          assignedAdminId: res.complaint.assignedAdminId || '',
          comment: ''
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load complaint details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await apiFetch('/super-admin/admins');
      if (res.success && res.admins) {
        setAdminsList(res.admins);
      }
    } catch (e) {
      // Non-critical if non-superadmin
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('');
    setUpdatingStatus(true);

    try {
      const res = await apiFetch(`/admin/complaints/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify(statusForm)
      });
      if (res.success) {
        setStatusMsg('Status & Case assignment updated successfully.');
        fetchDetail();
      }
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!updateText.trim()) return;

    setUpdateMsg('');
    setAddingUpdate(true);

    try {
      const res = await apiFetch(`/admin/complaints/${id}/updates`, {
        method: 'POST',
        body: JSON.stringify({
          updateText,
          isPublic
        })
      });
      if (res.success) {
        setUpdateMsg(isPublic ? 'Official public update published to student.' : 'Internal confidential note recorded.');
        setUpdateText('');
        fetchDetail();
      }
    } catch (err) {
      setUpdateMsg(`Error: ${err.message}`);
    } finally {
      setAddingUpdate(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Opening case file workspace...</div>;
  }

  if (error || !data) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem' }}>
        <div className="alert alert-danger"><span>{error || 'Case record not found.'}</span></div>
        <Link to="/admin/complaints" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> Back to Complaints Repository</Link>
      </div>
    );
  }

  const { complaint, history = [], updates = [], attachments = [], statutory } = data;
  const publicUpdates = updates.filter(u => u.isPublic);
  const internalNotes = updates.filter(u => !u.isPublic);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/admin/complaints" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <ArrowLeft size={14} /> Back to Complaints Repository
        </Link>
      </div>

      {/* Header Workspace Title Card */}
      <div className="panel" style={{ borderTop: '4px solid var(--color-emerald-700)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)', fontFamily: 'monospace' }}>
                {complaint.referenceId}
              </h1>
              <StatusBadge status={complaint.status} />
              <span className="badge badge-submitted" style={{ textTransform: 'none' }}>
                Priority: {complaint.priority}
              </span>
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-slate-800)' }}>
              {complaint.title}
            </h2>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
            <div>Complainant: <strong>{complaint.studentName} ({complaint.studentRollNo})</strong></div>
            <div>Dept: <strong>{complaint.studentDept}</strong></div>
            <div>Registered On: <strong>{formatDate(complaint.createdAt)}</strong></div>
            <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <PdfDownloadButton
                url={`/api/pdf/admin/complaints/${complaint.id}/acknowledgement`}
                fallbackName={`VPOSH_${complaint.referenceId}_Complaint_Acknowledgement.pdf`}
                label="Acknowledgement PDF"
                iconSize={12}
              />
              <PdfDownloadButton
                url={`/api/pdf/admin/complaints/${complaint.id}/status-report`}
                fallbackName={`VPOSH_${complaint.referenceId}_Case_Status_Report.pdf`}
                label="Status Report PDF"
                iconSize={12}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Statutory clock — the ICC's compliance view of this case */}
      <StatutoryTracker statutory={statutory} />

      <div className="split-sidebar">
        {/* Left Column: Complaint Data & Communications */}
        <div>
          {/* SECTION 1: COMPLAINT OVERVIEW */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <FileText size={18} /> Complainant Statement & Incident Facts
              </h3>
            </div>

            <div className="grid-2" style={{ gap: '1rem', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Incident Date</strong>
                <span>{complaint.incidentDate}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Location</strong>
                <span>{complaint.incidentLocation}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Respondent Name</strong>
                <span>{complaint.respondentName}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Respondent Department</strong>
                <span>{complaint.respondentDept}</span>
              </div>
            </div>

            <div>
              <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Full Description Statement</strong>
              <div style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'var(--color-slate-900)' }}>
                {complaint.description}
              </div>
            </div>

            {attachments.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Attached Evidence Files ({attachments.length})</strong>
                <AttachmentList attachments={attachments} />
              </div>
            )}
          </div>

          {/* SECTION: COMMUNICATIONS WORKSPACE (PUBLIC UPDATES vs CONFIDENTIAL NOTES) */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <MessageSquare size={18} /> Official Updates & Confidential Notes
              </h3>
            </div>

            {updateMsg && (
              <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
                <CheckCircle2 size={16} /> <span>{updateMsg}</span>
              </div>
            )}

            {/* Add New Communication Box */}
            <form onSubmit={handleUpdateSubmit} style={{ marginBottom: '2rem', backgroundColor: 'var(--color-slate-50)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-slate-200)' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
                  Add Entry to Case Record
                </label>
                <div style={{ display: 'flex', gap: '1.5rem', margin: '0.5rem 0 0.85rem 0', fontSize: '0.8125rem' }}>
                  <label style={{ fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-blue-strong)' }}>
                    <input
                      type="radio"
                      name="updateType"
                      checked={isPublic === true}
                      onChange={() => setIsPublic(true)}
                    />
                    📢 Official Public Update (Visible to Student)
                  </label>

                  <label style={{ fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-crimson-strong)' }}>
                    <input
                      type="radio"
                      name="updateType"
                      checked={isPublic === false}
                      onChange={() => setIsPublic(false)}
                    />
                    🔒 Internal Confidential Note (Admin / ICC Only)
                  </label>
                </div>

                <textarea
                  rows={3}
                  className="form-control"
                  placeholder={isPublic ? "Write official update to inform student on status or inquiry progress..." : "Write confidential internal investigation notes, witness testimony summaries, or legal committee observations..."}
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className={`btn ${isPublic ? 'btn-primary' : 'btn-danger'} btn-sm`} disabled={addingUpdate}>
                  <Send size={14} /> {addingUpdate ? 'Saving...' : (isPublic ? 'Post Official Update' : 'Save Internal Note')}
                </button>
              </div>
            </form>

            {/* Render Public Updates */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-navy-900)', borderBottom: '1px solid var(--color-slate-200)', paddingBottom: '0.35rem', marginBottom: '0.75rem' }}>
                📢 Student-Facing Official Updates ({publicUpdates.length})
              </h4>
              {publicUpdates.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>No official updates published to student yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {publicUpdates.map(u => (
                    <div key={u.id} className="official-update-bubble" style={{ background: 'var(--color-blue-50)', border: '1px solid var(--border-blue)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                      <div className="official-update-meta" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-blue-strong)', display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span>{u.authorName} ({u.authorRole})</span>
                        <span>{formatDate(u.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-blue-strong)' }}>{u.updateText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Render Internal Confidential Notes */}
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-crimson-strong)', borderBottom: '1px solid var(--color-slate-200)', paddingBottom: '0.35rem', marginBottom: '0.75rem' }}>
                🔒 Internal Confidential ICC Notes ({internalNotes.length}) — Strictly Excluded from Student View
              </h4>
              {internalNotes.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>No internal notes recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {internalNotes.map(u => (
                    <div key={u.id} style={{ background: 'var(--color-crimson-50)', border: '1px solid var(--border-crimson)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-crimson-strong)', display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span>CONFIDENTIAL • {u.authorName} ({u.authorRole})</span>
                        <span>{formatDate(u.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-crimson-body)' }}>{u.updateText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Case Control Panel & Timeline */}
        <div>
          {/* STATUS MANAGEMENT FORM */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '1rem' }}>
                Case Management Controls
              </h3>
            </div>

            {statusMsg && (
              <div className="alert alert-success" style={{ fontSize: '0.8125rem' }}>
                <CheckCircle2 size={16} /> <span>{statusMsg}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit}>
              <div className="form-group">
                <label htmlFor="status" style={{ fontSize: '0.8125rem' }}>Update Complaint Status</label>
                <select
                  id="status"
                  className="form-control"
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  required
                >
                  <option value="Submitted">Submitted</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Action Taken">Action Taken</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="priority" style={{ fontSize: '0.8125rem' }}>Assign Priority Level</label>
                <select
                  id="priority"
                  className="form-control"
                  value={statusForm.priority}
                  onChange={(e) => setStatusForm({ ...statusForm, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {adminsList.length > 0 && (
                <div className="form-group">
                  <label htmlFor="assignedAdminId" style={{ fontSize: '0.8125rem' }}>Assigned Presiding Member</label>
                  <select
                    id="assignedAdminId"
                    className="form-control"
                    value={statusForm.assignedAdminId}
                    onChange={(e) => setStatusForm({ ...statusForm, assignedAdminId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {adminsList.map(adm => (
                      <option key={adm.id} value={adm.id}>{adm.name} ({adm.department || 'ICC'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="comment" style={{ fontSize: '0.8125rem' }}>Status Change Log Reason</label>
                <input
                  id="comment"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Formal acknowledgment notice sent to student"
                  value={statusForm.comment}
                  onChange={(e) => setStatusForm({ ...statusForm, comment: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-emerald btn-sm" style={{ width: '100%' }} disabled={updatingStatus}>
                {updatingStatus ? 'Updating...' : 'Save Case Status & Assignment'}
              </button>
            </form>
          </div>

          {/* TIMELINE PROGRESS */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '1rem' }}>
                Case Audit History
              </h3>
            </div>
            <Timeline history={history} currentStatus={complaint.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
