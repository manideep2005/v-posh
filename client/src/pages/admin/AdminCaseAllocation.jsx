import React, { useState, useEffect } from 'react';
import { apiFetch, formatDate } from '../../utils/api';
import { Users, Zap, ArrowRightLeft, CheckCircle2, AlertTriangle, Search, Filter } from 'lucide-react';

export default function AdminCaseAllocation() {
  const [officers, setOfficers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Submitted');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [officersRes, complaintsRes] = await Promise.all([
        apiFetch('/admin/available-officers'),
        apiFetch('/admin/complaints?status=Submitted&limit=100')
      ]);
      if (officersRes.success) setOfficers(officersRes.officers);
      if (complaintsRes.success) setComplaints(complaintsRes.complaints);
    } catch (err) {
      setError(err.message || 'Failed to load allocation data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAllocate = async (complaintId) => {
    setMsg('');
    setAllocating(true);
    try {
      const res = await apiFetch(`/admin/complaints/${complaintId}/auto-allocate`, { method: 'POST' });
      if (res.success) {
        setMsg(`✅ ${res.message}`);
        fetchData();
      }
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setAllocating(false);
    }
  };

  const handleBulkAllocate = async () => {
    if (!selectedOfficer) {
      setMsg('❌ Please select an officer first.');
      return;
    }
    if (selectedComplaints.length === 0) {
      setMsg('❌ Please select at least one complaint.');
      return;
    }

    setAllocating(true);
    setMsg('');
    try {
      const res = await apiFetch('/admin/complaints/bulk-allocate', {
        method: 'POST',
        body: JSON.stringify({ complaintIds: selectedComplaints, assignedAdminId: selectedOfficer })
      });
      if (res.success) {
        setMsg(`✅ ${res.message}`);
        setSelectedComplaints([]);
        setSelectedOfficer('');
        fetchData();
      }
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setAllocating(false);
    }
  };

  const handleManualAllocate = async (complaintId) => {
    if (!selectedOfficer) {
      setMsg('❌ Please select an officer first.');
      return;
    }
    setAllocating(true);
    setMsg('');
    try {
      const res = await apiFetch(`/admin/complaints/${complaintId}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ assignedAdminId: selectedOfficer })
      });
      if (res.success) {
        setMsg(`✅ ${res.message}`);
        fetchData();
      }
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setAllocating(false);
    }
  };

  const toggleSelectComplaint = (id) => {
    setSelectedComplaints(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filtered = getFilteredComplaints();
    if (selectedComplaints.length === filtered.length) {
      setSelectedComplaints([]);
    } else {
      setSelectedComplaints(filtered.map(c => c.id));
    }
  };

  const getFilteredComplaints = () => {
    let filtered = complaints;
    if (statusFilter && statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        (c.referenceId || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.studentName || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  if (loading) return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading allocation workspace...</div>;

  const filteredComplaints = getFilteredComplaints();

  const PRIORITY_COLORS = {
    Low: { bg: 'var(--tint-emerald)', border: 'var(--border-emerald)', text: 'var(--text-emerald-strong)' },
    Medium: { bg: 'var(--color-amber-50)', border: 'var(--border-amber)', text: 'var(--text-amber-strong)' },
    High: { bg: 'var(--color-crimson-50)', border: 'var(--border-crimson)', text: 'var(--text-crimson-strong)' },
    Urgent: { bg: '#F59E0B', border: '#D97706', text: '#FFFFFF' },
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={24} /> Case Allocation Center
        </h1>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          Assign pending cases to available ICC officers. Use auto-allocate for least-busy assignment or bulk allocate multiple cases at once.
        </p>
      </div>

      {msg && (
        <div className="alert" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: msg.startsWith('✅') ? 'var(--tint-emerald)' : 'var(--color-crimson-50)', color: msg.startsWith('✅') ? 'var(--text-emerald-strong)' : 'var(--text-crimson-strong)', border: `1px solid ${msg.startsWith('✅') ? 'var(--border-emerald)' : 'var(--border-crimson)'}` }}>
          {msg}
        </div>
      )}

      <div className="split-sidebar">
        {/* Left: Pending Complaints */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '1rem' }}>
              <ArrowRightLeft size={18} /> Pending Complaints ({filteredComplaints.length})
            </h3>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-slate-400)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search by ID, title, or student name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8125rem' }}
              />
            </div>
            <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px', fontSize: '0.8125rem' }}>
              <option value="Submitted">Submitted</option>
              <option value="Acknowledged">Acknowledged</option>
              <option value="Under Review">Under Review</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>

          {/* Bulk Actions Bar */}
          {selectedComplaints.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-blue-50)', border: '1px solid var(--border-blue)', borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-blue-strong)' }}>
                {selectedComplaints.length} case(s) selected
              </span>
              <div style={{ flex: 1 }} />
              <select className="form-control" value={selectedOfficer} onChange={e => setSelectedOfficer(e.target.value)} style={{ width: '200px', fontSize: '0.8125rem' }}>
                <option value="">Select Officer...</option>
                {officers.map(off => (
                  <option key={off.id} value={off.id}>{off.name} ({off.activeCases} active)</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleBulkAllocate} disabled={allocating || !selectedOfficer}>
                {allocating ? 'Allocating...' : `Allocate ${selectedComplaints.length} Case(s)`}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedComplaints([])}>Clear</button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
            <input
              type="checkbox"
              checked={selectedComplaints.length === filteredComplaints.length && filteredComplaints.length > 0}
              onChange={toggleSelectAll}
            />
            <span style={{ color: 'var(--color-slate-600)', fontWeight: '600' }}>Select All</span>
          </div>

          {filteredComplaints.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--color-emerald-600)', marginBottom: '0.5rem' }} />
              <p>No pending complaints to allocate.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredComplaints.map(c => {
                const pc = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.Medium;
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem', border: selectedComplaints.includes(c.id) ? '2px solid #3B82F6' : '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)', background: selectedComplaints.includes(c.id) ? 'var(--color-blue-50)' : 'var(--color-slate-50)', transition: 'all 0.15s' }}>
                    <input
                      type="checkbox"
                      checked={selectedComplaints.includes(c.id)}
                      onChange={() => toggleSelectComplaint(c.id)}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>{c.referenceId}</span>
                        <span style={{ fontSize: '0.6875rem', padding: '1px 8px', borderRadius: '99px', fontWeight: '600', background: pc.bg, border: `1px solid ${pc.border}`, color: pc.text }}>
                          {c.priority}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)' }}>{c.status}</span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.title}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                        {c.studentName} • {c.studentDept} • {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        title="Auto-allocate to least busy officer"
                        onClick={() => handleAutoAllocate(c.id)}
                        disabled={allocating}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <Zap size={13} /> Auto
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Allocate to selected officer"
                        onClick={() => handleManualAllocate(c.id)}
                        disabled={allocating || !selectedOfficer}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <ArrowRightLeft size={13} /> Assign
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Officer Workload Panel */}
        <div>
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '1rem' }}>
                <Users size={18} /> Officer Workload
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginBottom: '0.75rem' }}>
              Select an officer above for bulk/manual assignment. Officers are sorted by least workload.
            </p>
            {officers.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', padding: '1rem', textAlign: 'center' }}>
                No active officers found.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {officers.map(off => {
                  const maxCases = Math.max(...officers.map(o => o.activeCases), 1);
                  const barWidth = (off.activeCases / maxCases) * 100;
                  return (
                    <div key={off.id} style={{ padding: '0.75rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-sm)', background: 'var(--color-slate-50)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div>
                          <span style={{ fontWeight: '700', fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>{off.name}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', marginLeft: '0.35rem' }}>({off.role === 'super_admin' ? 'Super Admin' : 'Admin'})</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: off.activeCases > 5 ? 'var(--text-crimson-strong)' : off.activeCases > 2 ? 'var(--text-amber-strong)' : 'var(--text-emerald-strong)' }}>
                          {off.activeCases} active
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--color-slate-200)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barWidth}%`, background: off.activeCases > 5 ? '#EF4444' : off.activeCases > 2 ? '#F59E0B' : '#10B981', borderRadius: '3px', transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
                        <span>{off.totalCases} total assigned</span>
                        <span>{off.email}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="panel" style={{ marginTop: '1rem' }}>
            <div className="panel-header">
              <h3 className="panel-title" style={{ fontSize: '0.875rem' }}>
                <AlertTriangle size={16} /> Allocation Tips
              </h3>
            </div>
            <ul style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', paddingLeft: '1.25rem', lineHeight: '1.7' }}>
              <li><strong>Auto Allocate</strong> — Assigns to the least busy officer automatically</li>
              <li><strong>Bulk Allocate</strong> — Select multiple cases, pick an officer, assign all at once</li>
              <li><strong>Manual Assign</strong> — Select an officer first, then click Assign per case</li>
              <li>Assigned cases are auto-acknowledged and officers are notified via email</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
