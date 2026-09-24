import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { User, Save, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function FacultyProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', designation: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [err, setErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/faculty/profile');
      if (res.success) {
        setUser(res.user);
        setForm({ name: res.user.name || '', phone: res.user.phone || '', designation: res.user.designation || '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setSaving(true);
    try {
      const res = await apiFetch('/faculty/profile', { method: 'PUT', body: JSON.stringify(form) });
      if (res.success) { setMsg(res.message); fetchProfile(); }
    } catch (err) {
      setErr(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg(''); setPwdErr('');
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdErr('New passwords do not match.'); return;
    }
    setSavingPwd(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST', body: JSON.stringify({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword })
      });
      if (res.success) { setPwdMsg(res.message); setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
    } catch (err) {
      setPwdErr(err.message || 'Failed to change password.');
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading) return <div className="container page"><div className="loading-state">Loading profile…</div></div>;

  return (
    <div className="container page" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="page-head">
        <div className="page-head-main">
          <h1><User size={22} /> Faculty Profile &amp; Settings</h1>
          <p className="page-sub">Your contact details, designation and account password.</p>
        </div>
      </div>

      {/* Profile Info */}
      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header"><h3 className="panel-title" style={{ fontSize: '1rem' }}>Personal Information</h3></div>
        {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {msg}</div>}
        {err && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {err}</div>}
        <form onSubmit={handleProfileUpdate}>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="text" className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Designation</label>
            <input type="text" className="form-control" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" className="form-control" value={user?.email || ''} disabled style={{ background: 'var(--color-slate-100)' }} />
          </div>
          <div className="form-group">
            <label>Department</label>
            <input type="text" className="form-control" value={user?.department || ''} disabled style={{ background: 'var(--color-slate-100)' }} />
          </div>
          <button type="submit" className="btn btn-emerald btn-sm" disabled={saving}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="panel">
        <div className="panel-header"><h3 className="panel-title" style={{ fontSize: '1rem' }}><Lock size={16} /> Change Password</h3></div>
        {pwdMsg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {pwdMsg}</div>}
        {pwdErr && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {pwdErr}</div>}
        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" className="form-control" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} required />
          </div>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" className="form-control" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} required minLength={8} />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" className="form-control" value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={savingPwd}>
            <Lock size={14} /> {savingPwd ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
