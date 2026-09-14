import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

export default function ConfirmActionModal({ isOpen, onClose, onConfirm, action, complaintRef }) {
  const [reason, setReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reasonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setConfirmEmail('');
      setError('');
      setTimeout(() => reasonRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDelete = action === 'delete';
  const title = isDelete ? 'Delete Complaint' : 'Pause Complaint';
  const description = isDelete
    ? `You are about to permanently delete complaint ${complaintRef}. This action cannot be undone.`
    : `You are about to pause complaint ${complaintRef}. You can resume it later.`;
  const dangerColor = isDelete ? '#DC2626' : '#D97706';
  const dangerBg = isDelete ? '#FEF2F2' : '#FFFBEB';
  const dangerBorder = isDelete ? '#FECACA' : '#FDE68A';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Please provide a reason for this action.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters.');
      return;
    }
    if (!confirmEmail.trim()) {
      setError('Please enter your email to confirm this action.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({ reason: reason.trim(), email: confirmEmail.trim() });
    } catch (err) {
      setError(err.message || 'Action failed. Please check your email and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
        animation: 'modalSlide 0.2s ease-out',
      }}>
        <style>{`@keyframes modalSlide { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }`}</style>

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `2px solid ${dangerBorder}`, background: dangerBg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: dangerColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{title}</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>{complaintRef}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            borderRadius: 6, display: 'flex', color: '#94A3B8',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            {description}
          </p>

          {/* Reason */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>
              Reason <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Why do you want to ${action} this complaint?`}
              rows={3}
              style={{
                width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8,
                border: '1.5px solid #E2E8F0', fontSize: '0.85rem', fontFamily: 'inherit',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#0D9488'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
            <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem' }}>
              Minimum 10 characters. This will be recorded in the audit log.
            </div>
          </div>

          {/* Security Check — Email Confirmation */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>
              <ShieldCheck size={14} color="#0D9488" /> Security Verification <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="Type your registered email to confirm"
              autoComplete="email"
              style={{
                width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8,
                border: '1.5px solid #E2E8F0', fontSize: '0.85rem', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#0D9488'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
            <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem' }}>
              Enter your registered email address to authorize this action.
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.6rem 0.75rem', borderRadius: 8, marginBottom: '1rem',
              background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
              fontSize: '0.8rem', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '0.55rem 1rem', borderRadius: 8, border: '1px solid #E2E8F0',
              background: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', color: '#475569',
            }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{
              padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none',
              background: dangerColor, color: '#fff', fontSize: '0.8rem',
              fontWeight: 600, cursor: submitting ? 'wait' : 'pointer',
              fontFamily: 'inherit', opacity: submitting ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <ShieldCheck size={14} />
              {submitting ? 'Verifying...' : isDelete ? 'Delete Permanently' : 'Pause Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
