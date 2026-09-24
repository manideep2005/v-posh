import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate, downloadCsv } from '../../utils/api';
import {
  Activity, Search, Filter, X, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck,
  Download, BadgeCheck, AlertTriangle,
} from 'lucide-react';

const LIMIT = 25;

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'All actions' },
  { value: 'COMPLAINT_SUBMITTED', label: 'Complaint submitted' },
  { value: 'COMPLAINT_STATUS_UPDATED', label: 'Status updated' },
  { value: 'COMPLAINT_ASSIGNED', label: 'Complaint assigned' },
  { value: 'COMPLAINT_VIEWED', label: 'Complaint viewed' },
  { value: 'PUBLIC_UPDATE_ADDED', label: 'Public update added' },
  { value: 'INTERNAL_NOTE_ADDED', label: 'Internal note added' },
  { value: 'PDF_GENERATED', label: 'PDF generated' },
  { value: 'USER_LOGIN', label: 'User login' },
  { value: 'ADMIN_ACCOUNT_CREATED', label: 'Admin account created' },
  { value: 'FACULTY_ACCOUNT_CREATED', label: 'Faculty account created' },
  { value: 'ROLE_CHANGED', label: 'Role changed' },
];

const ROLE_OPTIONS = ['ALL', 'student', 'faculty', 'admin', 'super_admin', 'system'];

const roleChipClass = {
  student: 'chip-blue',
  faculty: 'chip-violet',
  admin: 'chip-emerald',
  super_admin: 'chip-crimson',
  system: 'chip-slate',
};

export default function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [action, setAction] = useState('ALL');
  const [actorRole, setActorRole] = useState('ALL');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [ledger, setLedger] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Debounce the free-text search so each keystroke does not hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch(`/super-admin/audit-logs?${buildQuery(true)}`);
        if (cancelled) return;
        if (res.success) {
          setLogs(res.logs || []);
          setTotal(res.total || 0);
        } else {
          setError(res.message || 'Failed to load audit logs.');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load audit logs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [action, actorRole, appliedSearch, page, reloadKey]);

  const buildQuery = (withPaging) => new URLSearchParams({
    action,
    actorRole,
    ...(withPaging ? { page: String(page), limit: String(LIMIT) } : {}),
    ...(appliedSearch ? { search: appliedSearch } : {}),
  }).toString();

  const verifyIntegrity = async () => {
    setVerifying(true);
    setError('');
    try {
      const res = await apiFetch('/super-admin/audit-logs/verify');
      if (res.success) setLedger(res.ledger);
    } catch (e) {
      setError(e.message || 'Failed to verify the audit ledger.');
    } finally {
      setVerifying(false);
    }
  };

  const exportTrail = async () => {
    setExporting(true);
    setError('');
    try {
      await downloadCsv(`/api/super-admin/audit-logs/export?${buildQuery(false)}`, 'VPOSH_Audit_Trail.csv');
    } catch (e) {
      setError(e.message || 'Failed to export the audit trail.');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const rangeStart = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const rangeEnd = Math.min(page * LIMIT, total);
  const hasFilters = action !== 'ALL' || actorRole !== 'ALL' || !!search;

  const clearFilters = () => {
    setAction('ALL');
    setActorRole('ALL');
    setSearch('');
    setAppliedSearch('');
    setPage(1);
  };

  const goTo = (next) => setPage(Math.min(Math.max(next, 1), totalPages));

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><Activity size={22} /> Statutory Audit Trail</h1>
          <p className="page-sub">
            Immutable record of administrative actions, status modifications, access events and
            system changes across the platform.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={() => setReloadKey(k => k + 1)} className="btn btn-secondary btn-sm" disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" onClick={exportTrail} className="btn btn-secondary btn-sm" disabled={exporting}>
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button type="button" onClick={verifyIntegrity} className="btn btn-emerald btn-sm" disabled={verifying}>
            <BadgeCheck size={14} /> {verifying ? 'Checking…' : 'Verify integrity'}
          </button>
        </div>
      </div>

      {/* Ledger integrity result */}
      {ledger && (
        <div className={`alert ${ledger.verified ? 'alert-success' : 'alert-danger'}`}>
          {ledger.verified ? <BadgeCheck size={16} /> : <AlertTriangle size={16} />}
          <span>
            <strong>{ledger.verified ? 'Audit ledger intact.' : 'Audit ledger anomaly detected.'}</strong>{' '}
            {ledger.chainedEntries} of {ledger.totalEntries} entries are hash-chained
            {ledger.unchainedEntries > 0 ? ` (${ledger.unchainedEntries} predate the ledger)` : ''}.
            {ledger.headShort ? ` Chain head ${ledger.headShort}.` : ''}
            {ledger.tampered.length > 0 && ` ${ledger.tampered.length} entr${ledger.tampered.length === 1 ? 'y' : 'ies'} no longer match their recorded hash.`}
            {ledger.forks.length > 0 && ` ${ledger.forks.length} branch point(s) detected — expected when several serverless instances write concurrently.`}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
            <Filter size={16} /> Filter audit entries
          </h3>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        <div className="filter-bar">
          <div className="form-group">
            <label className="field-label" htmlFor="audit-search">Search actor or detail</label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--color-slate-400)', pointerEvents: 'none',
                }}
              />
              <input
                id="audit-search"
                type="text"
                className="form-control"
                style={{ paddingLeft: '2rem' }}
                placeholder="Search by actor name, action or detail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="field-label" htmlFor="audit-role">Actor role</label>
            <select
              id="audit-role"
              className="form-control"
              value={actorRole}
              onChange={(e) => { setActorRole(e.target.value); setPage(1); }}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r === 'ALL' ? 'All roles' : r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="field-label" htmlFor="audit-action">Action type</label>
            <select
              id="audit-action"
              className="form-control"
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
            >
              {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Logs table */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
            <ShieldCheck size={16} /> Audit entries
          </h3>
          <span className="toolbar-meta">
            {total.toLocaleString()} recorded {total === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><span>{error}</span></div>}

        {loading ? (
          <div className="loading-block"><span className="spinner" /> Loading audit entries…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={32} />
            <strong>No audit entries match these filters</strong>
            <p>Try widening your search, or clear the filters to see the full trail.</p>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="nowrap">Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th className="hide-sm">Target ID</th>
                    <th>Detail narrative</th>
                    <th className="hide-md">IP address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td className="nowrap cell-muted">{formatDate(log.createdAt)}</td>
                      <td className="cell-strong nowrap" style={{ fontSize: '0.8125rem' }}>{log.action}</td>
                      <td>
                        <div className="cell-stack">
                          <span style={{ fontSize: '0.875rem' }}>{log.actorName}</span>
                          <span
                            className={`chip ${roleChipClass[log.actorRole] || 'chip-slate'}`}
                            style={{ alignSelf: 'flex-start' }}
                          >
                            {log.actorRole}
                          </span>
                        </div>
                      </td>
                      <td className="hide-sm">
                        <span className="cell-mono truncate truncate-sm" title={log.targetId}>
                          {log.targetId}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        <span className="clamp-2" style={{ maxWidth: '340px' }} title={log.details}>
                          {log.details}
                        </span>
                      </td>
                      <td className="hide-md cell-muted">{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span className="pagination-info">
                Showing {rangeStart}–{rangeEnd} of {total.toLocaleString()}
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => goTo(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="btn btn-secondary btn-sm page-number" aria-live="polite">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => goTo(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
