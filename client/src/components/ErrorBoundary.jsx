import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="panel" style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: 520, borderTop: '4px solid var(--color-crimson-700)' }}>
            <AlertTriangle size={40} style={{ color: 'var(--color-crimson-700)', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy-900)', marginBottom: '0.5rem' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              An unexpected error occurred while rendering this page. Your data is safe — this is a
              display issue, not a data loss. You can try reloading or navigate back to the dashboard.
            </p>
            {this.state.error && (
              <details style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                <summary style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', cursor: 'pointer' }}>
                  Technical details
                </summary>
                <pre style={{ fontSize: '0.6875rem', color: 'var(--color-slate-600)', background: 'var(--color-slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', overflow: 'auto', marginTop: '0.5rem', maxHeight: 160 }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => window.location.reload()} className="btn btn-primary">
                <RefreshCw size={15} /> Reload page
              </button>
              <a href="/" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                Go to dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
