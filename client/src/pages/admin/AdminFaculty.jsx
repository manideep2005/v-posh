import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { UserPlus, UserCheck, UserX, Search, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', employeeId: '', department: '', designation: 'Faculty Advisor' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchFaculty(); }, [search]);

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch(`/admin/faculty${params}`);
      if (res.success) setFaculty(res.faculty);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setSubmitting(true);
    try {
      const res = await apiFetch('/admin/faculty', { method: 'POST', body: JSON.stringify(form) });
      if (res.success) {
        setMsg(res.message);
        setShowModal(false);
        setForm({ name: '', email: '', password: '', employeeId: '', department: '', designation: 'Faculty Advisor' });
        fetchFaculty();
      }
    } catch (e) {
      setErr(e.message || 'Failed to create faculty.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await apiFetch(`/admin/faculty/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      if (res.success) fetchFaculty();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>Faculty Management</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-emerald"><UserPlus size={16} /> Add Faculty</button>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {msg}</div>}
      {err && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {err}</div>}

      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate-400)' }} />
        <input type="text" className="form-control" placeholder="Search faculty..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px', fontSize: '0.8125rem' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-slate-500)' }}>Loading...</div>
      ) : faculty.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-slate-500)' }}>No faculty members found.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Dept Complaints</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: '600' }}>{f.name}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{f.email}</td>
                    <td>{f.department}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{f.designation || 'Faculty Advisor'}</td>
                    <td><span className="badge badge-submitted">{f.departmentComplaintCount || 0}</span></td>
                    <td><span className={`badge ${f.status === 'active' ? 'badge-resolved' : 'badge-submitted'}`}>{f.status}</span></td>
                    <td>
                      <button onClick={() => handleToggle(f.id, f.status)} className={`btn ${f.status === 'active' ? 'btn-danger' : 'btn-emerald'} btn-sm`}>
                        {f.status === 'active' ? <><UserX size={13} /> Disable</> : <><UserCheck size={13} /> Enable</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>Add Faculty Member</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name <span className="required">*</span></label>
                  <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Email <span className="required">*</span></label>
                    <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Password <span className="required">*</span></label>
                    <input type="password" className="form-control" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Department <span className="required">*</span></label>
                    <select className="form-control" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required>
                      <option value="">Select...</option>
                      <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                      <option value="Electronics & Communication">Electronics & Communication</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                      <option value="Electrical Engineering">Electrical Engineering</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Biotechnology">Biotechnology</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Humanities & Social Sciences">Humanities & Social Sciences</option>
                      <option value="Business Studies">Business Studies</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <input type="text" className="form-control" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-emerald" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
