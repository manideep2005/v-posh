import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import {
  UserPlus, UserCheck, UserX, Search, CheckCircle2, AlertCircle, Loader2,
  Users, X, GraduationCap, Building2, RefreshCw,
} from 'lucide-react';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Information Technology',
  'Biotechnology',
  'Physics',
  'Chemistry',
  'Mathematics',
  'Humanities & Social Sciences',
  'Business Studies',
];

const EMPTY_FORM = { name: '', email: '', password: '', employeeId: '', department: '', designation: 'Faculty Advisor' };

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [rowError, setRowError] = useState({ id: null, message: '' });
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const firstLoad = useRef(true);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { fetchFaculty(); }, [search]);

  const fetchFaculty = async () => {
    if (firstLoad.current) setLoading(true); else setRefreshing(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch(`/admin/faculty${params}`);
      if (res.success) setFaculty(res.faculty || []);
      else setErr(res.message || 'Failed to load faculty.');
    } catch (e) {
      setErr(e.message || 'Failed to load faculty.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoad.current = false;
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setSubmitting(true);
    try {
      const res = await apiFetch('/admin/faculty', { method: 'POST', body: JSON.stringify(form) });
      if (res.success) {
        setMsg(res.message || 'Faculty account created.');
        setShowModal(false);
        setForm(EMPTY_FORM);
        fetchFaculty();
      } else {
        setErr(res.message || 'Failed to create faculty.');
      }
    } catch (e) {
      setErr(e.message || 'Failed to create faculty.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    setRowError({ id: null, message: '' });
    setMsg('');
    setBusyId(id);
    try {
      const res = await apiFetch(`/admin/faculty/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setFaculty(prev => prev.map(f => (f.id === id ? { ...f, status: newStatus } : f)));
        setMsg(`Account ${newStatus === 'active' ? 'enabled' : 'disabled'}.`);
      } else {
        setRowError({ id, message: res.message || 'Update failed.' });
      }
    } catch (e) {
      setRowError({ id, message: e.message || 'Update failed.' });
    } finally {
      setBusyId(null);
    }
  };

  const visible = statusFilter === 'all'
    ? faculty
    : faculty.filter(f => (f.status || 'active') === statusFilter);

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><GraduationCap size={22} /> Faculty management</h1>
          <p className="page-sub">
            Faculty accounts can be linked to cases as advisors or witnesses. Disabling an account
            blocks sign-in immediately but never removes its history from the audit trail.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={fetchFaculty} disabled={refreshing}>
            {refreshing ? <Loader2 size={15} className="spin-icon" /> : <RefreshCw size={15} />} Refresh
          </button>
          <button className="btn btn-emerald" onClick={() => setShowModal(true)}>
            <UserPlus size={16} /> Add faculty
          </button>
        </div>
      </div>

      {msg && <div className="alert alert-success"><CheckCircle2 size={16} /><span>{msg}</span></div>}
      {err && <div className="alert alert-danger"><AlertCircle size={16} /><span>{err}</span></div>}

      <div className="panel">
        <div className="toolbar" style={{ marginBottom: '1.25rem' }}>
          <div className="filter-bar-2" style={{ flex: '1 1 420px' }}>
            <div>
              <label className="field-label" htmlFor="fac-search">Search</label>
              <div className="input-icon">
                <Search size={15} />
                <input
                  id="fac-search"
                  type="text"
                  className="form-control"
                  placeholder="Name, email or employee ID…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="fac-status">Status</label>
              <select
                id="fac-status"
                className="form-control"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All accounts</option>
                <option value="active">Active only</option>
                <option value="disabled">Disabled only</option>
              </select>
            </div>
          </div>
          <span className="toolbar-meta">
            {visible.length} of {faculty.length} {faculty.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        {loading ? (
          <div className="loading-block"><span className="spinner" /> Loading faculty directory…</div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <Users size={30} />
            <strong>{faculty.length ? 'No accounts match these filters' : 'No faculty accounts yet'}</strong>
            <p>
              {faculty.length
                ? 'Clear the search or switch the status filter to see the rest of the directory.'
                : 'Add a faculty account so the ICC can associate staff with a case.'}
            </p>
            {!faculty.length && (
              <button className="btn btn-emerald" onClick={() => setShowModal(true)}>
                <UserPlus size={15} /> Add faculty
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="hide-md">Department</th>
                  <th className="hide-sm">Designation</th>
                  <th className="num">Cases</th>
                  <th>Status</th>
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-strong truncate" style={{ maxWidth: '230px' }}>{f.name}</span>
                        <span className="cell-muted truncate" style={{ maxWidth: '230px' }}>{f.email}</span>
                        {rowError.id === f.id && (
                          <span className="cell-error"><AlertCircle size={12} /> {rowError.message}</span>
                        )}
                      </div>
                    </td>
                    <td className="hide-md">
                      <span className="truncate" style={{ display: 'inline-block', maxWidth: '190px' }}>
                        {f.department || '—'}
                      </span>
                    </td>
                    <td className="hide-sm">{f.designation || 'Faculty Advisor'}</td>
                    <td className="num">{f.departmentComplaintCount || 0}</td>
                    <td>
                      <span className={`badge ${f.status === 'active' ? 'badge-resolved' : 'badge-submitted'}`}>
                        {f.status || 'active'}
                      </span>
                    </td>
                    <td className="num">
                      <button
                        onClick={() => handleToggle(f.id, f.status)}
                        disabled={busyId === f.id}
                        className={`btn ${f.status === 'active' ? 'btn-danger' : 'btn-emerald'} btn-sm`}
                      >
                        {busyId === f.id
                          ? <Loader2 size={13} className="spin-icon" />
                          : f.status === 'active'
                            ? <><UserX size={13} /> Disable</>
                            : <><UserCheck size={13} /> Enable</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><UserPlus size={18} /> Add faculty member</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm" aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="f-name">Full name <span className="required">*</span></label>
                  <input id="f-name" type="text" className="form-control" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="f-email">Institutional email <span className="required">*</span></label>
                    <input id="f-email" type="email" className="form-control" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="f-emp">Employee ID</label>
                    <input id="f-emp" type="text" className="form-control" value={form.employeeId}
                      onChange={e => setForm({ ...form, employeeId: e.target.value })} />
                  </div>
                </div>
                <div className="grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="f-dept">Department <span className="required">*</span></label>
                    <select id="f-dept" className="form-control" value={form.department}
                      onChange={e => setForm({ ...form, department: e.target.value })} required>
                      <option value="">Select…</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="f-desig">Designation</label>
                    <input id="f-desig" type="text" className="form-control" value={form.designation}
                      onChange={e => setForm({ ...form, designation: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="f-pass">Temporary password <span className="required">*</span></label>
                  <input id="f-pass" type="password" className="form-control" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
                  <span className="field-hint">
                    At least 8 characters. The member should change it after the first sign-in.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-emerald" disabled={submitting}>
                  {submitting ? <><Loader2 size={15} className="spin-icon" /> Creating…</> : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
