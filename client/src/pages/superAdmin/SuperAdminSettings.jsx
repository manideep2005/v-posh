import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import {
  Settings, CheckCircle2, AlertCircle, Building2, ShieldCheck, ListChecks, Save,
} from 'lucide-react';

const DEFAULTS = {
  institutionName: '',
  poshCellEmail: '',
  emergencyHelpline: '',
  poshPolicyVersion: '',
  slaWarningDays: 2,
};

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(DEFAULTS);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/super-admin/settings');
      if (res.success) {
        const loaded = { ...DEFAULTS, ...res.settings };
        setSettings(loaded);
        setSaved(loaded);
        setDepartments(res.departments || []);
        setCategories(res.categories || []);
      } else {
        setErr(res.message || 'Failed to load system settings.');
      }
    } catch (e) {
      setErr(e.message || 'Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setSaving(true);

    try {
      const res = await apiFetch('/super-admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      if (res.success) {
        setMsg('System configuration updated successfully.');
        setSaved(settings);
      }
    } catch (e) {
      setErr(e.message || 'Failed to save configuration changes.');
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  if (loading) {
    return (
      <div className="container page">
        <div className="loading-block"><span className="spinner" /> Loading system settings…</div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><Settings size={22} /> System Configuration</h1>
          <p className="page-sub">
            Institution identity, emergency contacts, policy version and SLA thresholds used across
            the platform.
          </p>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} /> <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="alert alert-danger">
          <AlertCircle size={16} /> <span>{err}</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Institution identity */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
              <Building2 size={16} /> Institution details
            </h3>
          </div>

          <div className="form-group">
            <label htmlFor="institutionName">Institution name</label>
            <input
              id="institutionName"
              type="text"
              className="form-control"
              value={settings.institutionName}
              onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
              required
            />
          </div>

          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="poshCellEmail">POSH cell email</label>
              <input
                id="poshCellEmail"
                type="email"
                className="form-control"
                value={settings.poshCellEmail}
                onChange={(e) => setSettings({ ...settings, poshCellEmail: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="emergencyHelpline">Emergency helpline</label>
              <input
                id="emergencyHelpline"
                type="text"
                className="form-control"
                value={settings.emergencyHelpline}
                onChange={(e) => setSettings({ ...settings, emergencyHelpline: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* Policy & SLA */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
              <ShieldCheck size={16} /> Policy &amp; SLA
            </h3>
          </div>

          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="poshPolicyVersion">POSH policy document version</label>
              <input
                id="poshPolicyVersion"
                type="text"
                className="form-control"
                placeholder="e.g. V-POSH Policy v2026.1"
                value={settings.poshPolicyVersion}
                onChange={(e) => setSettings({ ...settings, poshPolicyVersion: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="slaWarningDays">SLA warning threshold (days)</label>
              <input
                id="slaWarningDays"
                type="number"
                min="1"
                max="90"
                className="form-control"
                value={settings.slaWarningDays}
                onChange={(e) => setSettings({ ...settings, slaWarningDays: parseInt(e.target.value, 10) || 0 })}
                required
              />
              <p className="form-hint">Cases open beyond this many days are flagged as approaching breach.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-slate-100)' }}>
            <span className="toolbar-meta">
              {dirty ? 'You have unsaved changes.' : 'All changes are saved.'}
            </span>
            <button type="submit" className="btn btn-emerald" disabled={saving || !dirty}>
              <Save size={15} /> {saving ? 'Saving…' : 'Save configuration'}
            </button>
          </div>
        </div>
      </form>

      {/* Categories */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
            <ListChecks size={16} /> Complaint categories &amp; SLA limits
          </h3>
          <span className="toolbar-meta">{categories.length} categories</span>
        </div>

        {categories.length === 0 ? (
          <div className="empty-state">
            <ListChecks size={30} />
            <strong>No categories registered</strong>
            <p>Complaint categories and their SLA targets are provisioned with the platform defaults.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="hide-sm">Description</th>
                  <th className="nowrap">SLA target</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c.id}>
                    <td className="cell-strong">{c.name}</td>
                    <td className="hide-sm" style={{ fontSize: '0.8125rem' }}>{c.description}</td>
                    <td className="nowrap">
                      <span className="chip chip-emerald">{c.slaDays} days</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Departments */}
      {departments.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ fontSize: '0.9375rem' }}>
              <Building2 size={16} /> Registered departments
            </h3>
            <span className="toolbar-meta">{departments.length} departments</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {departments.map(d => (
              <span key={d.id || d.code || d.name} className="chip chip-navy">
                {d.code ? `${d.code} · ${d.name}` : d.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
