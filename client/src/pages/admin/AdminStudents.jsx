import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Search, UserCheck, UserX, Users, AlertCircle } from 'lucide-react';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Debounce the free-text search so typing does not fire a request per keystroke
  const [appliedSearch, setAppliedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchStudents();
  }, [appliedSearch, deptFilter]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search: appliedSearch, department: deptFilter }).toString();
      const res = await apiFetch(`/admin/students?${q}`);
      if (res.success) {
        setStudents(res.students || []);
        setErr('');
      }
    } catch (error) {
      setErr(error.message || 'Failed to load the student directory.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await apiFetch(`/admin/students/${studentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        fetchStudents();
      }
    } catch (error) {
      setErr(error.message || 'Status toggle failed.');
    }
  };

  const activeCount = students.filter(s => s.status === 'active').length;

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><Users size={22} /> Student Directory</h1>
          <p className="page-sub">
            Authorized student account listing with registered grievance counts and account status.
          </p>
        </div>
        <span className="toolbar-meta">
          {students.length} record{students.length === 1 ? '' : 's'} • {activeCount} active
        </span>
      </div>

      {err && (
        <div className="alert alert-danger">
          <AlertCircle size={16} /> <span>{err}</span>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div className="filter-bar-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="student-search">Search name, roll number or email</label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--color-slate-400)', pointerEvents: 'none',
                }}
              />
              <input
                id="student-search"
                type="text"
                className="form-control"
                style={{ paddingLeft: '2rem' }}
                placeholder="Search by name, roll number or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="deptFilter">Department</label>
            <select
              id="deptFilter"
              className="form-control"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="ALL">All departments</option>
              <option value="Computer Science & Engineering">Computer Science</option>
              <option value="Electronics & Communication">Electronics</option>
              <option value="Mechanical Engineering">Mechanical</option>
              <option value="Civil Engineering">Civil</option>
              <option value="Management Studies">Management</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student list */}
      <div className="panel">
        {loading ? (
          <div className="loading-block"><span className="spinner" /> Loading student records…</div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <strong>No student records match your query</strong>
            <p>Try a different name, roll number or department.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="hide-sm">Institutional email</th>
                  <th className="hide-md">Department</th>
                  <th className="hide-lg">Year</th>
                  <th>Grievances</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-strong">{s.name}</span>
                        <span className="cell-mono">{s.studentId || 'No roll number'}</span>
                      </div>
                    </td>
                    <td className="hide-sm">
                      <span className="truncate truncate-sm" title={s.email}>{s.email}</span>
                    </td>
                    <td className="hide-md">
                      <span className="truncate truncate-sm" title={s.department}>{s.department || '—'}</span>
                    </td>
                    <td className="hide-lg">{s.year || '—'}</td>
                    <td>
                      <span className={`chip ${s.complaintCount > 0 ? 'chip-blue' : 'chip-slate'}`}>
                        {s.complaintCount || 0} {(s.complaintCount || 0) === 1 ? 'complaint' : 'complaints'}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${s.status === 'active' ? 'chip-emerald' : 'chip-slate'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(s.id, s.status)}
                        className={`btn ${s.status === 'active' ? 'btn-danger' : 'btn-emerald'} btn-sm`}
                        title={s.status === 'active' ? 'Deactivate account' : 'Activate account'}
                      >
                        {s.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                        {s.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
