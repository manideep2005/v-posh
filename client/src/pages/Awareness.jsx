import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import {
  BookOpen, ShieldCheck, HelpCircle, AlertTriangle, Phone, Mail, ChevronDown,
  Loader2, Users, ArrowRight, CheckCircle2, Clock, FileText, Gavel, ScrollText,
} from 'lucide-react';

// Statutory milestones from the POSH Act, 2013 — shown so a complainant knows
// the clock the institution is being held to.
const STATUTORY_STEPS = [
  {
    icon: FileText,
    title: 'You file',
    detail: 'Your complaint is timestamped and assigned a reference ID the moment it is submitted.',
  },
  {
    icon: Clock,
    title: 'Acknowledgement',
    detail: 'The ICC acknowledges receipt and completes preliminary scrutiny of the complaint.',
  },
  {
    icon: Gavel,
    title: 'Inquiry',
    detail: 'The committee examines evidence, hears both parties, and completes the inquiry within the statutory window.',
  },
  {
    icon: ScrollText,
    title: 'Findings & action',
    detail: 'Recommendations are issued to the employer, with interim relief available at any stage on request.',
  },
];

function Accordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="accordion">
      {items.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div className={`accordion-item${isOpen ? ' accordion-item-open' : ''}`} key={i}>
            <button
              type="button"
              className="accordion-trigger"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{faq.q}</span>
              <ChevronDown size={16} className={`accordion-chevron${isOpen ? ' accordion-chevron-open' : ''}`} />
            </button>
            {isOpen && <p className="accordion-body">{faq.a}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function Awareness() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchInfo(); }, []);

  const fetchInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/awareness/info');
      if (data.success) setInfo(data);
      else setError(data.message || 'Failed to load platform information.');
    } catch (err) {
      setError(err.message || 'Failed to load POSH guidelines & policies.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <div className="loading-block">
          <span className="spinner" />
          Loading POSH guidelines &amp; policies…
        </div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="container page">
        <div className="panel">
          <div className="empty-state">
            <AlertTriangle size={30} />
            <strong>Couldn&apos;t load the policy hub</strong>
            <p>{error || 'The awareness service is unavailable right now.'}</p>
            <button type="button" className="btn btn-primary" onClick={fetchInfo}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div className="page-head-main">
          <h1><BookOpen size={22} /> POSH Awareness &amp; Policy Framework</h1>
          <p className="page-sub">
            Your statutory rights, the institutional procedure, and what the law counts as sexual
            harassment — under the Sexual Harassment of Women at Workplace Act, 2013.
          </p>
        </div>
        <div className="page-actions">
          {info.poshPolicyVersion && (
            <span className="chip chip-navy">Policy {info.poshPolicyVersion}</span>
          )}
        </div>
      </div>

      {/* ── Where to go right now ── */}
      <div className="callout callout-emerald">
        <div className="callout-icon"><ShieldCheck size={20} /></div>
        <div className="callout-body">
          <strong>Need to speak to someone now?</strong>
          <p>
            Confidential support is available before you decide whether to file. Reaching out is not
            the same as reporting, and it creates no record against your name.
          </p>
          <div className="callout-actions">
            {info.emergencyHelpline && (
              <a className="btn btn-secondary btn-sm" href={`tel:${info.emergencyHelpline}`}>
                <Phone size={14} /> {info.emergencyHelpline}
              </a>
            )}
            {info.poshCellEmail && (
              <a className="btn btn-secondary btn-sm" href={`mailto:${info.poshCellEmail}`}>
                <Mail size={14} /> {info.poshCellEmail}
              </a>
            )}
            <Link className="btn btn-primary btn-sm" to="/student/complaints/new">
              File a complaint <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Conduct covered by the Act ── */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><AlertTriangle size={19} /> What counts as sexual harassment</h2>
        </div>
        <p className="page-sub" style={{ marginTop: 0 }}>
          Under Section 2(n) of the Act, harassment includes any one or more of the following
          unwelcome acts or behaviour — whether direct or implied. It does not need to be repeated,
          and intent is not a defence.
        </p>
        <div className="card-grid">
          {info.categories?.map(cat => (
            <div className="panel" key={cat.id ?? cat.name} style={{ marginBottom: 0 }}>
              <strong className="cell-strong" style={{ fontSize: '0.9375rem' }}>{cat.name}</strong>
              <p className="page-sub" style={{ marginTop: '0.35rem', fontSize: '0.8125rem' }}>
                {cat.description}
              </p>
              {cat.slaDays ? (
                <span className="chip chip-emerald" style={{ marginTop: '0.75rem' }}>
                  <Clock size={11} /> Resolution target {cat.slaDays} days
                </span>
              ) : null}
            </div>
          ))}
          {!info.categories?.length && (
            <div className="empty-state">
              <AlertTriangle size={26} />
              <strong>No categories configured</strong>
              <p>An ICC administrator has not published conduct categories yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── The procedure, step by step ── */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><Clock size={19} /> What happens after you report</h2>
        </div>
        <ol className="step-list">
          {STATUTORY_STEPS.map((s, i) => (
            <li className="step" key={s.title}>
              <span className="step-index">{i + 1}</span>
              <div className="step-body">
                <strong>{s.title}</strong>
                <p>{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid-2">
        {/* ── Rights ── */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><CheckCircle2 size={19} /> Your rights as a complainant</h2>
          </div>
          <ul className="trust-list">
            {info.rights?.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="field-hint" style={{ marginTop: '1rem' }}>
            These guarantees hold regardless of the outcome of the inquiry. If any of them are
            denied, you may raise it directly with the {info.institutionName || 'institution'}.
          </p>
        </div>

        {/* ── Committee ── */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><Users size={19} /> Internal Complaints Committee</h2>
          </div>
          {info.iccMembers?.length ? (
            <div className="member-list">
              {info.iccMembers.map((m, i) => (
                <div className="member-row" key={`${m.email}-${i}`}>
                  <span className="member-avatar">
                    {(m.name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong className="cell-strong truncate" style={{ maxWidth: '100%' }}>{m.name}</strong>
                    <div className="cell-muted">{m.designation}{m.department ? ` · ${m.department}` : ''}</div>
                    <a className="cell-muted" href={`mailto:${m.email}`} style={{ wordBreak: 'break-all' }}>{m.email}</a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Users size={26} />
              <strong>Committee not published</strong>
              <p>Members become visible here once the ICC roster is configured.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><HelpCircle size={19} /> Frequently asked questions</h2>
        </div>
        <Accordion items={info.faqs || []} />
      </div>
    </div>
  );
}
