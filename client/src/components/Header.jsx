import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { LogOut } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="inst-header">
      {/* Institutional Branding Header */}
      <div className="container nav-bar">
        <Link to="/" className="brand">
          <div className="brand-logo-container" style={{ background: '#FFFFFF', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
            <img 
              src="/vit-ap-logo.png" 
              alt="VIT-AP University Logo" 
              style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <div className="brand-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ color: '#5EEAD4', fontWeight: '800', letterSpacing: '0.02em', fontSize: '1.25rem' }}>V-POSH</span>
              <span style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: '400' }}>| VIT-AP University</span>
            </h1>
            <p>Internal Complaints Committee (ICC) • Grievance & Awareness Portal</p>
          </div>
        </Link>

        <nav>
          <ul className="nav-links">
            <li>
              <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
            </li>
            <li>
              <Link to="/awareness" className={isActive('/awareness') ? 'active' : ''}>POSH Guidelines & Policies</Link>
            </li>

            {user && user.role === 'student' && (
              <>
                <li>
                  <Link to="/student/dashboard" className={isActive('/student/dashboard') ? 'active' : ''}>My Dashboard</Link>
                </li>
                <li>
                  <Link to="/student/complaints" className={isActive('/student/complaints') ? 'active' : ''}>Track Complaints</Link>
                </li>
                <li>
                  <Link to="/student/complaints/new" className="btn btn-emerald btn-sm" style={{ textDecoration: 'none' }}>
                    + Raise Complaint
                  </Link>
                </li>
              </>
            )}

            {user && (user.role === 'admin' || user.role === 'super_admin') && (
              <>
                <li>
                  <Link to="/admin/dashboard" className={isActive('/admin/dashboard') ? 'active' : ''}>ICC Workspace</Link>
                </li>
                <li>
                  <Link to="/admin/complaints" className={isActive('/admin/complaints') ? 'active' : ''}>All Complaints</Link>
                </li>
                <li>
                  <Link to="/admin/students" className={isActive('/admin/students') ? 'active' : ''}>Student Directory</Link>
                </li>
              </>
            )}

            {user && user.role === 'super_admin' && (
              <>
                <li>
                  <Link to="/super-admin/admins" className={isActive('/super-admin/admins') ? 'active' : ''}>Manage Staff</Link>
                </li>
                <li>
                  <Link to="/super-admin/audit-logs" className={isActive('/super-admin/audit-logs') ? 'active' : ''}>Audit Logs</Link>
                </li>
                <li>
                  <Link to="/super-admin/settings" className={isActive('/super-admin/settings') ? 'active' : ''}>Settings</Link>
                </li>
              </>
            )}

            {!user ? (
              <>
                <li>
                  <Link to="/auth/student/login" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                    Student Login
                  </Link>
                </li>
                <li>
                  <Link to="/admin/login" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                    Admin Login
                  </Link>
                </li>
              </>
            ) : (
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
                <NotificationBell />
                <span className="role-badge" title={`Role: ${user.role}`}>
                  {user.role}
                </span>
                <button 
                  onClick={logout} 
                  className="btn btn-secondary btn-sm"
                  title="Logout from portal"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
