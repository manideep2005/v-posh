import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devLink, setDevLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setDevLink('');
    setLoading(true);

    try {
      const res = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      setMessage(res.message);
      // No SMTP transport is configured in this build; the server returns the
      // reset link directly in development so the flow can be tested end-to-end.
      if (res.devLink) setDevLink(res.devLink);
    } catch (err) {
      setError(err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-navy-900)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
            <KeyRound size={22} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            Reset Password Request
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: '0.25rem' }}>
            Enter your institutional email to receive verification reset link
          </p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        )}

        {devLink && (
          <div className="alert alert-info" style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>
            <span>
              <strong>Development mode:</strong> no email server is configured, so here is your reset link:{' '}
              <a href={devLink} style={{ fontWeight: 600, textDecoration: 'underline' }}>Open password reset page</a>
            </span>
          </div>
        )}

        {!message && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Registered Email Address <span className="required">*</span></label>
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

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Dispatching Link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', borderTop: '1px solid var(--color-slate-200)', paddingTop: '1rem' }}>
          <Link to="/auth/student/login" style={{ fontWeight: '600', color: 'var(--color-navy-900)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
