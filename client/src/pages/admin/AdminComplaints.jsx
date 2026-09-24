import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { Search, FileText, ArrowRight, Download, CheckSquare, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 20;

// Some student records store the roll number inside `studentName`
// (e.g. "HASINI PASUNOORI 23MIS7263"). Split it out so the table does not
// print the roll number twice.
function splitStudentName(fullName, rollNo) {
  const name = (fullName || '').trim();
  if (!rollNo) return { displayName: name, rest: '' };
  const displayName = name.replace(rollNo, '').replace(/\s{2,}/g, ' ').trim();
  return { displayName: displayName || name, rest: rollNo };
}

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

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

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === complaints.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(complaints.map(c => c.id))); }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || !selectedIds.size) return;
    setBulkMsg('');
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        const res = await apiFetch(`/admin/complaints/${id}/status`, {
          method: 'PUT', body: JSON.stringify({ status: bulkStatus }),
        });
        if (res.success) ok++; else fail++;
      } catch { fail++; }
    }
    setBulkMsg(`${ok} updated, ${fail} failed.`);
    setSelectedIds(new Set());
    setBulkStatus('');
    fetchComplaints();
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = ['Ref ID','Student','Category','Priority','Status','Assigned Officer','Registered','Deadline'];
    const rows = complaints.map(c => [
      c.referenceId,
      c.studentName || '',
      c.category || '',
      c.priority || '',
      c.status || '',
      c.assignedAdminName || '',
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
      c.slaDeadline ? new Date(c.slaDeadline).toLocaleDateString() : '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `complaints-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><FileText size={22} /> Complaint Repository</h1>
          <p className="page-sub">
            Search, filter, assign and manage institutional grievance cases.
          </p>
        </div>
        <div className="page-actions">
          <span className="toolbar-meta">{total} record{total === 1 ? '' : 's'}</span>
          <button onClick={exportCSV} className="btn btn-secondary btn-sm">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="search" className="field-label">Search Reference / Name / Roll No</label>
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
            <label htmlFor="status" className="field-label">Status Filter</label>
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
            <label htmlFor="priority" className="field-label">Priority Filter</label>
            <select id="priority" name="priority" className="form-control" value={filters.priority} onChange={handleFilterChange}>
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="department" className="field-label">Department Filter</label>
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
          <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
            <FileText size={16} /> Case records
          </h3>
          <span className="toolbar-meta">
            Showing {complaints.length} of {total}
          </span>
        </div>

        {loading ? (
          <div className="loading-block"><span className="spinner" /> Updating complaints list…</div>
        ) : complaints.length === 0 ? (
          <div className="empty-state">
            <Search size={30} />
            <strong>No complaints match these filters</strong>
            <p>Try a different status, priority or department.</p>
          </div>
        ) : (
          <>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--color-emerald-50)', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap' }}>
              <CheckSquare size={15} style={{ color: 'var(--color-emerald-700)' }} />
              <strong style={{ fontSize: '0.8125rem', color: 'var(--color-emerald-900)' }}>{selectedIds.size} selected</strong>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="form-control" style={{ width: 160, padding: '0.35rem 0.5rem', fontSize: '0.8125rem' }}>
                <option value="">Bulk status…</option>
                <option value="Submitted">Submitted</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Under Review">Under Review</option>
                <option value="Resolved">Resolved</option>
              </select>
              <button onClick={handleBulkStatus} disabled={!bulkStatus} className="btn btn-emerald btn-sm">
                <RefreshCw size={13} /> Apply
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="btn btn-secondary btn-sm">Clear</button>
              {bulkMsg && <span style={{ fontSize: '0.75rem', color: 'var(--color-emerald-700)' }}>{bulkMsg}</span>}
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36, padding: '0.5rem' }}>
                    <input type="checkbox" checked={selectedIds.size === complaints.length && complaints.length > 0} onChange={toggleSelectAll} aria-label="Select all" style={{ accentColor: 'var(--color-emerald-700)' }} />
                  </th>
                  <th className="nowrap">Ref ID</th>
                  <th>Student</th>
                  <th className="hide-xl">Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th className="hide-lg">Assigned officer</th>
                  <th className="hide-md">Deadline</th>
                  <th className="hide-md nowrap">Registered</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => {
                  const { displayName, rest } = splitStudentName(c.studentName, c.studentRollNo);
                  return (
                  <tr key={c.id}>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} aria-label={`Select ${c.referenceId}`} style={{ accentColor: 'var(--color-emerald-700)' }} />
                    </td>
                    <td className="cell-mono nowrap" style={{ color: 'var(--color-navy-900)', fontWeight: 600 }}>
                      {c.referenceId}
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-strong">{displayName}</span>
                        <span className="cell-muted truncate" style={{ maxWidth: '210px' }} title={`${rest} • ${c.studentDept || ''}`}>
                          {rest}{c.studentDept ? ` • ${c.studentDept}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="hide-xl">
                      <span className="truncate" style={{ maxWidth: '150px' }} title={c.category}>{c.category}</span>
                    </td>
                    <td>
                      <span className={`chip ${c.priority === 'Urgent' ? 'chip-crimson' : c.priority === 'High' ? 'chip-amber' : 'chip-slate'}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="hide-lg">
                      {c.assignedAdminName
                        ? <span className="truncate" style={{ maxWidth: '150px' }} title={c.assignedAdminName}>{c.assignedAdminName}</span>
                        : <span className="chip chip-slate">Unassigned</span>}
                    </td>
                    <td className="hide-md">
                      {c.compliance ? (
                        <span
                          className={`chip ${c.compliance.state === 'overdue' ? 'chip-crimson' : c.compliance.state === 'due-soon' ? 'chip-amber' : c.compliance.state === 'closed' ? 'chip-slate' : 'chip-emerald'}`}
                          title={c.compliance.nextDue ? `Next: ${c.compliance.nextDue.label} — ${formatDate(c.compliance.nextDue.dueAt)}` : 'All statutory deadlines met'}
                        >
                          {c.compliance.state === 'overdue'
                            ? `${c.compliance.overdueCount} missed`
                            : c.compliance.state === 'due-soon'
                              ? 'Due soon'
                              : c.compliance.state === 'closed'
                                ? 'Closed'
                                : 'On track'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="hide-md nowrap cell-muted">{formatDate(c.createdAt)}</td>
                    <td>
                      <Link to={`/admin/complaints/${c.id}`} className="btn btn-primary btn-sm" title="Open case workspace">
                        Open <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Page {filters.page} of {totalPages} • {total} record{total === 1 ? '' : 's'}
            </span>
            <div className="pagination-controls">
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
