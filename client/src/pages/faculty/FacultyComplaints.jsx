import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { FileText, Search, Filter } from 'lucide-react';

export default function FacultyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchComplaints(); }, [statusFilter, search]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await apiFetch(`/faculty/complaints?${params.toString()}`);
      if (res.success) {
        setComplaints(res.complaints);
        setTotal(res.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={22} /> Department Complaints ({total})
        </h1>
        <Link to="/faculty/complaints/new" className="btn btn-emerald btn-sm">+ File Complaint</Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate-400)' }} />
          <input type="text" className="form-control" placeholder="Search complaints..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px', fontSize: '0.8125rem' }} />
        </div>
        <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '180px', fontSize: '0.8125rem' }}>
          <option value="ALL">All Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Acknowledged">Acknowledged</option>
          <option value="Under Review">Under Review</option>
          <option value="Investigation">Investigation</option>
          <option value="Action Taken">Action Taken</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-slate-500)' }}>Loading complaints...</div>
      ) : complaints.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <FileText size={32} style={{ color: 'var(--color-slate-300)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--color-slate-500)' }}>No complaints found.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference ID</th>
                  <th>Title</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/faculty/complaints/${c.id}`} style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>
                        {c.referenceId}
                      </Link>
                    </td>
                    <td style={{ fontSize: '0.8125rem', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{c.studentName}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <span className={`badge badge-${c.priority === 'Urgent' ? 'submitted' : c.priority === 'High' ? 'acknowledged' : 'under-review'}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{formatDate(c.createdAt)}</td>
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
