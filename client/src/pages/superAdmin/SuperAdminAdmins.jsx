import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate } from '../../utils/api';
import { UserPlus, UserCheck, UserX, Shield, KeyRound, AlertCircle, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';

export default function SuperAdminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    department: 'Computer Science & Engineering',
    designation: 'ICC Committee Member'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await apiFetch('/super-admin/admins?includeAll=true');
      if (res.success) {
        setAdmins(res.admins);
      }
    } catch (e) {
      console.error('Failed to fetch admins:', e);
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
        body: JSON.stringify(form)
      });
      if (res.success) {
        setMsg(res.message);
        setShowModal(false);
        setForm({
          name: '',
          email: '',
          password: '',
          employeeId: '',
          department: 'Computer Science & Engineering',
          designation: 'ICC Committee Member'
        });
        fetchAdmins();
      }
    } catch (e) {
      setErr(e.message || 'Failed to create admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    const roleLabels = { student: 'Student', faculty: 'Faculty', admin: 'Admin', super_admin: 'Super Admin' };
    if (!confirm(`Change ${userName}'s role to ${roleLabels[newRole]}?`)) return;
    try {
      const res = await apiFetch(`/super-admin/admins/${userId}/role`, {
        method: 'PUT', body: JSON.stringify({ role: newRole })
      });
      if (res.success) {
        setMsg(res.message);
        fetchAdmins();
      }
    } catch (e) { alert(e.message || 'Role change failed.'); }
  };

  const handleToggleStatus = async (adminId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await apiFetch(`/super-admin/admins/${adminId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.success) {
        fetchAdmins();
      }
    } catch (e) {
      alert(e.message || 'Status update failed.');
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            Administrative Staff Management
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Provision authorized ICC Presiding Officers, External Members, and System Administrators
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-emerald">
          <UserPlus size={16} /> Provision New Admin Account
        </button>
      </div>

      {msg && <div className="alert alert-success"><CheckCircle2 size={16} /> <span>{msg}</span></div>}
      {err && <div className="alert alert-danger"><AlertCircle size={16} /> <span>{err}</span></div>}

      <div className="panel">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading administrative staff list...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Name & Designation</th>
                  <th>Institutional Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Active Workload</th>
                  <th>Account Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(adm => (
                  <tr key={adm.id}>
                    <td style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontFamily: 'monospace' }}>
                      {adm.employeeId || 'N/A'}
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--color-slate-900)' }}>{adm.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{adm.designation || 'ICC Member'}</div>
                    </td>
                    <td>{adm.email}</td>
                    <td>{adm.department}</td>
                    <td>
                      <span className="role-badge" style={{
                        backgroundColor: adm.role === 'super_admin' ? 'var(--color-emerald-700)' : adm.role === 'admin' ? 'var(--color-navy-700)' : adm.role === 'faculty' ? '#3B82F6' : '#6366F1'
                      }}>
                        {adm.role}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-submitted">
                        {adm.activeWorkload || 0} Active
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${adm.status === 'active' ? 'badge-resolved' : 'badge-submitted'}`}>
                        {adm.status}
                      </span>
                    </td>
                    <td>
                      {adm.role !== 'super_admin' ? (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) handleRoleChange(adm.id, e.target.value, adm.name); e.target.value = ''; }}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-slate-300)', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}
                          >
                            <option value="" disabled>Change role…</option>
                            {adm.role !== 'student' && <option value="student">↓ Student</option>}
                            {adm.role !== 'faculty' && <option value="faculty">→ Faculty</option>}
                            {adm.role !== 'admin' && <option value="admin">↑ Admin</option>}
                            {adm.role !== 'super_admin' && <option value="super_admin">⭐ Super Admin</option>}
                          </select>
                          <button
                            onClick={() => handleToggleStatus(adm.id, adm.status)}
                            className={`btn ${adm.status === 'active' ? 'btn-danger' : 'btn-emerald'} btn-sm`}
                            title={adm.status === 'active' ? 'Disable' : 'Enable'}
                          >
                            {adm.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>Owner</span>
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
                Provision Authorized Admin Account
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dr. Meera Deshmukh"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Staff / Employee ID <span className="required">*</span></label>
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
                    <label>Institutional Email <span className="required">*</span></label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. member@institution.edu"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                    <label>Designation / Role in ICC</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. ICC Committee Member"
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Initial Secure Password <span className="required">*</span></label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-emerald" disabled={submitting}>
                  {submitting ? 'Provisioning...' : 'Provision Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
