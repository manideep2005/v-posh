import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Users, Search } from 'lucide-react';

export default function FacultyStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchStudents(); }, [search]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch(`/faculty/students${params}`);
      if (res.success) setStudents(res.students);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Users size={22} /> Department Students ({students.length})
      </h1>

      <div style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: '400px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate-400)' }} />
        <input type="text" className="form-control" placeholder="Search by name, email, or roll number..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px', fontSize: '0.8125rem' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-slate-500)' }}>Loading students...</div>
      ) : students.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-slate-500)' }}>No students found in your department.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Year</th>
                  <th>Phone</th>
                  <th>Complaints</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.8125rem' }}>{s.studentId || 'N/A'}</td>
                    <td style={{ fontWeight: '600' }}>{s.name}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{s.email}</td>
                    <td>{s.year || 'N/A'}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{s.phone || 'N/A'}</td>
                    <td><span className="badge badge-submitted">{s.complaintCount || 0}</span></td>
                    <td>
                      <span className={`badge ${s.status === 'active' ? 'badge-resolved' : 'badge-submitted'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
