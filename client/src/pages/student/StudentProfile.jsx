import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import {
  User, CheckCircle2, AlertCircle, Camera, Loader2, Lock, ShieldCheck,
  Fingerprint, Save, ArrowLeft, Mail, Phone,
} from 'lucide-react';

const initials = (name) => (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export default function StudentProfile() {
  const { user, checkCurrentSession } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    department: user?.department || '',
    year: user?.year || '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [uploadErr, setUploadErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // The session loads asynchronously, so seed the form once the user arrives.
  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      department: user.department || '',
      year: user.year || '',
    });
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setLoading(true);
    try {
      const res = await apiFetch('/student/profile', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      if (res.success) {
        setMsg('Profile updated successfully.');
        checkCurrentSession();
      } else {
        setErr(res.message || 'Failed to update profile.');
      }
    } catch (e) {
      setErr(e.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr('');
    setMsg('');
    setUploading(true);
    const body = new FormData();
    body.append('avatar', file);
    try {
      const res = await apiFetch('/auth/profile-picture', { method: 'POST', body });
      if (res.success) {
        setMsg('Profile picture updated.');
        checkCurrentSession();
      } else {
        setUploadErr(res.message || 'Upload failed.');
      }
    } catch (err) {
      setUploadErr(err.message || 'Upload failed. Please try a smaller image.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="container page">
      <Link to="/student/dashboard" className="crumbs">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div className="page-head">
        <div className="page-head-main">
          <h1><User size={22} /> My Profile</h1>
          <p className="page-sub">
            Keep your contact details current — the ICC uses them to reach you about an active
            case. Your roll number and institutional email are locked to your verified identity.
          </p>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success"><CheckCircle2 size={16} /><span>{msg}</span></div>
      )}
      {err && (
        <div className="alert alert-danger"><AlertCircle size={16} /><span>{err}</span></div>
      )}
      {uploadErr && (
        <div className="alert alert-danger"><AlertCircle size={16} /><span>{uploadErr}</span></div>
      )}

      <div className="split-sidebar">
        {/* ── Identity card ── */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title"><User size={19} /> Profile details</h2>
          </div>

          <div className="identity-card">
            <div className="identity-avatar-wrap">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="identity-avatar" />
              ) : (
                <div className="identity-avatar identity-avatar-fallback">{initials(user?.name)}</div>
              )}
              <label className="identity-avatar-edit" title="Change photo">
                {uploading ? <Loader2 size={13} className="spin-icon" /> : <Camera size={13} />}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
              </label>
            </div>
            <div style={{ minWidth: 0 }}>
              <strong className="identity-name">{user?.name || 'Student'}</strong>
              <div className="cell-muted truncate" style={{ maxWidth: '100%' }}>{user?.email}</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <span className="chip chip-emerald">Verified student</span>
                {user?.studentId && <span className="chip chip-navy">ID {user.studentId}</span>}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="studentId">Roll number</label>
                <div className="input-locked">
                  <Fingerprint size={15} />
                  <input id="studentId" className="form-control" value={user?.studentId || '—'} disabled />
                  <Lock size={13} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="email">Institutional email</label>
                <div className="input-locked">
                  <Mail size={15} />
                  <input id="email" type="email" className="form-control" value={user?.email || ''} disabled />
                  <Lock size={13} />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="name">Full name</label>
              <div className="input-icon">
                <User size={15} />
                <input
                  id="name"
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="As it appears in university records"
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="department">Department</label>
                <input
                  id="department"
                  type="text"
                  className="form-control"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. CSE"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="year">Academic level / year</label>
                <input
                  id="year"
                  type="text"
                  className="form-control"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="e.g. 3rd Year"
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="phone">Contact phone number</label>
              <div className="input-icon">
                <Phone size={15} />
                <input
                  id="phone"
                  type="tel"
                  className="form-control"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Used only for case-related contact"
                />
              </div>
              <span className="field-hint">
                Shared with the ICC only. Nothing here is visible to other students or faculty.
              </span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={15} className="spin-icon" /> Saving…</> : <><Save size={15} /> Save changes</>}
            </button>
          </form>
        </div>

        {/* ── Trust sidebar ── */}
        <div>
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title"><ShieldCheck size={18} /> What stays private</h2>
            </div>
            <ul className="trust-list">
              <li>Your complaints are visible only to the ICC — never to your department or classmates.</li>
              <li>Case feedback is stored with no link to your account.</li>
              <li>Every action on your case is written to a tamper-evident audit ledger.</li>
            </ul>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title"><Lock size={18} /> Account security</h2>
            </div>
            <p className="page-sub" style={{ marginTop: 0 }}>
              Passwords and sign-in are handled by VIT-AP single sign-on. To rotate a password or
              revoke a device, use the university identity portal.
            </p>
            <Link to="/student/settings" className="btn btn-secondary btn-block">
              Notification & privacy settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
