import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-navy-700)', fontWeight: '600' }}>Authenticating institutional credentials...</p>
      </div>
    );
  }

  // Not logged in -> Redirect to appropriate login page
  if (!user) {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/super-admin') || location.pathname.startsWith('/faculty')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/auth/student/login" state={{ from: location }} replace />;
  }

  // Check RBAC permission
  const isAuthorized = allowedRoles.length === 0 || allowedRoles.includes(user.role);

  if (!isAuthorized) {
    return (
      <div className="container" style={{ padding: '4rem 0' }}>
        <div className="alert alert-danger" style={{ maxWidth: '600px', margin: '0 auto', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
          <ShieldAlert size={48} color="#991B1B" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: '1rem 0 0.5rem 0' }}>
            403 - Role Access Restricted
          </h2>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: '#7F1D1D' }}>
            Your account role (<strong>{user.role}</strong>) does not have authorization to access the route <code>{location.pathname}</code>.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {user.role === 'student' && (
              <a href="/student/dashboard" className="btn btn-primary btn-sm">Go to Student Dashboard</a>
            )}
            {user.role === 'faculty' && (
              <a href="/faculty/dashboard" className="btn btn-primary btn-sm">Go to Faculty Dashboard</a>
            )}
            {(user.role === 'admin' || user.role === 'super_admin') && (
              <a href="/admin/dashboard" className="btn btn-primary btn-sm">Go to Admin Workspace</a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return children;
}
