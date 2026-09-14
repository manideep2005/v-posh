import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import Timeline from '../../components/Timeline';
import AttachmentList from '../../components/AttachmentList';
import { Lock, FileText, ArrowLeft, Shield, Paperclip, Download, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import SLACountdown from '../../components/SLACountdown';

function PDFDownloadButton({ complaintId, type, label }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('vposh_token');
      const res = await fetch(`/api/pdf/student/complaints/${complaintId}/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-displacement')?.split('filename="')[1]?.replace('"', '') || `VPOSH_${type}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button onClick={handleDownload} disabled={downloading} style={{
      padding: '0.35rem 0.65rem', background: 'var(--color-navy-900)', border: 'none',
      borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', cursor: downloading ? 'wait' : 'pointer',
      fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      color: '#fff', fontWeight: '600', opacity: downloading ? 0.6 : 1,
    }}>
      <Download size={11} /> {downloading ? 'Generating...' : label}
    </button>
  );
}

export default function ComplaintDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      const res = await apiFetch(`/student/complaints/${id}`);
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load complaint details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading complaint record details...</div>;
  }

  if (error || !data) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem' }}>
        <div className="alert alert-danger">
          <span>{error || 'Complaint record not found.'}</span>
        </div>
        <Link to="/student/complaints" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back to My Complaints
        </Link>
      </div>
    );
  }

  const { complaint, history = [], updates = [], attachments = [], sla } = data;

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/student/complaints" style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-navy-900)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <ArrowLeft size={14} /> Back to Complaints List
        </Link>
      </div>

      {/* SLA Countdown */}
      {sla && <SLACountdown sla={sla} />}

      {/* Header Overview Card */}
      <div className="panel" style={{ borderTop: '4px solid var(--color-navy-900)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
                {complaint.referenceId}
              </h1>
              <StatusBadge status={complaint.status} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-slate-700)' }}>
              {complaint.title}
            </h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
            <div>Submitted On: <strong>{formatDate(complaint.createdAt)}</strong></div>
            <div>Category: <strong>{complaint.category}</strong></div>
            <div>Priority: <strong style={{ color: complaint.priority === 'Urgent' ? '#DC2626' : complaint.priority === 'High' ? '#EA580C' : 'inherit' }}>{complaint.priority}</strong></div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem' }}>
              <PDFDownloadButton complaintId={complaint.id} type="acknowledgement" label="Acknowledgement" />
              <PDFDownloadButton complaintId={complaint.id} type="status-report" label="Status Report" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* Left Column: Complaint Submitted Content & Official Updates */}
        <div>
          {/* SECTION 1: COMPLAINT INFORMATION */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <FileText size={18} /> Complaint Information
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Incident Date</strong>
                <span>{complaint.incidentDate}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Incident Location</strong>
                <span>{complaint.incidentLocation}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Respondent Name / Designation</strong>
                <span>{complaint.respondentName}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Respondent Department</strong>
                <span>{complaint.respondentDept}</span>
              </div>
            </div>

            <div>
              {complaint.respondentDept && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Respondent Department</strong>
                  <span>{complaint.respondentDept}</span>
                </div>
              )}
              <strong style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Full Description Statement</strong>
              <div style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'var(--color-slate-800)' }}>
                {complaint.description}
              </div>
            </div>
          </div>

          {/* SECTION 4: OFFICIAL UPDATES */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">
                <Shield size={18} /> Official Committee Communications & Updates
              </h3>
            </div>
            {updates.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>No official committee updates published yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {updates.map(u => (
                  <div key={u.id} style={{ background: 'var(--color-blue-50)', border: '1px solid #BFDBFE', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.75rem', color: '#1E40AF', fontWeight: '600' }}>
                      <span>Posted by {u.authorName} ({u.authorRole})</span>
                      <span>{formatDate(u.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#1E3A8A', lineHeight: '1.5' }}>
                      {u.updateText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: DOCUMENTS & ATTACHMENTS */}
          {attachments.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">
                  <Paperclip size={18} /> Evidence Documents & Attachments
                </h3>
              </div>
              <AttachmentList attachments={attachments} />
            </div>
          )}
        </div>

        {/* Right Column: Status & Timeline */}
        <div>
          {/* SECTION 2 & 3: STATUS & TIMELINE */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '1rem' }}>
                Status Timeline Tracking
              </h3>
            </div>
            <Timeline history={history} currentStatus={complaint.status} />
          </div>

          {/* QR Verification Card */}
          <div className="panel" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-navy-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <QrCode size={15} /> Scan to Verify
            </div>
            <div style={{ background: '#fff', display: 'inline-block', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--color-slate-200)' }}>
              <QRCodeSVG
                value={`${window.location.origin}/verify/${complaint.referenceId}`}
                size={120}
                bgColor="#FFFFFF"
                fgColor="#0F172A"
                level="M"
                includeMargin={false}
              />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--color-slate-400)', fontFamily: 'monospace' }}>
              {complaint.referenceId}
            </div>
            <a href={`/verify/${complaint.referenceId}`} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600,
              color: 'var(--color-teal-600)', textDecoration: 'none',
            }}>
              Open verification page ↗
            </a>
          </div>

          <div className="confidentiality-notice" style={{ marginTop: '1rem', fontSize: '0.75rem' }}>
            <Lock size={14} color="var(--color-emerald-700)" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            Internal investigation notes are restricted under institutional privacy rules and excluded from student API views.
          </div>
        </div>
      </div>
    </div>
  );
}
