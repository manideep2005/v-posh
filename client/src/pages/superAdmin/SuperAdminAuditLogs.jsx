import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate } from '../../utils/api';
import { Activity, Search, Filter } from 'lucide-react';

export default function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    action: 'ALL',
    actorRole: 'ALL',
    search: '',
    page: 1
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(filters).toString();
      const res = await apiFetch(`/super-admin/audit-logs?${q}`);
      if (res.success) {
        setLogs(res.logs);
        setTotal(res.total);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
          Statutory Audit Trail Repository
        </h1>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Immutable log of all administrative actions, status modifications, access events, and system changes
        </p>
      </div>

      {/* Filters */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="search" style={{ fontSize: '0.75rem' }}>Search Actor / Details</label>
            <input
              id="search"
              type="text"
              className="form-control"
              placeholder="Search by actor name or action detail..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="actorRole" style={{ fontSize: '0.75rem' }}>Actor Role</label>
            <select
              id="actorRole"
              className="form-control"
              value={filters.actorRole}
              onChange={(e) => setFilters({ ...filters, actorRole: e.target.value, page: 1 })}
            >
              <option value="ALL">All Roles</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="action" style={{ fontSize: '0.75rem' }}>Action Type</label>
            <select
              id="action"
              className="form-control"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            >
              <option value="ALL">All Actions</option>
              <option value="COMPLAINT_SUBMITTED">COMPLAINT_SUBMITTED</option>
              <option value="COMPLAINT_STATUS_UPDATED">COMPLAINT_STATUS_UPDATED</option>
              <option value="PUBLIC_UPDATE_ADDED">PUBLIC_UPDATE_ADDED</option>
              <option value="INTERNAL_NOTE_ADDED">INTERNAL_NOTE_ADDED</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="ADMIN_ACCOUNT_CREATED">ADMIN_ACCOUNT_CREATED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="panel">
        <div className="panel-header">
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-navy-900)' }}>
            Total Recorded Audit Entries: <strong>{total}</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading audit entries...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action Event</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Target Record ID</th>
                  <th>Audit Detail Narrative</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDate(log.createdAt)}</td>
                    <td style={{ fontWeight: '700', color: 'var(--color-navy-900)', fontSize: '0.8125rem' }}>{log.action}</td>
                    <td>{log.actorName}</td>
                    <td><span className="role-badge" style={{ fontSize: '0.7rem' }}>{log.actorRole}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{log.targetId}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{log.details}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>{log.ipAddress}</td>
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
