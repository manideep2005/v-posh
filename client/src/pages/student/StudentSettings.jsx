import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { User, Save, Lock, Bell, CheckCircle2, AlertCircle } from 'lucide-react';

export default function StudentSettings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', department: '', year: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [err, setErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/auth/me');
      if (res.success) {
        setUser(res.user);
        setForm({
          name: res.user.name || '',
          phone: res.user.phone || '',
          department: res.user.department || '',
          year: res.user.year || '',
        });
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
      const res = await apiFetch('/student/profile', { method: 'PUT', body: JSON.stringify(form) });
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

  if (loading) return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading settings...</div>;

  const TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '720px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '1.5rem' }}>
        ⚙️ Settings
      </h1>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-slate-200)', paddingBottom: '0.5rem' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                background: activeTab === tab.id ? 'var(--color-navy-900)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--color-slate-600)',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="panel" style={{ borderTop: '4px solid var(--color-emerald-700)' }}>
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>Personal Information</h3>
          </div>
          {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {msg}</div>}
          {err && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {err}</div>}
          <form onSubmit={handleProfileUpdate}>
            {/* Avatar / Profile Image Area */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--color-slate-50)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-emerald-600), var(--color-navy-900))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem', fontWeight: '800', flexShrink: 0 }}>
                {(form.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--color-navy-900)' }}>{user?.name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>{user?.email}</div>
                <div style={{ marginTop: '0.35rem' }}>
                  <span className="role-badge" style={{ fontSize: '0.7rem' }}>Student</span>
                  {user?.authProvider && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-400)', marginLeft: '0.5rem' }}>
                      via {user.authProvider === 'google' ? '🔐 Google' : user.authProvider === 'kratosid' ? '📱 KratosID' : '🔑 Password'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="tel" className="form-control" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Department</label>
                <select className="form-control" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                  <option value="">Select Department</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Biotechnology">Biotechnology</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Humanities & Social Sciences">Humanities & Social Sciences</option>
                  <option value="Business Studies">Business Studies</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Year of Study</label>
                <select className="form-control" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="5th Year">5th Year (Integrated)</option>
                </select>
              </div>
            </div>

            {/* Read-only fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              <div className="form-group">
                <label>Student ID / Roll No</label>
                <input type="text" className="form-control" value={user?.studentId || ''} disabled style={{ background: 'var(--color-slate-100)' }} />
              </div>
              <div className="form-group">
                <label>Account Status</label>
                <input type="text" className="form-control" value={user?.status || ''} disabled style={{ background: 'var(--color-slate-100)' }} />
              </div>
            </div>

            <button type="submit" className="btn btn-emerald" disabled={saving} style={{ marginTop: '0.5rem' }}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="panel" style={{ borderTop: '4px solid var(--color-navy-900)' }}>
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}><Lock size={16} /> Change Password</h3>
          </div>
          {pwdMsg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {pwdMsg}</div>}
          {pwdErr && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {pwdErr}</div>}
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" className="form-control" placeholder="Enter current password" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" className="form-control" placeholder="Min. 8 characters" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} required minLength={8} />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" className="form-control" placeholder="Re-enter new password" value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} required />
              </div>
            </div>
            <button type="submit" className="btn btn-secondary" disabled={savingPwd} style={{ marginTop: '0.5rem' }}>
              <Lock size={15} /> {savingPwd ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="panel" style={{ borderTop: '4px solid var(--color-amber-500)' }}>
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}><Bell size={16} /> Notification Preferences</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Complaint Status Updates', desc: 'Get notified when your complaint status changes', enabled: true },
              { label: 'Official Updates from ICC', desc: 'Receive notifications for public updates on your cases', enabled: true },
              { label: 'Email Notifications', desc: 'Receive email copies of important notifications', enabled: false },
              { label: 'System Announcements', desc: 'Platform updates and maintenance notices', enabled: true },
            ].map((pref, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--color-navy-900)' }}>{pref.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' }}>{pref.desc}</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={pref.enabled} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '12px', transition: '0.3s',
                    background: pref.enabled ? 'var(--color-emerald-600)' : 'var(--color-slate-300)',
                  }} />
                  <span style={{
                    position: 'absolute', height: '18px', width: '18px', borderRadius: '50%',
                    left: pref.enabled ? '23px' : '3px', bottom: '3px', background: '#fff', transition: '0.3s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
