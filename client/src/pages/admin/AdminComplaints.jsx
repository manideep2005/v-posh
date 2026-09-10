import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { Search } from 'lucide-react';

const PAGE_SIZE = 20;

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    status: 'ALL',
    category: 'ALL',
    department: 'ALL',
    priority: 'ALL',
    search: '',
    page: 1
  });

  // Debounce only the free-text search so typing does not fire a request per keystroke
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => (prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchComplaints();
  }, [filters]);

  const fetchComplaints = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams(filters).toString();
      const res = await apiFetch(`/admin/complaints?${query}`);
      if (res.success) {
        setComplaints(res.complaints);
        setTotal(res.total);
      }
    } catch (err) {
      setError(err.message || 'Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value, page: 1 });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (page) => {
    if (page < 1 || page > totalPages || page === filters.page) return;
    setFilters(prev => ({ ...prev, page }));
  };

  const pageNumbers = () => {
    const pages = [];
    const start = Math.max(1, filters.page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
          Complaint Repository
        </h1>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Search, filter, assign, and manage institutional grievance cases
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="search" style={{ fontSize: '0.75rem' }}>Search Reference / Name / Roll No</label>
            <input
              id="search"
              name="search"
              type="text"
              className="form-control"
              placeholder="e.g. POSH-2026 or Student Name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="status" style={{ fontSize: '0.75rem' }}>Status Filter</label>
            <select id="status" name="status" className="form-control" value={filters.status} onChange={handleFilterChange}>
              <option value="ALL">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Acknowledged">Acknowledged</option>
              <option value="Under Review">Under Review</option>
              <option value="Investigation">Investigation</option>
              <option value="Action Taken">Action Taken</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="priority" style={{ fontSize: '0.75rem' }}>Priority Filter</label>
            <select id="priority" name="priority" className="form-control" value={filters.priority} onChange={handleFilterChange}>
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="department" style={{ fontSize: '0.75rem' }}>Department Filter</label>
            <select id="department" name="department" className="form-control" value={filters.department} onChange={handleFilterChange}>
              <option value="ALL">All Departments</option>
              <option value="Computer Science & Engineering">Computer Science</option>
              <option value="Electronics & Communication">Electronics</option>
              <option value="Mechanical Engineering">Mechanical</option>
              <option value="Civil Engineering">Civil</option>
              <option value="Management Studies">Management</option>
              <option value="Humanities & Social Sciences">Humanities & Social Sciences</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger"><span>{error}</span></div>}

      {/* Complaints Data Table */}
      <div className="panel">
        <div className="panel-header">
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-navy-900)' }}>
            Showing <strong>{complaints.length}</strong> of <strong>{total}</strong> records
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-slate-600)' }}>Updating complaints list…</div>
        ) : complaints.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-slate-600)' }}>
            No complaints match the specified filter criteria.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Student & Roll No</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Officer</th>
                  <th>Registered Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontFamily: 'monospace' }}>
                      {c.referenceId}
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--color-slate-900)' }}>{c.studentName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{c.studentRollNo}</div>
                    </td>
                    <td>{c.studentDept}</td>
                    <td style={{ maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.category}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: c.priority === 'Urgent' || c.priority === 'High' ? 'var(--color-crimson-700)' : 'var(--color-slate-700)' }}>
                        {c.priority}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {c.assignedAdminName || <span style={{ color: 'var(--color-slate-400)', fontStyle: 'italic' }}>Unassigned</span>}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{formatDate(c.createdAt)}</td>
                    <td>
                      <Link to={`/admin/complaints/${c.id}`} className="btn btn-primary btn-sm">
                        Open Workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-slate-100)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
              Page {filters.page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => goToPage(filters.page - 1)} disabled={filters.page === 1}>
                Previous
              </button>
              {pageNumbers().map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === filters.page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => goToPage(filters.page + 1)} disabled={filters.page === totalPages}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
