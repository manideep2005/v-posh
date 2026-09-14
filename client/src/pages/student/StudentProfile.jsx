
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { User, CheckCircle2, AlertCircle, Camera } from 'lucide-react';

export default function StudentProfile() {
  const { user, checkCurrentSession } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    department: user?.department || '',
    year: user?.year || ''
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setLoading(true);

    try {
      const res = await apiFetch('/student/profile', {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      if (res.success) {
        setMsg('Profile updated successfully.');
        checkCurrentSession();
      }
    } catch (e) {
      setErr(e.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const body = new FormData();
    body.append('avatar', file);
    try {
      const res = await apiFetch('/auth/profile-picture', { method: 'POST', body });
      if (res.success) {
        setMsg('Profile picture updated.');
        checkCurrentSession();
      }
    } catch (err) { alert(err.message || 'Upload failed.'); }
  };

  const getInitials = (name) => (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '600px' }}>
      <div className="panel">
        {/* Profile Header with Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', borderBottom: '1px solid var(--color-slate-200)', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-emerald-400)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-emerald-500), var(--color-emerald-700))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700', border: '3px solid var(--color-emerald-200)' }}>
                {getInitials(user?.name)}
              </div>
            )}
            <label style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--color-navy-900)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', transition: 'transform 0.15s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <Camera size={13} />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </label>
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-navy-900)', margin: 0 }}>{user?.name || 'Student'}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', margin: '0.15rem 0 0' }}>{user?.email}</p>
            <span className="role-badge" style={{ marginTop: '0.35rem', display: 'inline-block' }}>{user?.role}</span>
          </div>
        </div>

        <div className="panel-header">
          <h1 className="panel-title">
            <User size={20} /> Profile Details
          </h1>
        </div>

        {msg && <div className="alert alert-success"><CheckCircle2 size={16} /> <span>{msg}</span></div>}
        {err && <div className="alert alert-danger"><AlertCircle size={16} /> <span>{err}</span></div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Student ID / Roll Number (Fixed)</label>
            <input type="text" className="form-control" value={user?.studentId || ''} disabled style={{ backgroundColor: 'var(--color-slate-100)' }} />
          </div>

          <div className="form-group">
            <label>Institutional Email (Fixed)</label>
            <input type="email" className="form-control" value={user?.email || ''} disabled style={{ backgroundColor: 'var(--color-slate-100)' }} />
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <input
              id="department"
              type="text"
              className="form-control"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="year">Academic Level / Year</label>
            <input
              id="year"
              type="text"
              className="form-control"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Contact Phone Number</label>
            <input
              id="phone"
              type="tel"
              className="form-control"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving Profile...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
