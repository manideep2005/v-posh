import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { FileText, AlertCircle, CheckCircle2, Send } from 'lucide-react';

export default function FacultyRaiseComplaint() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    studentName: '', studentEmail: '', studentRollNo: '',
    title: '', category: '', description: '',
    incidentDate: '', incidentLocation: '',
    respondentName: '', respondentDept: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setSubmitting(true);
    try {
      const res = await apiFetch('/faculty/complaints', { method: 'POST', body: JSON.stringify(form) });
      if (res.success) {
        setMsg(res.message);
        setTimeout(() => navigate('/faculty/complaints'), 1500);
      }
    } catch (err) {
      setErr(err.message || 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page" style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div className="page-head">
        <div className="page-head-main">
          <h1><FileText size={22} /> File Complaint on Behalf of a Student</h1>
          <p className="page-sub">
            As department faculty you may register a grievance for a student who is unable to file
            it themselves. The case follows the same statutory timeline as any other complaint.
          </p>
        </div>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {msg}</div>}
      {err && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {err}</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header"><h3 className="panel-title" style={{ fontSize: '1rem' }}>Student Information</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Student Name <span className="required">*</span></label>
              <input type="text" name="studentName" className="form-control" placeholder="Full name" value={form.studentName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Student Email</label>
              <input type="email" name="studentEmail" className="form-control" placeholder="email@vitapstudent.ac.in" value={form.studentEmail} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Roll Number</label>
              <input type="text" name="studentRollNo" className="form-control" placeholder="e.g. 23MIS7006" value={form.studentRollNo} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header"><h3 className="panel-title" style={{ fontSize: '1rem' }}>Complaint Details</h3></div>
          <div className="form-group">
            <label>Complaint Title <span className="required">*</span></label>
            <input type="text" name="title" className="form-control" placeholder="Brief title of the complaint" value={form.title} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Category <span className="required">*</span></label>
            <select name="category" className="form-control" value={form.category} onChange={handleChange} required>
              <option value="">Select Category</option>
              <option value="Sexual Harassment">Sexual Harassment</option>
              <option value="Discrimination">Discrimination</option>
              <option value="Bullying">Bullying</option>
              <option value="Verbal Abuse">Verbal Abuse</option>
              <option value="Physical Misconduct">Physical Misconduct</option>
              <option value="Online Harassment">Online Harassment</option>
              <option value="Retaliation">Retaliation</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description <span className="required">*</span></label>
            <textarea name="description" className="form-control" rows={5} placeholder="Detailed description of the incident..." value={form.description} onChange={handleChange} required />
          </div>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label>Incident Date <span className="required">*</span></label>
              <input type="date" name="incidentDate" className="form-control" value={form.incidentDate} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Incident Location</label>
              <input type="text" name="incidentLocation" className="form-control" placeholder="e.g. Block A, Room 301" value={form.incidentLocation} onChange={handleChange} />
            </div>
          </div>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label>Respondent Name</label>
              <input type="text" name="respondentName" className="form-control" placeholder="Name of person involved" value={form.respondentName} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Respondent Department</label>
              <input type="text" name="respondentDept" className="form-control" placeholder="Department of respondent" value={form.respondentDept} onChange={handleChange} />
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-emerald" style={{ width: '100%', padding: '0.75rem' }} disabled={submitting}>
          <Send size={16} /> {submitting ? 'Submitting...' : 'File Complaint on Behalf of Student'}
        </button>
      </form>
    </div>
  );
}
