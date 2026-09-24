import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import DarkModeToggle from './DarkModeToggle';
import {
  LogOut, Menu, X, ChevronDown, LayoutDashboard, FileText, FolderOpen,
  Users, GraduationCap, BarChart3, UserCog, Megaphone, ScrollText, Settings,
} from 'lucide-react';

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
          background: 'var(--color-slate-100)', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)',
          boxShadow: '0 10px 34px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)', zIndex: 50, overflow: 'hidden',
        }}>
          <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--color-slate-100)', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select your role
          </div>
          {roles.map((r) => (
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

/**
 * A grouped header destination set.
 *
 * ICC and super-admin accounts have a dozen destinations — more than a single
 * header row can hold on a laptop. Grouping them into menus keeps the header a
 * fixed, predictable height instead of letting links wrap into the page.
 */
function NavMenu({ label, items, isActive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();
  const anyActive = items.some(i => isActive(i.to));

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="nav-menu" ref={ref}>
      <button
        type="button"
        className={`nav-menu-btn${anyActive ? ' nav-menu-btn--active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(o => !o)}
      >
        {label}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div className="nav-menu-panel" role="menu">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                className={isActive(item.to) ? 'active' : ''}
                onClick={() => setOpen(false)}
              >
                {Icon && <Icon size={15} style={{ flexShrink: 0, opacity: 0.75 }} />}
                <span>
                  {item.label}
                  {item.desc && <small>{item.desc}</small>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One definition of the navigation, rendered by both the desktop and mobile navs. */
function buildNav(user) {
  const links = [
    { to: '/', label: 'Home', exact: true },
    { to: '/awareness', label: 'POSH Guidelines & Policies' },
  ];
  const menus = [];
  let cta = null;

  if (!user) return { links, menus, cta };

  if (user.role === 'student') {
    menus.push({
      label: 'My Cases',
      items: [
        { to: '/student/dashboard', label: 'My Dashboard', icon: LayoutDashboard, desc: 'Case tracker and deadlines' },
        { to: '/student/complaints', label: 'Track Complaints', icon: FileText, desc: 'Every case you filed' },
        { to: '/student/profile', label: 'My Profile', icon: GraduationCap, desc: 'Roll number and contact' },
      ],
    });
    cta = { to: '/student/complaints/new', label: 'Raise Complaint' };
  } else if (user.role === 'faculty') {
    menus.push({
      label: 'My Department',
      items: [
        { to: '/faculty/dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Compliance clock and cases' },
        { to: '/faculty/complaints', label: 'Department Cases', icon: FileText, desc: 'Grievances from your students' },
        { to: '/faculty/students', label: 'Students', icon: Users, desc: 'Directory and case counts' },
        { to: '/faculty/profile', label: 'My Profile', icon: GraduationCap, desc: 'Designation and password' },
      ],
    });
    cta = { to: '/faculty/complaints/new', label: 'File Complaint' };
  } else if (user.role === 'admin' || user.role === 'super_admin') {
    menus.push({
      label: 'ICC Workspace',
      items: [
        { to: '/admin/dashboard', label: 'Case Command Centre', icon: LayoutDashboard, desc: 'Live queue, SLAs and breaches' },
        { to: '/admin/complaints', label: 'All Complaints', icon: FileText, desc: 'Search, filter and open cases' },
        { to: '/admin/case-allocation', label: 'Case Allocation', icon: FolderOpen, desc: 'Assign inquiry teams' },
        { to: '/admin/students', label: 'Student Directory', icon: GraduationCap, desc: 'Complainants and respondents' },
        { to: '/admin/faculty', label: 'Faculty Directory', icon: Users, desc: 'Staff records and cases' },
      ],
    });
  }

  if (user.role === 'super_admin') {
    menus.push({
      label: 'Administration',
      items: [
        { to: '/super-admin/workload', label: 'Workload Analytics', icon: BarChart3, desc: 'Officer caseload balance' },
        { to: '/super-admin/admins', label: 'Manage Staff', icon: UserCog, desc: 'ICC roles and access' },
        { to: '/super-admin/announcements', label: 'Announcements', icon: Megaphone, desc: 'Broadcast to the campus' },
        { to: '/super-admin/audit-logs', label: 'Audit Logs', icon: ScrollText, desc: 'Tamper-evident activity trail' },
        { to: '/super-admin/settings', label: 'Settings', icon: Settings, desc: 'Platform policy and SLAs' },
      ],
    });
  }

  return { links, menus, cta };
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

  const isActive = (path, exact = false) => (
    exact ? location.pathname === path : (location.pathname === path || location.pathname.startsWith(path + '/'))
  );

  const { links, menus, cta } = buildNav(user);

  // The mobile panel keeps every destination flat so nothing hides behind a tap.
  const mobileItems = [
    ...links.map(l => ({ to: l.to, label: l.label, exact: l.exact })),
    ...menus.flatMap(m => m.items.map(i => ({ to: i.to, label: i.label }))),
    ...(cta ? [{ to: cta.to, label: `+ ${cta.label}` }] : []),
  ];

  return (
    <header className={`inst-header${user ? ' is-authed' : ''}`}>
      <div className="container nav-bar">
        {/* Brand */}
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <div className="brand-logo-container" style={{ padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
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

        {/* Hamburger toggle — narrow layouts only */}
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
            {links.map(l => (
              <li key={l.to}>
                <Link to={l.to} className={isActive(l.to, l.exact) ? 'active' : ''}>{l.label}</Link>
              </li>
            ))}

            {menus.map(m => (
              <li key={m.label}>
                <NavMenu label={m.label} items={m.items} isActive={isActive} />
              </li>
            ))}

            {cta && (
              <li>
                <Link to={cta.to} className="btn btn-emerald btn-sm" style={{ textDecoration: 'none' }}>+ {cta.label}</Link>
              </li>
            )}

            {!user ? (
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <DarkModeToggle />
                <div style={{ position: 'relative' }} className="login-dropdown-wrapper">
                  <LoginDropdown />
                </div>
              </li>
            ) : (
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <DarkModeToggle />
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
          {mobileItems.map(item => (
            <li key={item.to}>
              <Link to={item.to} className={isActive(item.to, item.exact) ? 'active' : ''}>{item.label}</Link>
            </li>
          ))}

          {!user ? (
            <li className="mobile-nav-auth">
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Select your role</div>
              <Link to="/auth/student/login" className="btn btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Student</Link>
              <Link to="/faculty/login" className="btn btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Faculty</Link>
              <Link to="/admin/login" className="btn btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Admin</Link>
              <Link to="/super-admin/login" className="btn btn-primary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>Super Admin</Link>
            </li>
          ) : (
            <>
              <li className="mobile-nav-auth">
                <button onClick={() => { logout(); setMenuOpen(false); }} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  <LogOut size={14} /> Logout ({user.name || user.role})
                </button>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
