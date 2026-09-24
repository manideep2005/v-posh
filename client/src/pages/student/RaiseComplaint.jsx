import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { ShieldCheck, Lock, Upload, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Calendar, MapPin, User, FileText, MessageSquare, AlertTriangle, Paperclip, ChevronRight } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low', desc: 'Minor concern, no immediate impact', color: '#6B7280', bg: '#F3F4F6' },
  { value: 'Medium', label: 'Medium', desc: 'Moderate concern affecting wellbeing', color: '#D97706', bg: 'var(--tint-amber)' },
  { value: 'High', label: 'High', desc: 'Serious incident requiring urgent attention', color: '#DC2626', bg: '#FEE2E2' },
  { value: 'Urgent', label: 'Urgent', desc: 'Immediate safety threat or severe harm', color: '#7C2D12', bg: '#FED7AA' },
];

export default function RaiseComplaint() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedComplaint, setSubmittedComplaint] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    incidentDate: '',
    incidentLocation: '',
    respondentName: '',
    respondentDept: '',
    priority: 'Medium',
    witnessNames: '',
    impactDescription: '',
    isRecurring: false,
    preferredContact: 'email',
    attachmentIds: []
  });

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFilesList, setUploadedFilesList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/awareness/info');
      if (res.success && res.categories) {
        setCategories(res.categories);
        if (res.categories.length > 0) {
          setFormData(prev => ({ ...prev, category: res.categories[0].name }));
        }
      }
    } catch (err) { console.error('Failed to fetch categories:', err); }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFiles(true); setError('');
    const bodyFormData = new FormData();
    for (let i = 0; i < files.length; i++) bodyFormData.append('attachments', files[i]);
    try {
      const res = await apiFetch('/uploads', { method: 'POST', body: bodyFormData });
      if (res.success && res.attachments) {
        const newIds = res.attachments.map(a => a.id);
        setFormData(prev => ({ ...prev, attachmentIds: [...prev.attachmentIds, ...newIds] }));
        setUploadedFilesList(prev => [...prev, ...res.attachments]);
      }
    } catch (err) { setError(err.message || 'File upload failed.'); }
    finally { setUploadingFiles(false); }
  };

  const handleProceedToReview = (e) => {
    e.preventDefault(); setError('');
    if (!formData.title || !formData.category || !formData.description || !formData.incidentDate) {
      setError('Please fill in all mandatory fields: Title, Category, Incident Date, and Description.');
      return;
    }
    setStep(2);
  };

  const handleFinalSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/student/complaints', { method: 'POST', body: JSON.stringify(formData) });
      if (res.success && res.complaint) { setSubmittedComplaint(res.complaint); setStep(3); }
    } catch (err) { setError(err.message || 'Failed to submit complaint.'); }
    finally { setLoading(false); }
  };

  const stepProgress = ((step - 1) / 2) * 100;

  return (
    <div className="container page" style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>
          Submit Confidential Grievance
        </h1>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
          Statutory submission under POSH Act. Your identity and evidence are protected.
        </p>
      </div>

      {/* Step Progress Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: '600', gap: '0.35rem' }}>
          {['Incident Details', 'Review & Confirm', 'Receipt Issued'].map((label, i) => (
            <span key={i} style={{ color: step === i + 1 ? 'var(--color-emerald-700)' : step > i + 1 ? 'var(--color-emerald-500)' : 'var(--color-slate-400)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {step > i + 1 ? <CheckCircle2 size={14} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', background: step === i + 1 ? 'var(--color-emerald-600)' : 'var(--color-slate-200)', color: step === i + 1 ? '#fff' : 'var(--color-slate-500)' }}>{i + 1}</span>}
              {label}
            </span>
          ))}
        </div>
        <div style={{ height: 4, background: 'var(--color-slate-200)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${stepProgress}%`, background: 'linear-gradient(90deg, var(--color-emerald-600), var(--color-emerald-400))', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Confidentiality Notice */}
      <div style={{ background: 'var(--tint-emerald)', border: '1px solid var(--border-emerald)', borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-emerald-strong)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', marginBottom: '0.35rem' }}>
          <ShieldCheck size={16} /> Statutory Confidentiality Commitment
        </div>
        All disclosures, identity markers, and evidence remain strictly confidential. Access restricted solely to assigned ICC members. Protection against victimization guaranteed under POSH Act, 2013.
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}><AlertCircle size={15} /><span>{error}</span></div>}

      {/* STEP 1: FORM */}
      {step === 1 && (
        <form onSubmit={handleProceedToReview}>
          {/* Section: Basic Info */}
          <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-slate-100)' }}>
              <FileText size={18} style={{ color: 'var(--color-emerald-600)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>Incident Information</h3>
            </div>

            <div className="form-group">
              <label htmlFor="title" style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                Complaint Summary <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input id="title" name="title" type="text" className="form-control" placeholder="Brief summary of the incident" value={formData.title} onChange={handleChange} required style={{ fontSize: '0.9375rem' }} />
            </div>

            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Category <span style={{ color: '#DC2626' }}>*</span></label>
                <select name="category" className="form-control" value={formData.category} onChange={handleChange} required>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} /> Incident Date <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input name="incidentDate" type="date" className="form-control" value={formData.incidentDate} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: '600' }}>Priority Level <span style={{ color: '#DC2626' }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                {PRIORITY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setFormData(prev => ({ ...prev, priority: opt.value }))} style={{
                    padding: '0.65rem 0.5rem', borderRadius: 'var(--radius-sm)', border: `2px solid ${formData.priority === opt.value ? opt.color : 'var(--color-slate-200)'}`,
                    background: formData.priority === opt.value ? opt.bg : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}>
                    <div style={{ fontWeight: '700', fontSize: '0.8125rem', color: opt.color }}>{opt.label}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Location & Respondent */}
          <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-slate-100)' }}>
              <MapPin size={18} style={{ color: 'var(--color-emerald-600)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>Location & Person Involved</h3>
            </div>

            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Location of Incident</label>
                <input name="incidentLocation" type="text" className="form-control" placeholder="e.g. Computer Lab 3, Academic Block" value={formData.incidentLocation} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><User size={14} /> Respondent Name</label>
                <input name="respondentName" type="text" className="form-control" placeholder="Name or designation of respondent" value={formData.respondentName} onChange={handleChange} />
              </div>
            </div>
            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Respondent Department</label>
                <input name="respondentDept" type="text" className="form-control" placeholder="e.g. Computer Science & Engineering" value={formData.respondentDept} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Witnesses (if any)</label>
                <input name="witnessNames" type="text" className="form-control" placeholder="Names of witnesses, comma-separated" value={formData.witnessNames} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Section: Description */}
          <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-slate-100)' }}>
              <MessageSquare size={18} style={{ color: 'var(--color-emerald-600)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>Detailed Description</h3>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: '600' }}>What happened? <span style={{ color: '#DC2626' }}>*</span></label>
              <textarea name="description" rows={5} className="form-control" placeholder="Provide a factual narrative: sequence of events, date/time, what was said or done, and any immediate impact on you..." value={formData.description} onChange={handleChange} required style={{ lineHeight: '1.6' }} />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: '600' }}>Impact on You</label>
              <textarea name="impactDescription" rows={3} className="form-control" placeholder="How has this incident affected you? (academic, emotional, physical impact)" value={formData.impactDescription} onChange={handleChange} style={{ lineHeight: '1.6' }} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-slate-700)' }}>
                <input type="checkbox" name="isRecurring" checked={formData.isRecurring} onChange={handleChange} style={{ width: 16, height: 16, accentColor: 'var(--color-emerald-600)' }} />
                This is a recurring incident
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-slate-700)' }}>Preferred contact:</label>
                <select name="preferredContact" value={formData.preferredContact} onChange={handleChange} style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-slate-300)', fontSize: '0.8125rem', fontFamily: 'inherit' }}>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="in-person">In-Person Meeting</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Evidence */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-slate-100)' }}>
              <Paperclip size={18} style={{ color: 'var(--color-emerald-600)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-navy-900)' }}>Supporting Evidence</h3>
            </div>

            <div style={{ border: '2px dashed var(--color-slate-300)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', textAlign: 'center', background: 'var(--color-slate-50)', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-emerald-400)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-slate-300)'}
            >
              <Upload size={28} style={{ color: 'var(--color-slate-400)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-slate-700)', marginBottom: '0.25rem' }}>Drop files here or click to upload</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginBottom: '0.75rem' }}>PDF, PNG, JPG, DOCX — Max 10MB per file</p>
              <input type="file" multiple onChange={handleFileUpload} style={{ fontSize: '0.8125rem' }} disabled={uploadingFiles} />
              {uploadingFiles && <p style={{ fontSize: '0.8125rem', color: 'var(--color-emerald-700)', marginTop: '0.5rem' }}>Uploading...</p>}
            </div>

            {uploadedFilesList.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {uploadedFilesList.map(f => (
                  <div key={f.id} style={{ fontSize: '0.8125rem', color: 'var(--color-emerald-700)', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: 'var(--tint-emerald)', borderRadius: 'var(--radius-sm)' }}>
                    <CheckCircle2 size={14} /> {f.originalname} ({(f.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-emerald" style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem' }}>
              Proceed to Review <ChevronRight size={16} />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: REVIEW */}
      {step === 2 && (
        <div className="panel">
          <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-slate-200)' }}>
            Verify Details Before Submission
          </h2>

          <div className="grid-2" style={{ gap: '1rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Title', value: formData.title },
              { label: 'Category', value: formData.category },
              { label: 'Priority', value: formData.priority },
              { label: 'Date', value: formData.incidentDate },
              { label: 'Location', value: formData.incidentLocation || 'Not specified' },
              { label: 'Respondent', value: formData.respondentName || 'Not specified' },
              { label: 'Department', value: formData.respondentDept || 'Not specified' },
              { label: 'Witnesses', value: formData.witnessNames || 'None' },
              { label: 'Recurring', value: formData.isRecurring ? 'Yes' : 'No' },
              { label: 'Contact Preference', value: formData.preferredContact },
            ].map((item, i) => (
              <div key={i} style={{ padding: '0.65rem', background: 'var(--color-slate-50)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>{item.label}</div>
                <div style={{ fontWeight: '600', color: 'var(--color-navy-900)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Description</div>
            <div style={{ background: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-slate-200)', whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: '1.6' }}>{formData.description}</div>
          </div>

          {formData.impactDescription && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Impact Description</div>
              <div style={{ background: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-slate-200)', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>{formData.impactDescription}</div>
            </div>
          )}

          {uploadedFilesList.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Attachments ({uploadedFilesList.length})</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {uploadedFilesList.map(f => (
                  <span key={f.id} style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', background: 'var(--color-slate-100)', borderRadius: '99px', color: 'var(--color-slate-700)' }}>{f.originalname}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-200)' }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-secondary"><ArrowLeft size={16} /> Edit Details</button>
            <button type="button" onClick={handleFinalSubmit} className="btn btn-emerald" disabled={loading} style={{ padding: '0.75rem 2rem' }}>
              {loading ? 'Submitting...' : 'Confirm & Submit to ICC'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS */}
      {step === 3 && submittedComplaint && (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem 2rem', borderTop: '4px solid var(--color-emerald-700)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--tint-emerald)', color: 'var(--color-emerald-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)' }}>
            <CheckCircle2 size={40} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-navy-900)', marginBottom: '0.5rem' }}>Grievance Formally Registered</h2>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            Your complaint has been assigned a unique reference ID for statutory tracking. The ICC will review and acknowledge within 7 working days.
          </p>

          <div style={{ background: 'linear-gradient(135deg, var(--color-navy-900), #1E3A5F)', padding: '1.25rem 2rem', borderRadius: 'var(--radius-sm)', display: 'inline-block', marginBottom: '2rem', color: '#fff' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: '0.25rem' }}>Reference ID</div>
            <strong style={{ fontSize: '1.75rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{submittedComplaint.referenceId}</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={() => navigate(`/student/complaints/${submittedComplaint.id}`)} className="btn btn-primary">Track Status</button>
            <button onClick={() => navigate('/student/dashboard')} className="btn btn-secondary">Back to Dashboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
