import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { FileText, Search, ArrowRight, AlertCircle, X } from 'lucide-react';

const STATUSES = ['Submitted', 'Acknowledged', 'Under Review', 'Investigation', 'Action Taken', 'Resolved'];

// The faculty API returns `studentName` that may already contain the roll number.
function displayName(studentName, rollNo) {
  const name = (studentName || '').trim();
  if (!rollNo) return name;
  return name.replace(rollNo, '').replace(/\s{2,}/g, ' ').trim() || name;
}

export default function FacultyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [total, setTotal] = useState(0);

  // Debounce typing so the list does not refetch on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { fetchComplaints(); }, [statusFilter, search]);

  const fetchComplaints = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await apiFetch(`/faculty/complaints?${params.toString()}`);
      if (res.success) {
        setComplaints(res.complaints || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message || 'Unable to load department complaints.');
    } finally {
      setLoading(false);
    }
  };

  const hasFilters = statusFilter !== 'ALL' || searchInput !== '';

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><FileText size={22} /> Department Complaints</h1>
          <p className="page-sub">
            Every grievance raised by a student of your department, with the ICC's live status.
          </p>
        </div>
        <div className="page-actions">
          <span className="toolbar-meta">{total} case{total === 1 ? '' : 's'}</span>
          <Link to="/faculty/complaints/new" className="btn btn-emerald btn-sm">+ File Complaint</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div className="filter-bar-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="fac-search" className="field-label">Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate-400)' }} />
              <input
                id="fac-search"
                type="text"
                className="form-control"
                placeholder="Reference ID, title or student name"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="fac-status" className="field-label">Status</label>
            <select id="fac-status" className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '1rem' }}
            onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter('ALL'); }}
          >
            <X size={14} /> Clear filters
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
          <div className="loading-state">Loading complaints…</div>
        </div>
      ) : complaints.length === 0 ? (
        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <div className="empty-state">
            <FileText size={30} />
            <strong>{hasFilters ? 'No cases match these filters' : 'No complaints in your department yet'}</strong>
            <p>
              {hasFilters
                ? 'Try a different status or clear the search to see every case.'
                : 'When a student of your department raises a grievance it will be listed here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: '1.25rem', padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th className="hide-sm">Student</th>
                  <th>Status</th>
                  <th className="hide-md">Priority</th>
                  <th className="hide-md">Filed</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id}>
                    <td className="nowrap">
                      <Link to={`/faculty/complaints/${c.id}`} style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>
                        {c.referenceId}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/faculty/complaints/${c.id}`} className="truncate" style={{ display: 'inline-block', fontSize: '0.8125rem', color: 'var(--color-slate-800)' }}>
                        {c.title}
                      </Link>
                      <div className="hide-md" style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' }}>
                        {c.studentDept}
                      </div>
                    </td>
                    <td className="hide-sm" style={{ fontSize: '0.8125rem' }}>
                      {displayName(c.studentName, c.studentRollNo)}
                      {c.studentRollNo && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)' }}>{c.studentRollNo}</div>
                      )}
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="hide-md">
                      <span className={`badge badge-${c.priority === 'Urgent' || c.priority === 'High' ? 'submitted' : 'acknowledged'}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="hide-md nowrap" style={{ fontSize: '0.8125rem' }}>{formatDate(c.createdAt)}</td>
                    <td>
                      <Link to={`/faculty/complaints/${c.id}`} aria-label={`Open ${c.referenceId}`} style={{ display: 'inline-flex' }}>
                        <ArrowRight size={15} style={{ color: 'var(--color-slate-400)' }} />
                      </Link>
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
