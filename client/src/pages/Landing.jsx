import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, FileText, UserCheck, PhoneCall, ArrowRight, EyeOff } from 'lucide-react';

export default function Landing() {
  return (
    <div>
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="container split-sidebar" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)', gap: '3rem', alignItems: 'center' }}>
          <div>
            <div className="landing-badge">
              <img src="/vit-ap-logo.png" alt="VIT-AP Logo" style={{ height: '28px', width: 'auto' }} />
              <span>V-POSH PLATFORM</span>
            </div>

            <h1 style={{ fontSize: '2.5rem', fontWeight: '700', lineHeight: '1.2', letterSpacing: '-0.02em', marginBottom: '1.25rem', fontFamily: 'var(--font-serif)' }}>
              Your concern deserves to be heard with dignity and complete privacy.
            </h1>
            <p style={{ fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '640px' }}>
              The VIT-AP University Internal Complaints Committee (ICC) provides an impartial, secure, and statutory <strong>V-POSH</strong> platform for reporting and resolving grievances in compliance with the POSH Act, 2013.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/student/complaints/new" className="btn btn-emerald" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                Raise a Complaint <ArrowRight size={16} />
              </Link>
              <Link to="/auth/student/login" className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                Track Existing Complaint
              </Link>
              <button
                onClick={() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} window.location.href = '/'; }}
                className="btn btn-secondary"
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                title="Clear all local data and reload. Useful if you are on a shared device."
              >
                <EyeOff size={16} /> Browse Anonymously
              </button>
            </div>
          </div>

          {/* Quick Institutional Summary Card */}
          <div className="landing-card">
            <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-slate-200)', paddingBottom: '0.85rem' }}>
              <img src="/vit-ap-logo.png" alt="VIT-AP Logo" style={{ height: '38px', objectFit: 'contain' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.4rem' }}>
                V-POSH Protections
              </h3>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
              <li style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <Lock size={18} color="var(--color-emerald-700)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Strict Confidentiality:</strong> Identity & evidence restricted exclusively to authorized ICC members.
                </div>
              </li>
              <li style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <UserCheck size={18} color="var(--color-emerald-700)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Protection Against Retaliation:</strong> Statutory interim protection during inquiry proceedings.
                </div>
              </li>
              <li style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <FileText size={18} color="var(--color-emerald-700)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Statutory Timelines:</strong> Formal acknowledgment within 7 days and structured inquiry completion.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="landing-workflow">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 3rem auto' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.75rem' }}>
              V-POSH Redressal Workflow
            </h2>
            <p style={{ fontSize: '0.95rem' }}>
              Every complaint submitted to V-POSH is processed under strict statutory guidelines by the Internal Complaints Committee.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {[
              { n: 1, title: 'Secure Submission', desc: 'Submit incident details, location, dates, and optional supporting document attachments.' },
              { n: 2, title: 'ICC Acknowledgment', desc: 'Presiding officer reviews initial facts and issues formal receipt notice within statutory SLA limits.' },
              { n: 3, title: 'Confidential Inquiry', desc: 'Statements and evidence are examined in full confidence with interim protective measures applied.' },
              { n: 4, title: 'Action & Resolution', desc: 'Final recommendations are submitted to executive authority and official closure updates are recorded.' },
            ].map(s => (
              <div key={s.n} className="panel" style={{ textAlign: 'left', marginBottom: 0 }}>
                <div className="landing-step-num">{s.n}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.875rem' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency Assistance Banner */}
      <section className="landing-emergency">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
              Need Urgent Assistance or Immediate Counseling?
            </h3>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              The VIT-AP V-POSH cell helpline is available for emergency support and guidance.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a href="tel:+918632377777" className="btn btn-emerald" style={{ textDecoration: 'none' }}>
              <PhoneCall size={16} /> Call +91 863-2377777
            </a>
            <Link to="/awareness" className="btn btn-secondary">
              Read Policy Guidelines
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
