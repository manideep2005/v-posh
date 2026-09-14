import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { LogOut, Menu, X, ChevronDown } from 'lucide-react';

function LoginDropdown() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const loc = useLocation();
  const dropdownRef = useRef(null);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const roles = [
    { label: 'Student', path: '/auth/student/login', desc: 'Students & scholars', color: '#6366F1' },
    { label: 'Faculty', path: '/faculty/login', desc: 'Faculty members', color: '#3B82F6' },
    { label: 'Admin', path: '/admin/login', desc: 'ICC & Admin staff', color: '#14B8A6' },
    { label: 'Super Admin', path: '/super-admin/login', desc: 'System administrators', color: '#8B5CF6' },
  ];

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn btn-primary btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
      >
        Sign In <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '260px',
          background: '#fff', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', zIndex: 50, overflow: 'hidden',
        }}>
          <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--color-slate-100)', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select your role
          </div>
          {roles.map((r, i) => (
            <Link key={r.label} to={r.path} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem',
              textDecoration: 'none', fontSize: '0.875rem', position: 'relative',
              background: selected === r.label ? `${r.color}08` : 'transparent',
              borderLeft: selected === r.label ? `3px solid ${r.color}` : '3px solid transparent',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = selected === r.label ? `${r.color}10` : 'var(--color-slate-50)';
              e.currentTarget.style.borderLeftColor = r.color;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = selected === r.label ? `${r.color}08` : 'transparent';
              e.currentTarget.style.borderLeftColor = selected === r.label ? r.color : 'transparent';
            }}
            onClick={() => setSelected(r.label)}
            >
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: selected === r.label ? r.color : 'var(--color-slate-300)',
                transition: 'background 0.15s',
              }} />
              <div>
                <div style={{ fontWeight: '600', color: 'var(--color-navy-900)', lineHeight: '1.3' }}>{r.label}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', lineHeight: '1.3' }}>{r.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="inst-header">
      <div className="container nav-bar">
        {/* Brand */}
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <div className="brand-logo-container" style={{ background: '#FFFFFF', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
            <img
              src="/vit-ap-logo.png"
              alt="VIT-AP University Logo"
              style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <div className="brand-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#5EEAD4', fontWeight: '800', letterSpacing: '0.02em', fontSize: '1.25rem' }}>V-POSH</span>
              <span className="brand-university" style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: '400' }}>| VIT-AP University</span>
            </h1>
            <p className="brand-tagline">Internal Complaints Committee (ICC) • Grievance &amp; Awareness Portal</p>
          </div>
        </Link>

        {/* Hamburger toggle — mobile only */}
        <button
          className="hamburger-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Desktop nav */}
        <nav className="desktop-nav">
          <ul className="nav-links">
            <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
            <li><Link to="/awareness" className={isActive('/awareness') ? 'active' : ''}>POSH Guidelines &amp; Policies</Link></li>

            {user && user.role === 'student' && (<>
              <li><Link to="/student/dashboard" className={isActive('/student/dashboard') ? 'active' : ''}>My Dashboard</Link></li>
              <li><Link to="/student/complaints" className={isActive('/student/complaints') ? 'active' : ''}>Track Complaints</Link></li>
              <li><Link to="/student/complaints/new" className="btn btn-emerald btn-sm" style={{ textDecoration: 'none' }}>+ Raise Complaint</Link></li>
            </>)}

            {user && user.role === 'faculty' && (<>
              <li><Link to="/faculty/dashboard" className={isActive('/faculty/dashboard') ? 'active' : ''}>Dashboard</Link></li>
              <li><Link to="/faculty/complaints" className={isActive('/faculty/complaints') ? 'active' : ''}>Department Cases</Link></li>
              <li><Link to="/faculty/complaints/new" className="btn btn-emerald btn-sm" style={{ textDecoration: 'none' }}>+ File Complaint</Link></li>
              <li><Link to="/faculty/students" className={isActive('/faculty/students') ? 'active' : ''}>Students</Link></li>
            </>)}

            {user && (user.role === 'admin' || user.role === 'super_admin') && (<>
              <li><Link to="/admin/dashboard" className={isActive('/admin/dashboard') ? 'active' : ''}>ICC Workspace</Link></li>
              <li><Link to="/admin/complaints" className={isActive('/admin/complaints') ? 'active' : ''}>All Complaints</Link></li>
              <li><Link to="/admin/case-allocation" className={isActive('/admin/case-allocation') ? 'active' : ''}>Case Allocation</Link></li>
              <li><Link to="/admin/students" className={isActive('/admin/students') ? 'active' : ''}>Student Directory</Link></li>
              <li><Link to="/admin/faculty" className={isActive('/admin/faculty') ? 'active' : ''}>Faculty</Link></li>
            </>)}

            {user && user.role === 'super_admin' && (<>
              <li><Link to="/super-admin/workload" className={isActive('/super-admin/workload') ? 'active' : ''}>Workload Analytics</Link></li>
              <li><Link to="/super-admin/admins" className={isActive('/super-admin/admins') ? 'active' : ''}>Manage Staff</Link></li>
              <li><Link to="/super-admin/announcements" className={isActive('/super-admin/announcements') ? 'active' : ''}>Announcements</Link></li>
              <li><Link to="/super-admin/audit-logs" className={isActive('/super-admin/audit-logs') ? 'active' : ''}>Audit Logs</Link></li>
              <li><Link to="/super-admin/settings" className={isActive('/super-admin/settings') ? 'active' : ''}>Settings</Link></li>
            </>)}

            {!user ? (
              <li style={{ position: 'relative' }} className="login-dropdown-wrapper">
                <LoginDropdown />
              </li>
            ) : (
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
                <NotificationBell />
                <span className="role-badge" title={`Role: ${user.role}`}>{user.role}</span>
                <button onClick={logout} className="btn btn-secondary btn-sm" title="Logout">
                  <LogOut size={14} /><span>Logout</span>
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>

      {/* Mobile slide-down nav */}
      <nav className={`mobile-nav${menuOpen ? ' mobile-nav--open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <ul className="mobile-nav-links">
          <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
          <li><Link to="/awareness" className={isActive('/awareness') ? 'active' : ''}>POSH Guidelines &amp; Policies</Link></li>

          {user && user.role === 'student' && (<>
            <li><Link to="/student/dashboard" className={isActive('/student/dashboard') ? 'active' : ''}>My Dashboard</Link></li>
            <li><Link to="/student/complaints" className={isActive('/student/complaints') ? 'active' : ''}>Track Complaints</Link></li>
            <li><Link to="/student/complaints/new" className={isActive('/student/complaints/new') ? 'active' : ''}>+ Raise Complaint</Link></li>
          </>)}

          {user && user.role === 'faculty' && (<>
            <li><Link to="/faculty/dashboard" className={isActive('/faculty/dashboard') ? 'active' : ''}>Dashboard</Link></li>
            <li><Link to="/faculty/complaints" className={isActive('/faculty/complaints') ? 'active' : ''}>Department Cases</Link></li>
            <li><Link to="/faculty/complaints/new" className={isActive('/faculty/complaints/new') ? 'active' : ''}>+ File Complaint</Link></li>
            <li><Link to="/faculty/students" className={isActive('/faculty/students') ? 'active' : ''}>Students</Link></li>
          </>)}

          {user && (user.role === 'admin' || user.role === 'super_admin') && (<>
            <li><Link to="/admin/dashboard" className={isActive('/admin/dashboard') ? 'active' : ''}>ICC Workspace</Link></li>
            <li><Link to="/admin/complaints" className={isActive('/admin/complaints') ? 'active' : ''}>All Complaints</Link></li>
            <li><Link to="/admin/case-allocation" className={isActive('/admin/case-allocation') ? 'active' : ''}>Case Allocation</Link></li>
            <li><Link to="/admin/students" className={isActive('/admin/students') ? 'active' : ''}>Student Directory</Link></li>
            <li><Link to="/admin/faculty" className={isActive('/admin/faculty') ? 'active' : ''}>Faculty</Link></li>
          </>)}

          {user && user.role === 'super_admin' && (<>
            <li><Link to="/super-admin/workload" className={isActive('/super-admin/workload') ? 'active' : ''}>Workload Analytics</Link></li>
            <li><Link to="/super-admin/admins" className={isActive('/super-admin/admins') ? 'active' : ''}>Manage Staff</Link></li>
            <li><Link to="/super-admin/announcements" className={isActive('/super-admin/announcements') ? 'active' : ''}>Announcements</Link></li>
            <li><Link to="/super-admin/audit-logs" className={isActive('/super-admin/audit-logs') ? 'active' : ''}>Audit Logs</Link></li>
            <li><Link to="/super-admin/settings" className={isActive('/super-admin/settings') ? 'active' : ''}>Settings</Link></li>
          </>)}

          {!user ? (
            <li className="mobile-nav-auth">
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Select your role</div>
              <Link to="/auth/student/login" className="btn btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Student</Link>
              <Link to="/faculty/login" className="btn btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Faculty</Link>
              <Link to="/admin/login" className="btn btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Admin</Link>
              <Link to="/super-admin/login" className="btn btn-primary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Super Admin</Link>
            </li>
          ) : (
            <li className="mobile-nav-auth">
              <button onClick={() => { logout(); setMenuOpen(false); }} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <LogOut size={14} /> Logout ({user.name || user.role})
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}

