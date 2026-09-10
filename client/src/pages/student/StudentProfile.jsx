
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { User, CheckCircle2, AlertCircle } from 'lucide-react';

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

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '600px' }}>
      <div className="panel">
        <div className="panel-header">
          <h1 className="panel-title">
            <User size={20} /> Student Profile & Institutional Details
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
