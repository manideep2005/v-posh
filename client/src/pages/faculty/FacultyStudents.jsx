import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Users, Search, AlertCircle, X } from 'lucide-react';

export default function FacultyStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce so the directory does not query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { fetchStudents(); }, [search]);

  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch(`/faculty/students${params}`);
      if (res.success) setStudents(res.students || []);
    } catch (err) {
      setError(err.message || 'Unable to load students.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><Users size={22} /> Department Students</h1>
          <p className="page-sub">Students you can raise a complaint on behalf of, and their case counts.</p>
        </div>
        <span className="toolbar-meta">{students.length} student{students.length === 1 ? '' : 's'}</span>
      </div>

      <div className="panel" style={{ padding: '1.25rem' }}>
        <div className="form-group" style={{ marginBottom: 0, maxWidth: '440px' }}>
          <label htmlFor="stu-search" className="field-label">Search</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate-400)' }} />
            <input
              id="stu-search"
              type="text"
              className="form-control"
              placeholder="Name, email or roll number"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
          </div>
        </div>
        {searchInput && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={() => setSearchInput('')}>
            <X size={14} /> Clear search
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ margin: '1.25rem 0 0' }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <div className="loading-state">Loading students…</div>
        </div>
      ) : students.length === 0 ? (
        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <div className="empty-state">
            <Users size={30} />
            <strong>{search ? 'No students match that search' : 'No students in your department yet'}</strong>
            <p>Student accounts are provisioned by the administration for your department.</p>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: '1.25rem', padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th className="hide-md">Email</th>
                  <th className="hide-sm">Year</th>
                  <th className="hide-lg">Phone</th>
                  <th className="num">Cases</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td className="nowrap" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem' }}>
                      {s.studentId || '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <span className="truncate" style={{ display: 'inline-block' }}>{s.name}</span>
                      <div className="hide-md" style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--color-slate-500)' }}>{s.email}</div>
                    </td>
                    <td className="hide-md truncate" style={{ fontSize: '0.8125rem' }}>{s.email}</td>
                    <td className="hide-sm" style={{ fontSize: '0.8125rem' }}>{s.year || '—'}</td>
                    <td className="hide-lg nowrap" style={{ fontSize: '0.8125rem' }}>{s.phone || '—'}</td>
                    <td className="num">
                      <span className={`badge ${s.complaintCount ? 'badge-submitted' : 'badge-resolved'}`}>{s.complaintCount || 0}</span>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'active' ? 'badge-resolved' : 'badge-submitted'}`}>{s.status}</span>
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
