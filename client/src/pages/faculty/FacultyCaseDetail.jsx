import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import Timeline from '../../components/Timeline';
import AttachmentList from '../../components/AttachmentList';
import StatutoryTracker from '../../components/StatutoryTracker';
import PdfDownloadButton from '../../components/PdfDownloadButton';
import {
  ArrowLeft, FileText, MessageSquare, Paperclip, ShieldAlert, Info, AlertCircle,
} from 'lucide-react';

// Student records often carry the roll number inside `studentName`
// (e.g. "HASINI PASUNOORI 23MIS7263"). Show it once, next to the name.
function useComplainantName(complaint) {
  const raw = (complaint?.studentName || '').trim();
  const roll = complaint?.studentRollNo || '';
  if (!roll) return { name: raw, roll: '' };
  return { name: raw.replace(roll, '').replace(/\s{2,}/g, ' ').trim() || raw, roll };
}

function Fact({ label, value }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <span>{value || '—'}</span>
    </div>
  );
}

export default function FacultyCaseDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/faculty/complaints/${id}`);
      if (res.success) setData(res);
    } catch (err) {
      setError(err.message || 'Unable to open this case file.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container page"><div className="loading-state">Opening case file…</div></div>;
  }

  if (error || !data?.complaint) {
    return (
      <div className="container page">
        <div className="alert alert-danger">
          <AlertCircle size={16} />
          <span>{error || 'This case is not part of your department.'}</span>
        </div>
        <Link to="/faculty/complaints" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back to Department Cases
        </Link>
      </div>
    );
  }

  const { complaint, history = [], updates = [], attachments = [], statutory } = data;
  const { name, roll } = useComplainantName(complaint);

  return (
    <div className="container page">
      <Link to="/faculty/complaints" className="crumbs">
        <ArrowLeft size={13} /> Department Cases
      </Link>

      <div className="page-head">
        <div className="page-head-main">
          <h1>
            <span style={{ fontFamily: 'monospace' }}>{complaint.referenceId}</span>
            <StatusBadge status={complaint.status} />
            <span className={`chip ${complaint.priority === 'Urgent' || complaint.priority === 'High' ? 'chip-crimson' : 'chip-slate'}`}>
              <ShieldAlert size={11} /> {complaint.priority} priority
            </span>
          </h1>
          <p className="page-sub">{complaint.title}</p>
        </div>

        <div className="page-actions">
          <PdfDownloadButton
            url={`/api/pdf/faculty/complaints/${complaint.id}/acknowledgement`}
            fallbackName={`VPOSH_${complaint.referenceId}_Acknowledgement.pdf`}
            label="Acknowledgement"
            iconSize={14}
          />
          <PdfDownloadButton
            url={`/api/pdf/faculty/complaints/${complaint.id}/status-report`}
            fallbackName={`VPOSH_${complaint.referenceId}_Status_Report.pdf`}
            label="Status Report"
            iconSize={14}
          />
        </div>
      </div>

      <StatutoryTracker
        statutory={statutory}
        title="Statutory compliance clock"
      />

      <div className="split-sidebar">
        <div>
          {/* Case file summary */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><Info size={18} /> Case File Summary</h3>
            </div>
            <div className="stat-row" style={{ marginBottom: '1.25rem' }}>
              <Fact label="Complainant" value={`${name}${roll ? ` (${roll})` : ''}`} />
              <Fact label="Department" value={complaint.studentDept} />
              <Fact label="Category" value={complaint.category} />
              <Fact label="Filed on" value={formatDate(complaint.createdAt)} />
            </div>
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              <Info size={16} />
              <span>
                As department faculty you can follow this case and export formal documents. The
                inquiry itself is conducted by the ICC — confidential committee notes are not
                shown here.
              </span>
            </div>
          </div>

          {/* Incident facts */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><FileText size={18} /> Incident Facts</h3>
            </div>

            <div className="grid-2" style={{ gap: '1rem', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <Fact label="Incident date" value={complaint.incidentDate} />
              <Fact label="Location" value={complaint.incidentLocation} />
              <Fact label="Respondent" value={complaint.respondentName} />
              <Fact label="Respondent department" value={complaint.respondentDept} />
            </div>

            <span className="field-label">Statement</span>
            <div
              style={{
                background: 'var(--color-slate-50)',
                border: '1px solid var(--color-slate-200)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                color: 'var(--color-slate-900)',
              }}
            >
              {complaint.description}
            </div>

            {attachments.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <span className="field-label">
                  <Paperclip size={11} style={{ verticalAlign: '-1px' }} /> Attached evidence ({attachments.length})
                </span>
                <AttachmentList attachments={attachments} />
              </div>
            )}
          </div>

          {/* Student-facing updates */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><MessageSquare size={18} /> Official Updates to the Complainant</h3>
            </div>
            {updates.length === 0 ? (
              <div className="empty-state">
                <MessageSquare size={26} />
                <strong>No updates published yet</strong>
                <p>Official updates from the ICC will appear here as the inquiry progresses.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {updates.map(u => (
                  <div
                    key={u.id}
                    style={{
                      background: 'var(--color-blue-50)',
                      border: '1px solid var(--border-blue)',
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-blue-strong)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                      <span>{u.authorName} ({u.authorRole})</span>
                      <span>{formatDate(u.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-blue-strong)', margin: 0, overflowWrap: 'anywhere' }}>
                      {u.updateText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div>
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '1rem' }}>Case Audit History</h3>
            </div>
            <Timeline history={history} currentStatus={complaint.status} />
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '1rem' }}>Escalation Policy</h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', lineHeight: 1.6 }}>
              Every deadline on the statutory clock is monitored automatically. A missed
              acknowledgement, inquiry or report deadline escalates to the presiding officer, then
              the committee, then the system administrators — no case can stall unnoticed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
