import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, ExternalLink, Phone, Mail, MapPin } from 'lucide-react';

export default function VerifyCase() {
  const { refId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/pdf/case/${refId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Failed to verify. Please try again.'))
      .finally(() => setLoading(false));
  }, [refId]);

  if (loading) {
    return (
      <div className="verify-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-slate-50)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #0D9488', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.9rem' }}>Verifying document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="verify-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-slate-50)' }}>
        <div className="verify-card" style={{ borderRadius: 12, padding: '2.5rem', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <XCircle size={48} color="#DC2626" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.25rem', color: 'var(--color-navy-900)', marginBottom: '0.5rem' }}>Verification Failed</h2>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    );
  }

  const verified = data?.verified;

  return (
    <div className="verify-page" style={{ minHeight: '100vh', background: 'var(--color-slate-50)', padding: '2rem 1rem' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #0F172A, #1E293B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={22} color="#0D9488" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="verify-brand-name" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-navy-900)', letterSpacing: '-0.02em' }}>V-POSH</div>
              <div className="verify-brand-sub" style={{ fontSize: '0.65rem', color: 'var(--color-slate-400)', letterSpacing: '0.05em' }}>VIT-AP University</div>
            </div>
          </div>
        </div>

        {/* Verification Card */}
        <div className="verify-card" style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {/* Status Banner */}
          <div style={{
            padding: '1.5rem 1.5rem',
            background: verified ? 'linear-gradient(135deg, #065F46, #047857)' : 'linear-gradient(135deg, #991B1B, #B91C1C)',
            color: '#fff',
            textAlign: 'center',
          }}>
            {verified ? <CheckCircle size={36} style={{ marginBottom: '0.5rem' }} /> : <XCircle size={36} style={{ marginBottom: '0.5rem' }} />}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              {verified ? 'Document Verified' : 'Verification Failed'}
            </h2>
            <p style={{ fontSize: '0.8rem', opacity: 0.85, margin: '0.35rem 0 0' }}>
              {verified ? 'This complaint is registered in the V-POSH system' : data?.message || 'Not found'}
            </p>
          </div>

          {verified && data?.complaint && (
            <div style={{ padding: '1.5rem' }}>
              {/* Reference ID */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div className="verify-card-label" style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Complaint Reference</div>
                <div className="verify-card-ref" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0D9488', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                  {data.complaint.referenceId}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Category', value: data.complaint.category },
                  { label: 'Priority', value: data.complaint.priority },
                  { label: 'Status', value: data.complaint.status },
                  { label: 'Submitted', value: new Date(data.complaint.submittedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="verify-card-label" style={{ fontSize: '0.65rem', color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div className="verify-card-value" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy-900)', marginTop: '0.15rem' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="verify-divider" style={{ height: 1, background: 'var(--color-slate-200)', margin: '0 0 1.25rem' }} />

              {/* Platform Info */}
              <div style={{ background: 'var(--color-slate-50)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <div className="verify-card-label" style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Issuing Platform</div>
                <div className="verify-card-value" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-navy-900)' }}>{data.platform?.fullName}</div>
              </div>

              {/* Contact */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-slate-600)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={13} color="#0D9488" />
                  <span>{data.platform?.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={13} color="#0D9488" />
                  <span>{data.platform?.helpline}</span>
                </div>
              </div>
            </div>
          )}

          {!verified && (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-slate-400)', lineHeight: 1.5 }}>
                If you believe this is an error, please contact the ICC committee directly.
              </p>
              <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-slate-600)' }}>
                <Mail size={13} color="#0D9488" style={{ verticalAlign: 'middle' }} /> vposh@vitap.ac.in
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="verify-footer-note" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.7rem', color: 'var(--color-slate-400)' }}>
          V-POSH • VIT-AP University • POSH Act, 2013 Compliance
        </div>
      </div>
    </div>
  );
}
