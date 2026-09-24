import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../utils/api';
import {
  UserPlus, UserCheck, UserX, Users, Search, AlertCircle, CheckCircle2, X,
} from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  employeeId: '',
  department: 'Computer Science & Engineering',
  designation: 'ICC Committee Member',
};

const roleChipClass = {
  student: 'chip-violet',
  faculty: 'chip-blue',
  admin: 'chip-emerald',
  super_admin: 'chip-crimson',
};

const roleLabels = { student: 'Student', faculty: 'Faculty', admin: 'ICC Admin', super_admin: 'Super Admin' };

export default function SuperAdminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await apiFetch('/super-admin/admins?includeAll=true');
      if (res.success) {
        setAdmins(res.admins || []);
      } else {
        setErr(res.message || 'Failed to load administrative staff.');
      }
    } catch (e) {
      setErr(e.message || 'Failed to fetch administrative staff.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setSubmitting(true);

    try {
      const res = await apiFetch('/super-admin/admins', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.success) {
        setMsg(res.message);
        setShowModal(false);
        setForm(EMPTY_FORM);
        fetchAdmins();
      }
    } catch (e) {
      setErr(e.message || 'Failed to create admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    if (!confirm(`Change ${userName}'s role to ${roleLabels[newRole] || newRole}?`)) return;
    setMsg('');
    setErr('');
    try {
      const res = await apiFetch(`/super-admin/admins/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      if (res.success) {
        setMsg(res.message);
        fetchAdmins();
      }
    } catch (e) {
      setErr(e.message || 'Role change failed.');
    }
  };

  const handleToggleStatus = async (adminId, currentStatus) => {
    setMsg('');
    setErr('');
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await apiFetch(`/super-admin/admins/${adminId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        setMsg(res.message || `Account ${newStatus}.`);
        fetchAdmins();
      }
    } catch (e) {
      setErr(e.message || 'Status update failed.');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admins.filter(a => {
      const matchesRole = roleFilter === 'ALL' || a.role === roleFilter;
      if (!matchesRole) return false;
      if (!q) return true;
      return [a.name, a.email, a.employeeId, a.department, a.designation]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [admins, search, roleFilter]);

  const maxWorkload = Math.max(...admins.map(a => a.activeWorkload || 0), 1);
  const activeCount = admins.filter(a => a.status === 'active').length;

  const workloadTone = (n) => (n > 5 ? 'crimson' : n > 2 ? 'amber' : 'emerald');

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><Users size={22} /> Administrative Staff</h1>
          <p className="page-sub">
            Provision ICC Presiding Officers, external members and system administrators, and adjust
            roles or account status.
          </p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowModal(true)} className="btn btn-emerald btn-sm">
            <UserPlus size={15} /> Provision admin account
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} /> <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="alert alert-danger">
          <AlertCircle size={16} /> <span>{err}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '260px' }}>
            <label className="field-label" htmlFor="staff-search">Search staff</label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--color-slate-400)', pointerEvents: 'none',
                }}
              />
              <input
                id="staff-search"
                type="text"
                className="form-control"
                style={{ paddingLeft: '2rem' }}
                placeholder="Name, email, staff ID, department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="staff-role">Role</label>
            <select
              id="staff-role"
              className="form-control"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All roles</option>
              <option value="admin">ICC Admin</option>
              <option value="faculty">Faculty</option>
              <option value="student">Student</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <span className="toolbar-meta">
          {filtered.length} of {admins.length} accounts • {activeCount} active
        </span>
      </div>

      <div className="panel">
        {loading ? (
          <div className="loading-block"><span className="spinner" /> Loading administrative staff…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <strong>{admins.length === 0 ? 'No staff accounts yet' : 'No accounts match your filters'}</strong>
            <p>
              {admins.length === 0
                ? 'Provision the first ICC administrator to begin assigning grievances.'
                : 'Try a different search term or role filter.'}
            </p>
            {admins.length === 0 && (
              <button onClick={() => setShowModal(true)} className="btn btn-emerald btn-sm" style={{ marginTop: '0.5rem' }}>
                <UserPlus size={14} /> Provision admin account
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="hide-sm">Institutional email</th>
                  <th className="hide-md">Department</th>
                  <th>Role</th>
                  <th>Active workload</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(adm => (
                  <tr key={adm.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-strong">{adm.name}</span>
                        <span className="cell-muted">
                          {adm.designation || 'ICC Member'}
                          {adm.employeeId ? ` • ${adm.employeeId}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="hide-sm">
                      <span className="truncate truncate-sm" title={adm.email}>{adm.email}</span>
                    </td>
                    <td className="hide-md">
                      <span className="truncate truncate-sm" title={adm.department}>{adm.department || '—'}</span>
                    </td>
                    <td>
                      <span className={`chip ${roleChipClass[adm.role] || 'chip-slate'}`}>
                        {roleLabels[adm.role] || adm.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '110px' }}>
                        <span className="meter" style={{ width: 56 }}>
                          <span
                            className={`meter-fill meter-${workloadTone(adm.activeWorkload || 0)}`}
                            style={{ display: 'block', width: `${Math.max(((adm.activeWorkload || 0) / maxWorkload) * 100, adm.activeWorkload ? 8 : 0)}%` }}
                          />
                        </span>
                        <span className="dist-count">{adm.activeWorkload || 0}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${adm.status === 'active' ? 'chip-emerald' : 'chip-slate'}`}>
                        {adm.status}
                      </span>
                    </td>
                    <td>
                      {adm.role !== 'super_admin' ? (
                        <div className="cell-actions">
                          <select
                            aria-label={`Change role for ${adm.name}`}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) handleRoleChange(adm.id, e.target.value, adm.name);
                              e.target.value = '';
                            }}
                            className="control-sm"
                          >
                            <option value="" disabled>Change role…</option>
                            {adm.role !== 'student' && <option value="student">Student</option>}
                            {adm.role !== 'faculty' && <option value="faculty">Faculty</option>}
                            {adm.role !== 'admin' && <option value="admin">ICC Admin</option>}
                            <option value="super_admin">Super Admin</option>
                          </select>
                          <button
                            onClick={() => handleToggleStatus(adm.id, adm.status)}
                            className={`btn ${adm.status === 'active' ? 'btn-danger' : 'btn-emerald'} btn-sm`}
                            title={adm.status === 'active' ? 'Disable account' : 'Enable account'}
                          >
                            {adm.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span className="cell-muted">Owner account</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision Admin Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
                Provision authorized admin account
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm" aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dr. Meera Deshmukh"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Staff / employee ID <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. EMP-ADM-103"
                      value={form.employeeId}
                      onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Institutional email <span className="required">*</span></label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. member@vitap.ac.in"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Designation / role in ICC</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. ICC Committee Member"
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Initial secure password <span className="required">*</span></label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <p className="form-hint">
                    Share this with the member over a secure channel. They should change it after first sign-in.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-emerald" disabled={submitting}>
                  {submitting ? 'Provisioning…' : 'Provision admin account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
