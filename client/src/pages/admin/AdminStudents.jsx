import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate } from '../../utils/api';
import { Search, UserCheck, UserX, Users } from 'lucide-react';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  useEffect(() => {
    fetchStudents();
  }, [search, deptFilter]);

  const fetchStudents = async () => {
    try {
      const q = new URLSearchParams({ search, department: deptFilter }).toString();
      const res = await apiFetch(`/admin/students?${q}`);
      if (res.success) {
        setStudents(res.students);
      }
    } catch (err) {
      console.error('Failed to load students directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await apiFetch(`/admin/students/${studentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.success) {
        fetchStudents();
      }
    } catch (err) {
      alert(err.message || 'Status toggle failed.');
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
          Student Directory & Records
        </h1>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Authorized student account listing and registered grievance counts
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="search" style={{ fontSize: '0.75rem' }}>Search Student Name / Roll Number / Email</label>
            <input
              id="search"
              type="text"
              className="form-control"
              placeholder="Search by student name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="deptFilter" style={{ fontSize: '0.75rem' }}>Filter by Department</label>
            <select
              id="deptFilter"
              className="form-control"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="ALL">All Departments</option>
              <option value="Computer Science & Engineering">Computer Science</option>
              <option value="Electronics & Communication">Electronics</option>
              <option value="Mechanical Engineering">Mechanical</option>
              <option value="Civil Engineering">Civil</option>
              <option value="Management Studies">Management</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student List Table */}
      <div className="panel">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading student records...</div>
        ) : students.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-slate-600)' }}>
            No student records match your query.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll Number / ID</th>
                  <th>Student Name</th>
                  <th>Institutional Email</th>
                  <th>Department</th>
                  <th>Year</th>
                  <th>Registered Grievances</th>
                  <th>Account Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontFamily: 'monospace' }}>
                      {s.studentId || 'N/A'}
                    </td>
                    <td style={{ fontWeight: '600' }}>{s.name}</td>
                    <td>{s.email}</td>
                    <td>{s.department}</td>
                    <td>{s.year || 'N/A'}</td>
                    <td>
                      <span className="badge badge-submitted">
                        {s.complaintCount || 0} Complaint(s)
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'active' ? 'badge-resolved' : 'badge-submitted'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(s.id, s.status)}
                        className={`btn ${s.status === 'active' ? 'btn-danger' : 'btn-emerald'} btn-sm`}
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
