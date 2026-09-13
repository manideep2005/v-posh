import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password, 'admin');
      if (user.role === 'super_admin') {
        navigate('/super-admin/dashboard');
      } else if (user.role === 'faculty') {
        navigate('/faculty/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem', borderTop: '4px solid var(--color-emerald-700)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-navy-900)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
            <ShieldCheck size={24} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            Staff Portal Sign In
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: '0.25rem' }}>
            Admin, Super Admin, and Faculty access
          </p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="admin-email">Staff / Administrative Email <span className="required">*</span></label>
            <input
              id="admin-email"
              type="email"
              className="form-control"
              placeholder="e.g. presiding.officer@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password">Secure Password <span className="required">*</span></label>
            <input
              id="admin-password"
              type="password"
              className="form-control"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-emerald"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Verifying Authorization...' : 'Access Admin Workspace'} <ArrowRight size={16} />
          </button>
        </form>          <div style={{ backgroundColor: 'var(--color-slate-100)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--color-slate-600)', textAlign: 'center' }}>
          <strong>Notice:</strong> All staff access is logged under statutory audit regulations. Unauthorized access attempts are monitored and recorded.
        </div>
      </div>
    </div>
  );
}
