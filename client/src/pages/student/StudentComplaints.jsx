import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, formatDate } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';
import { FileText, Plus, FileSearch } from 'lucide-react';

export default function StudentComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const res = await apiFetch('/student/complaints');
      if (res.success) {
        setComplaints(res.complaints);
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading your registered complaints...</div>;
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
            My Submitted Complaints
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            List of all confidential grievances registered under your student profile
          </p>
        </div>
        <Link to="/student/complaints/new" className="btn btn-emerald">
          <Plus size={16} /> Raise New Complaint
        </Link>
      </div>

      <div className="panel">
        {complaints.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-slate-600)' }}>
            <FileSearch size={40} color="var(--color-slate-400)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-navy-900)', marginBottom: '0.5rem' }}>No Complaints Registered</h3>
            <p style={{ fontSize: '0.875rem' }}>You currently have zero active or archived complaints registered.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference ID</th>
                  <th>Title / Summary</th>
                  <th>Category</th>
                  <th>Incident Date</th>
                  <th>Submitted On</th>
                  <th>Current Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontFamily: 'monospace' }}>
                      {c.referenceId}
                    </td>
                    <td style={{ fontWeight: '600', color: 'var(--color-slate-800)' }}>
                      {c.title}
                    </td>
                    <td>{c.category}</td>
                    <td>{c.incidentDate}</td>
                    <td>{formatDate(c.createdAt)}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <Link to={`/student/complaints/${c.id}`} className="btn btn-secondary btn-sm">
                        Track Timeline
                      </Link>
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
