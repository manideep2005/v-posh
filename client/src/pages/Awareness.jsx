import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { BookOpen, ShieldCheck, HelpCircle, UserCheck, AlertTriangle } from 'lucide-react';

export default function Awareness() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInfo();
  }, []);

  const fetchInfo = async () => {
    try {
      const data = await apiFetch('/awareness/info');
      if (data.success) {
        setInfo(data);
      }
    } catch (err) {
      console.error('Failed to load awareness info:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '3rem 0', textAlign: 'center' }}>Loading POSH guidelines & policies...</div>;
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ borderBottom: '2px solid var(--color-navy-900)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
          POSH Awareness & Policy Framework
        </h1>
        <p style={{ color: 'var(--color-slate-600)', marginTop: '0.25rem' }}>
          Understanding your statutory rights, institutional procedures, and sexual harassment prevention rules under the POSH Act, 2013.
        </p>
      </div>

      {/* What constitutes harassment? */}
      <div className="panel">
        <div className="panel-title">
          <AlertTriangle color="var(--color-amber-700)" size={20} />
          What Constitutes Sexual Harassment under POSH?
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-700)', marginBottom: '1rem' }}>
          Under Section 2(n) of the Sexual Harassment of Women at Workplace Act, 2013, sexual harassment includes any one or more of the following unwelcome acts or behavior (whether directly or by implication):
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {info?.categories?.map(cat => (
            <div key={cat.id} style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '0.35rem' }}>
                {cat.name}
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
                {cat.description}
              </p>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-emerald-700)', marginTop: '0.5rem' }}>
                Statutory Resolution SLA: Within {cat.slaDays} days
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statutory Rights */}
      <div className="panel">
        <div className="panel-title">
          <ShieldCheck color="var(--color-emerald-700)" size={20} />
          Complainant Rights & Institutional Guarantees
        </div>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', fontSize: '0.9rem', color: 'var(--color-slate-700)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {info?.rights?.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {/* FAQs */}
      <div className="panel">
        <div className="panel-title">
          <HelpCircle color="var(--color-navy-900)" size={20} />
          Frequently Asked Questions (FAQs)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {info?.faqs?.map((faq, i) => (
            <div key={i} style={{ borderBottom: i === info.faqs.length - 1 ? 'none' : '1px solid var(--color-slate-100)', paddingBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '0.35rem' }}>
                Q: {faq.q}
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', lineHeight: '1.6' }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
