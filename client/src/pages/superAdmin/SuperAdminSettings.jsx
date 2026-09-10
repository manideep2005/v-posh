import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Settings, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState({
    institutionName: '',
    poshCellEmail: '',
    emergencyHelpline: '',
    poshPolicyVersion: '',
    slaWarningDays: 2
  });

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/super-admin/settings');
      if (res.success) {
        setSettings(res.settings);
        setDepartments(res.departments || []);
        setCategories(res.categories || []);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg('');
    setSaving(true);

    try {
      const res = await apiFetch('/super-admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      if (res.success) {
        setMsg('System configurations updated successfully.');
      }
    } catch (e) {
      alert(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading system settings...</div>;
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '800px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
          Institutional System Configuration
        </h1>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Manage institution details, emergency helpline parameters, policy versions, and department settings
        </p>
      </div>

      {msg && <div className="alert alert-success"><CheckCircle2 size={16} /> <span>{msg}</span></div>}

      <form onSubmit={handleSave} className="panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <Settings size={18} /> Global Parameters
          </h3>
        </div>

        <div className="form-group">
          <label htmlFor="institutionName">Institution Name</label>
          <input
            id="institutionName"
            type="text"
            className="form-control"
            value={settings.institutionName}
            onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="poshCellEmail">POSH Cell Email</label>
            <input
              id="poshCellEmail"
              type="email"
              className="form-control"
              value={settings.poshCellEmail}
              onChange={(e) => setSettings({ ...settings, poshCellEmail: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="emergencyHelpline">Emergency Helpline Number</label>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="poshPolicyVersion">POSH Policy Document Version</label>
            <input
              id="poshPolicyVersion"
              type="text"
              className="form-control"
              value={settings.poshPolicyVersion}
              onChange={(e) => setSettings({ ...settings, poshPolicyVersion: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="slaWarningDays">SLA Warning Threshold (Days)</label>
            <input
              id="slaWarningDays"
              type="number"
              className="form-control"
              value={settings.slaWarningDays}
              onChange={(e) => setSettings({ ...settings, slaWarningDays: parseInt(e.target.value) || 2 })}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn-emerald" disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration Changes'}
        </button>
      </form>

      {/* Categories & SLA Reference Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Registered Complaint Categories & SLA Limits</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Description</th>
                <th>SLA Resolution Target</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: '700', color: 'var(--color-navy-900)' }}>{c.name}</td>
                  <td style={{ fontSize: '0.8125rem' }}>{c.description}</td>
                  <td><span className="badge badge-resolved">{c.slaDays} Days</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
