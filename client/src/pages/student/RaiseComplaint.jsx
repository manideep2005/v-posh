
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { ShieldCheck, Lock, Upload, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';

export default function RaiseComplaint() {
  const [step, setStep] = useState(1); // Step 1: Form, Step 2: Review & Verify, Step 3: Confirmation
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedComplaint, setSubmittedComplaint] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Verbal / Non-Verbal Harassment',
    description: '',
    incidentDate: '',
    incidentLocation: '',
    respondentName: '',
    respondentDept: '',
    attachmentIds: []
  });

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFilesList, setUploadedFilesList] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/awareness/info');
      if (res.success && res.categories) {
        setCategories(res.categories);
        if (res.categories.length > 0) {
          setFormData(prev => ({ ...prev, category: res.categories[0].name }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setError('');

    const bodyFormData = new FormData();
    for (let i = 0; i < files.length; i++) {
      bodyFormData.append('attachments', files[i]);
    }

    try {
      const res = await apiFetch('/uploads', {
        method: 'POST',
        body: bodyFormData
      });

      if (res.success && res.attachments) {
        const newIds = res.attachments.map(a => a.id);
        setFormData(prev => ({
          ...prev,
          attachmentIds: [...prev.attachmentIds, ...newIds]
        }));
        setUploadedFilesList(prev => [...prev, ...res.attachments]);
      }
    } catch (err) {
      setError(err.message || 'File upload failed.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleProceedToReview = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.category || !formData.description || !formData.incidentDate) {
      setError('Please fill in all mandatory fields: Title, Category, Incident Date, and Description.');
      return;
    }

    setStep(2);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/student/complaints', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (res.success && res.complaint) {
        setSubmittedComplaint(res.complaint);
        setStep(3);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
          Submit Confidential Grievance Complaint
        </h1>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Statutory submission form under POSH Act guidelines. Information is encrypted and protected.
        </p>
      </div>

      {/* Confidentiality Notice */}
      <div className="confidentiality-notice">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '0.35rem' }}>
          <Lock size={16} color="var(--color-emerald-700)" /> Statutory Confidentiality Commitment
        </div>
        All disclosures, identity markers, and submitted evidence remain strictly confidential. Access is restricted solely to presiding ICC members assigned to conduct statutory inquiry. Protection against academic or administrative victimization is guaranteed under institutional policy.
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-slate-200)', paddingBottom: '0.75rem', marginBottom: '2rem', fontSize: '0.875rem', fontWeight: '600' }}>
        <span style={{ color: step === 1 ? 'var(--color-emerald-700)' : 'var(--color-slate-600)' }}>
          1. Incident Details Form
        </span>
        <span style={{ color: step === 2 ? 'var(--color-emerald-700)' : 'var(--color-slate-600)' }}>
          2. Review & Confirm Submission
        </span>
        <span style={{ color: step === 3 ? 'var(--color-emerald-700)' : 'var(--color-slate-600)' }}>
          3. Receipt Reference Issued
        </span>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: FORM INPUT */}
      {step === 1 && (
        <form onSubmit={handleProceedToReview} className="panel">
          <div className="form-group">
            <label htmlFor="title">Complaint Summary Title <span className="required">*</span></label>
            <input
              id="title"
              name="title"
              type="text"
              className="form-control"
              placeholder="e.g. Persistent unwelcome messaging and academic coercion"
              value={formData.title}
              onChange={handleChange}
              required
            />
            <div className="form-hint">Brief clear description summarizing the nature of the incident.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="category">Complaint Category <span className="required">*</span></label>
              <select
                id="category"
                name="category"
                className="form-control"
                value={formData.category}
                onChange={handleChange}
                required
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="incidentDate">Incident Date / Time Period <span className="required">*</span></label>
              <input
                id="incidentDate"
                name="incidentDate"
                type="date"
                className="form-control"
                value={formData.incidentDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="incidentLocation">Location of Incident</label>
              <input
                id="incidentLocation"
                name="incidentLocation"
                type="text"
                className="form-control"
                placeholder="e.g. Computer Lab 3 / Academic Building Corridor"
                value={formData.incidentLocation}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="respondentName">Respondent / Person Concerned Name (If Known)</label>
              <input
                id="respondentName"
                name="respondentName"
                type="text"
                className="form-control"
                placeholder="e.g. Name or designation of respondent"
                value={formData.respondentName}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Detailed Description of Incident <span className="required">*</span></label>
            <textarea
              id="description"
              name="description"
              rows={6}
              className="form-control"
              placeholder="Provide a factual narrative of events, including sequence, time, witnesses (if any), and impact..."
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          {/* File Upload Section */}
          <div className="form-group" style={{ backgroundColor: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-slate-300)' }}>
            <label htmlFor="file-upload" style={{ marginBottom: '0.2rem' }}>
              Upload Supporting Evidence / Attachments (Optional)
            </label>
            <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
              Accepted formats: PDF, PNG, JPG, DOCX (Max 10MB per file).
            </p>
            <input
              id="file-upload"
              type="file"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'block', fontSize: '0.875rem' }}
              disabled={uploadingFiles}
            />
            {uploadingFiles && <p style={{ fontSize: '0.8125rem', color: 'var(--color-emerald-700)', marginTop: '0.5rem' }}>Uploading files...</p>}

            {uploadedFilesList.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--color-navy-900)' }}>Uploaded Files:</strong>
                {uploadedFilesList.map(f => (
                  <div key={f.id} style={{ fontSize: '0.8125rem', color: 'var(--color-emerald-700)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={14} /> {f.originalname} ({(f.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary">
              Proceed to Review <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: REVIEW STEP */}
      {step === 2 && (
        <div className="panel">
          <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '1rem', borderBottom: '1px solid var(--color-slate-200)', paddingBottom: '0.5rem' }}>
            Verify Complaint Details Before Formal Submission
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem', color: 'var(--color-slate-800)' }}>
            <div>
              <strong>Title:</strong> {formData.title}
            </div>
            <div>
              <strong>Category:</strong> {formData.category}
            </div>
            <div>
              <strong>Incident Date:</strong> {formData.incidentDate}
            </div>
            <div>
              <strong>Location:</strong> {formData.incidentLocation || 'Not specified'}
            </div>
            <div>
              <strong>Respondent Name:</strong> {formData.respondentName || 'Not specified'}
            </div>
            <div>
              <strong>Description Narrative:</strong>
              <div style={{ background: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-slate-200)', marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                {formData.description}
              </div>
            </div>
            {uploadedFilesList.length > 0 && (
              <div>
                <strong>Attached Evidence Files:</strong> {uploadedFilesList.length} file(s) attached
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-200)' }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
              <ArrowLeft size={16} /> Edit Details
            </button>
            <button type="button" onClick={handleFinalSubmit} className="btn btn-emerald" disabled={loading}>
              {loading ? 'Submitting to ICC...' : 'Confirm & Register Complaint'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS CONFIRMATION */}
      {step === 3 && submittedComplaint && (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem 2rem', borderTop: '4px solid var(--color-emerald-700)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--color-emerald-50)', color: 'var(--color-emerald-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '0.5rem' }}>
            Grievance Formally Registered
          </h2>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Your complaint has been assigned a unique reference ID for statutory tracking.
          </p>

          <div style={{ background: 'var(--color-slate-100)', border: '1px solid var(--color-slate-300)', padding: '1rem 2rem', borderRadius: 'var(--radius-sm)', display: 'inline-block', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Unique Complaint Reference ID
            </span>
            <strong style={{ fontSize: '1.75rem', color: 'var(--color-navy-900)', fontFamily: 'monospace' }}>
              {submittedComplaint.referenceId}
            </strong>
          </div>

          <div>
            <button
              onClick={() => navigate(`/student/complaints/${submittedComplaint.id}`)}
              className="btn btn-primary"
            >
              Track Complaint Status Timeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
