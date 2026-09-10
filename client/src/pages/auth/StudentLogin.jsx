import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function StudentLogin() {
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
      await login(email, password, 'student');
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-navy-900)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
            <Lock size={22} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            Student Grievance Sign In
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: '0.25rem' }}>
            Enter your institutional credentials to manage complaints
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
            <label htmlFor="email">Institutional Email Address <span className="required">*</span></label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="e.g. student@student.institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="password">Password <span className="required">*</span></label>
              <Link to="/auth/student/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--color-emerald-700)' }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
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
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', borderTop: '1px solid var(--color-slate-200)', paddingTop: '1rem', color: 'var(--color-slate-600)' }}>
          Don't have a student portal account yet?{' '}
          <Link to="/auth/student/signup" style={{ fontWeight: '600', color: 'var(--color-navy-900)' }}>
            Register Now
          </Link>
        </div>
      </div>
    </div>
  );
}
