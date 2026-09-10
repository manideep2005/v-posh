import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, PhoneCall, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="inst-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <div style={{ background: '#FFFFFF', padding: '6px 12px', borderRadius: '4px', display: 'inline-block', marginBottom: '1rem' }}>
              <img 
                src="/vit-ap-logo.png" 
                alt="VIT-AP University Logo" 
                style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <h3 style={{ fontSize: '1.1rem', color: '#FFFFFF', marginBottom: '0.5rem' }}>
              V-POSH • VIT-AP University
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              Statutory body constituted under the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013. Committed to ensuring a safe, respectful, and harassment-free campus environment.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-emerald-700)', fontSize: '0.8125rem', fontWeight: '600' }}>
              <Lock size={14} /> 256-Bit Encrypted Confidential Grievance Submission
            </div>
          </div>

          <div className="footer-col">
            <h3>Quick Portals</h3>
            <ul className="footer-links">
              <li><Link to="/awareness">V-POSH Guidelines & Regulations</Link></li>
              <li><Link to="/auth/student/login">Student Grievance Sign In</Link></li>
              <li><Link to="/admin/login">ICC Committee Member Portal</Link></li>
              <li><Link to="/student/complaints/new">Submit Confidential Complaint</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>Emergency & Assistance</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PhoneCall size={16} color="var(--color-emerald-700)" />
                <div>
                  <strong>VIT-AP Campus Helpline:</strong><br />
                  +91 863-2377777 / 1800-112-9900
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} color="var(--color-emerald-700)" />
                <div>
                  <strong>V-POSH Cell Email:</strong><br />
                  vposh@vitap.ac.in
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © {new Date().getFullYear()} VIT-AP University. All rights reserved. V-POSH Grievance Portal v2026.1
          </div>
          <div>
            Strict Confidentiality • Statutory POSH Act Compliance • Zero Tolerance Policy
          </div>
        </div>
      </div>
    </footer>
  );
}
