const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');

// Public base URL used inside QR codes. Falls back to the institutional domain
// when the deployment has not configured APP_BASE_URL, and always normalises
// to an absolute https:// URL so the QR is scannable from a PDF.
function publicBaseUrl() {
  let base = (config.APP_BASE_URL || 'https://vposh.vitap.ac.in').trim().replace(/\/+$/, '');
  if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base || 'https://vposh.vitap.ac.in';
}

const COLORS = {
  navy: '#0F172A', navyLight: '#1E293B', teal: '#0D9488',
  slate: '#475569', slateLight: '#94A3B8', slateMuted: '#CBD5E1',
  slateBg: '#F1F5F9', white: '#FFFFFF', red: '#DC2626', border: '#E2E8F0',
};

const F = { regular: 'Helvetica', bold: 'Helvetica-Bold' };

function genDocId() { return `VPOSH-DOC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; }
function genToken(cid, did) { return crypto.createHash('sha256').update(`${cid}:${did}:${Date.now()}`).digest('hex').slice(0, 32); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'; }
function fmtDateTime(d) { if (!d) return 'N/A'; const dt = new Date(d); return `${dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} * ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`; }
function initials(name) { return (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

async function fetchImg(p) {
  if (!p) return null;
  try {
    if (p.startsWith('data:')) return Buffer.from(p.split(',')[1], 'base64');
    // Remote avatars: never let a slow CDN hold the whole PDF request open on
    // a serverless host — fall back to the initials placeholder instead.
    if (p.startsWith('http')) {
      const r = await fetch(p, { signal: AbortSignal.timeout(3000) });
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    }
    if (fs.existsSync(p)) return fs.readFileSync(p);
  } catch {}
  return null;
}

async function qrBuf(data) {
  try { return await QRCode.toBuffer(data, { width: 120, margin: 1, color: { dark: COLORS.navy, light: COLORS.white } }); }
  catch { return null; }
}

// ─── PDF Builder ──────────────────────────────────────────────────────────────
function fmtStamp(d) {
  const dt = new Date(d);
  return `${dt.toISOString().slice(0, 10)} ${dt.toISOString().slice(11, 16)} UTC`;
}

class Doc {
  constructor(title, viewer) {
    this.docId = genDocId();
    this.verifyToken = null;
    // Who generated this copy — printed as a watermark and in the footer so a
    // leaked document can be traced back to the account that produced it.
    this.viewer = viewer && viewer.name ? viewer : { name: 'V-POSH System', role: 'system' };
    this.issuedAt = new Date();
    this.W = 595.28; this.H = 841.89; this.M = 50;
    this.cw = this.W - this.M * 2;
    this.pages = 0;
    this.doc = new PDFDocument({
      size: 'A4', bufferPages: true, autoFirstPage: false,
      margins: { top: this.M, bottom: this.M, left: this.M, right: this.M },
      info: { Title: title || 'V-POSH Document', Author: 'V-POSH * VIT-AP University', Creator: 'V-POSH Platform' },
    });
    this.doc.on('pageAdded', () => this.pages++);
  }

  newPage() { this.doc.addPage(); return this.M + 40; }

  secTitle(txt, y) {
    if (y > this.H - 120) { this.doc.addPage(); y = this.M + 40; }
    this.doc.font(F.bold).fontSize(9).fillColor(COLORS.teal).text(txt, this.M, y, { width: this.cw, lineBreak: false });
    const b = this.doc.y + 2;
    this.doc.save().moveTo(this.M, b).lineTo(this.M + 60, b).lineWidth(1.5).strokeColor(COLORS.teal).stroke().restore();
    return b + 12;
  }

  field(label, val, y, half, right) {
    const w = half ? this.cw / 2 : this.cw;
    const x = right ? this.M + this.cw / 2 : this.M;
    this.doc.font(F.regular).fontSize(7).fillColor(COLORS.slateLight).text(label, x, y, { width: w, lineBreak: false });
    this.doc.font(F.bold).fontSize(8.5).fillColor(COLORS.navy).text(val || 'N/A', x, y + 10, { width: w, lineBreak: false });
    return this.doc.y + 8;
  }

  body(txt, y) {
    this.doc.font(F.regular).fontSize(8.5).fillColor(COLORS.navyLight).text(txt || '', this.M, y, { width: this.cw, lineGap: 3 });
    return this.doc.y + 10;
  }

  gap(n) { if (this.doc.y + n > this.H - this.M - 30) { this.doc.addPage(); return this.M + 40; } return this.doc.y; }

  // Paint headers/footers AFTER all content (no cascade)
  paintHeadersFooters() {
    const total = this.doc.bufferedPageRange().count;
    for (let i = 0; i < total; i++) {
      this.doc.switchToPage(i);
      // Header
      const hy = this.M - 5;
      this.doc.font(F.bold).fontSize(10).fillColor(COLORS.navy)
        .text('VIT-AP University', this.M, hy, { width: 200, lineBreak: false });
      this.doc.font(F.bold).fontSize(14).fillColor(COLORS.teal)
        .text('V-POSH', this.W - this.M - 100, hy, { width: 100, align: 'right', lineBreak: false });
      this.doc.font(F.regular).fontSize(7).fillColor(COLORS.slateLight)
        .text('POSH Awareness & Complaint Management Platform', this.M, hy + 14, { width: 200, lineBreak: false });
      this.doc.save().moveTo(this.M, hy + 28).lineTo(this.W - this.M, hy + 28)
        .lineWidth(0.5).strokeColor(COLORS.teal).stroke().restore();

      // Watermark — identifies the generated copy on every page.
      const stamp = `${this.viewer.name} • ${(this.viewer.role || 'user').toUpperCase()} • ${fmtStamp(this.issuedAt)} • ${this.docId}`;
      this.doc.save();
      this.doc.fillColor(COLORS.navy).fillOpacity(0.07).font(F.bold).fontSize(26);
      this.doc.rotate(-28, { origin: [this.W / 2, this.H / 2] });
      this.doc.text(stamp, 0, this.H / 2 - 14, { width: this.W, align: 'center', lineBreak: false });
      this.doc.restore();

      // Footer
      const fy = this.H - this.M - 10;
      this.doc.save().moveTo(this.M, fy - 10).lineTo(this.W - this.M, fy - 10)
        .lineWidth(0.3).strokeColor(COLORS.slateMuted).stroke().restore();
      this.doc.font(F.regular).fontSize(6.5).fillColor(COLORS.slateLight)
        .text('V-POSH * VIT-AP University', this.M, fy, { width: 200, lineBreak: false });
      this.doc.font(F.bold).fontSize(6).fillColor(COLORS.red)
        .text('STRICTLY CONFIDENTIAL', 0, fy, { width: this.W, align: 'center', lineBreak: false });
      this.doc.font(F.regular).fontSize(6.5).fillColor(COLORS.slateLight)
        .text(`Page ${i + 1} of ${total}`, this.W - this.M - 80, fy, { width: 80, align: 'right', lineBreak: false });
      this.doc.font(F.regular).fontSize(6).fillColor(COLORS.slateLight)
        .text(`Copy generated for ${this.viewer.name} (${this.viewer.role || 'user'}) on ${fmtStamp(this.issuedAt)}`, this.M, fy + 8, { width: this.cw, align: 'left', lineBreak: false });
    }
  }

  buf() {
    return new Promise(resolve => {
      const c = [];
      this.doc.on('data', d => c.push(d));
      this.doc.on('end', () => resolve(Buffer.concat(c)));
      this.doc.end();
    });
  }
}

function placeholder(d, x, y, sz, user) {
  d.doc.save().circle(x + sz / 2, y + sz / 2, sz / 2).fill(COLORS.slateBg).restore();
  d.doc.font(F.bold).fontSize(14).fillColor(COLORS.teal).text(initials(user?.name), x, y + sz / 2 - 8, { width: sz, align: 'center' });
}

// ─── TYPE 1: Complaint Acknowledgement ───────────────────────────────────────
async function generateAcknowledgement(complaint, user, viewer) {
  const d = new Doc(`Complaint Acknowledgement - ${complaint.referenceId}`, viewer);
  d.verifyToken = genToken(complaint.id, d.docId);
  let y = d.newPage();

  // Title
  d.doc.font(F.bold).fontSize(16).fillColor(COLORS.navy).text('COMPLAINT ACKNOWLEDGEMENT', d.M, y, { width: d.cw, align: 'center' });
  y = d.doc.y + 12;

  // Reference bar
  d.doc.save().rect(d.M, y, d.cw, 40).fill(COLORS.teal).restore();
  d.doc.font(F.bold).fontSize(18).fillColor(COLORS.white).text(complaint.referenceId, d.M, y + 10, { width: d.cw, align: 'center' });
  y += 50;

  // Status
  d.doc.font(F.regular).fontSize(8).fillColor(COLORS.slateLight).text('Current Status', d.M, y, { width: d.cw, align: 'center' });
  d.doc.font(F.bold).fontSize(11).fillColor(COLORS.navy).text((complaint.status || '').toUpperCase(), d.M, y + 10, { width: d.cw, align: 'center' });
  y = d.doc.y + 18;

  // Complainant
  y = d.secTitle('COMPLAINANT INFORMATION', y);
  const img = await fetchImg(user?.avatar);
  const ps = 55;
  if (img) { try { d.doc.image(img, d.M, y, { width: ps, height: ps, fit: [ps, ps] }); } catch { placeholder(d, d.M, y, ps, user); } }
  else placeholder(d, d.M, y, ps, user);
  d.doc.save().rect(d.M - 1, y - 1, ps + 2, ps + 2).lineWidth(0.5).strokeColor(COLORS.teal).stroke().restore();

  const ix = d.M + ps + 15, iw = d.cw - ps - 15;
  d.doc.font(F.bold).fontSize(9).fillColor(COLORS.navy).text(user?.name || 'N/A', ix, y, { width: iw, lineBreak: false });
  d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.slateLight).text('COMPLAINANT', ix, y + 12, { width: iw, lineBreak: false });
  d.doc.font(F.regular).fontSize(8).fillColor(COLORS.slate);
  d.doc.text(`Student ID: ${user?.studentId || 'N/A'}`, ix, y + 26, { width: iw, lineBreak: false });
  d.doc.text(`Department: ${user?.department || 'N/A'}`, ix, y + 37, { width: iw, lineBreak: false });
  d.doc.text(`Year: ${user?.year || 'N/A'}`, ix, y + 48, { width: iw, lineBreak: false });
  y = y + ps + 14;

  // Complaint Info
  y = d.secTitle('COMPLAINT INFORMATION', y);
  y = d.field('Complaint Reference', complaint.referenceId, y, true);
  y = d.field('Submitted On', fmtDate(complaint.createdAt), y, true, true);
  y = d.field('Category', complaint.category, y, true);
  y = d.field('Priority', complaint.priority, y, true, true);
  y = d.field('Incident Date', complaint.incidentDate, y, true);
  y = d.field('Incident Location', complaint.incidentLocation, y, true, true);
  if (complaint.respondentName && complaint.respondentName !== 'Not Disclosed') {
    y = d.field('Respondent Name', complaint.respondentName, y, true);
    y = d.field('Respondent Department', complaint.respondentDept, y, true, true);
  }

  // Confidentiality
  y = d.gap(80);
  y = d.secTitle('CONFIDENTIALITY NOTICE', y);
  d.doc.save().rect(d.M, y, d.cw, 50).fill(COLORS.slateBg).restore();
  d.doc.font(F.bold).fontSize(8).fillColor(COLORS.red).text('CONFIDENTIAL DOCUMENT', d.M + 10, y + 8, { width: d.cw - 20, lineBreak: false });
  d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.slate).text(
    'This document contains information relating to a confidential grievance proceeding. It is intended only for authorized use and must be handled in accordance with applicable institutional privacy and confidentiality requirements under the POSH Act, 2013.',
    d.M + 10, y + 20, { width: d.cw - 20, lineGap: 2 }
  );
  y = d.doc.y + 12;

  // QR
  if (!addSectionToPage(d, y, 90)) { y = d.newPage(); }
  y = d.gap(d.M + 40);
  const qr = await qrBuf(`${publicBaseUrl()}/verify/${complaint.referenceId}?doc=${d.docId}&token=${d.verifyToken}`);
  if (qr) {
    d.doc.image(qr, d.M + (d.cw - 60) / 2, y, { width: 60, height: 60 });
    d.doc.font(F.bold).fontSize(7).fillColor(COLORS.navy).text('Document Verification', d.M, y + 65, { width: d.cw, align: 'center', lineBreak: false });
    d.doc.font(F.regular).fontSize(6.5).fillColor(COLORS.slateLight).text(d.docId, d.M, y + 76, { width: d.cw, align: 'center', lineBreak: false });
  }

  d.paintHeadersFooters();
  return { buffer: await d.buf(), docId: d.docId, verifyToken: d.verifyToken, filename: `VPOSH_${complaint.referenceId}_Complaint_Acknowledgement.pdf` };
}

// ─── TYPE 2: Case Status Report ──────────────────────────────────────────────
async function generateStatusReport(complaint, user, history = [], updates = [], viewer) {
  const d = new Doc(`Case Status Report - ${complaint.referenceId}`, viewer);
  d.verifyToken = genToken(complaint.id, d.docId);
  let y = d.newPage();

  d.doc.font(F.bold).fontSize(16).fillColor(COLORS.navy).text('CASE STATUS REPORT', d.M, y, { width: d.cw, align: 'center' });
  y = d.doc.y + 10;
  d.doc.save().rect(d.M, y, d.cw, 36).fill(COLORS.teal).restore();
  d.doc.font(F.bold).fontSize(16).fillColor(COLORS.white).text(complaint.referenceId, d.M, y + 8, { width: d.cw, align: 'center' });
  y += 44;
  d.doc.font(F.regular).fontSize(8).fillColor(COLORS.slateLight).text('Status', d.M, y, { width: d.cw, align: 'center' });
  d.doc.font(F.bold).fontSize(10).fillColor(COLORS.navy).text((complaint.status || '').toUpperCase(), d.M, y + 10, { width: d.cw, align: 'center' });
  y = d.doc.y + 16;

  // Complainant
  y = d.secTitle('COMPLAINANT INFORMATION', y);
  const img = await fetchImg(user?.avatar);
  const ps = 50;
  if (img) { try { d.doc.image(img, d.M, y, { width: ps, height: ps, fit: [ps, ps] }); } catch { placeholder(d, d.M, y, ps, user); } }
  else placeholder(d, d.M, y, ps, user);
  const ix = d.M + ps + 12;
  d.doc.font(F.bold).fontSize(9).fillColor(COLORS.navy).text(user?.name || 'N/A', ix, y, { width: d.cw - ps - 12, lineBreak: false });
  d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.slateLight).text('COMPLAINANT', ix, y + 12, { lineBreak: false });
  d.doc.font(F.regular).fontSize(8).fillColor(COLORS.slate)
    .text(`ID: ${user?.studentId || 'N/A'}  |  Dept: ${user?.department || 'N/A'}  |  Year: ${user?.year || 'N/A'}`, ix, y + 24, { width: d.cw - ps - 12, lineBreak: false });
  y = y + ps + 12;

  // Complaint Info
  y = d.secTitle('COMPLAINT INFORMATION', y);
  y = d.field('Reference', complaint.referenceId, y, true);
  y = d.field('Submitted', fmtDate(complaint.createdAt), y, true, true);
  y = d.field('Category', complaint.category, y, true);
  y = d.field('Priority', complaint.priority, y, true, true);
  y = d.field('Incident Date', complaint.incidentDate, y, true);
  y = d.field('Location', complaint.incidentLocation, y, true, true);
  if (complaint.respondentName && complaint.respondentName !== 'Not Disclosed') {
    y = d.field('Respondent', complaint.respondentName, y, true);
    y = d.field('Respondent Dept', complaint.respondentDept, y, true, true);
  }

  // Statement
  y = d.secTitle('COMPLAINT STATEMENT', y);
  y = d.body(complaint.description, y);

  // Timeline
  y = d.gap(60);
  y = d.secTitle('STATUS TIMELINE', y);
  const statuses = ['Submitted', 'Acknowledged', 'Under Review', 'Investigation', 'Action Taken', 'Resolved'];
  const ci = statuses.indexOf(complaint.status);
  for (let i = 0; i < statuses.length; i++) {
    y = d.gap(20);
    const done = i <= ci, cur = i === ci, dx = d.M + 8;
    if (i < statuses.length - 1) {
      d.doc.save().moveTo(dx, y + 5).lineTo(dx, y + 18).lineWidth(0.8)
        .strokeColor(done ? COLORS.teal : COLORS.slateMuted).stroke().restore();
    }
    d.doc.save().circle(dx, y + (cur ? 4 : 3), cur ? 4 : 3).fill(done ? COLORS.teal : COLORS.slateMuted).restore();
    d.doc.font(cur ? F.bold : F.regular).fontSize(8).fillColor(done ? COLORS.navy : COLORS.slateLight)
      .text(statuses[i], dx + 14, y, { width: d.cw - 20, lineBreak: false });
    y += 18;
  }

  // History
  if (history.length) {
    y = d.gap(40); y = d.secTitle('STATUS HISTORY', y);
    for (const h of history) {
      y = d.gap(35);
      d.doc.font(F.bold).fontSize(8).fillColor(COLORS.navy).text(h.newStatus || 'Unknown', d.M, y, { width: d.cw, lineBreak: false });
      d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.slate).text(h.comment || '', d.M, y + 10, { width: d.cw, lineGap: 1 });
      d.doc.font(F.regular).fontSize(7).fillColor(COLORS.slateLight)
        .text(`Recorded by ${h.changedByName || 'System'} (${h.changedByRole || ''}) * ${fmtDateTime(h.createdAt)}`, d.M, y + 22, { width: d.cw, lineBreak: false });
      y = d.doc.y + 10;
    }
  }

  // Official comms
  const pu = updates.filter(u => u.isPublic);
  if (pu.length) {
    y = d.gap(40); y = d.secTitle('OFFICIAL COMMITTEE COMMUNICATIONS', y);
    for (const u of pu) {
      y = d.gap(40);
      d.doc.save().rect(d.M, y, d.cw, 1).fill(COLORS.border).restore();
      y += 6;
      d.doc.font(F.bold).fontSize(8).fillColor(COLORS.navy).text(u.authorName || 'Unknown', d.M, y, { width: d.cw, lineBreak: false });
      d.doc.font(F.regular).fontSize(7).fillColor(COLORS.slateLight)
        .text(`${u.authorRole || ''} * ${fmtDateTime(u.createdAt)}`, d.M, y + 10, { width: d.cw, lineBreak: false });
      d.doc.font(F.regular).fontSize(8).fillColor(COLORS.navyLight).text(u.updateText || '', d.M, y + 22, { width: d.cw, lineGap: 2 });
      y = d.doc.y + 8;
    }
  }

  // ICC Procedure & Rules & Regulations
  y = d.gap(40);
  if (y > d.H - 120) { y = d.newPage(); }
  y = d.secTitle('ICC PROCEDURE & RULES & REGULATIONS', y);
  y = renderRulesBlock(d, y, complaint);

  // ── PAGE 2+: POSH ACT GUIDELINES ──────────────────────────────────────
  y = d.gap(40);
  if (y > d.H - 150) { y = d.newPage(); }
  y = d.secTitle('GUIDELINES UNDER THE POSH ACT, 2013', y);

  const guidelines = [
    {
      heading: 'Section 4 — Constitution of Internal Complaints Committee',
      body: 'Every employer having ten or more employees shall constitute an Internal Complaints Committee (ICC) at each office or branch. The ICC shall consist of a presiding officer who shall be a woman employed at a senior level, and not less than two members from amongst employees who are committed to the cause of women or who have experience in social work or have legal knowledge. One member shall be from a non-governmental organisation or association committed to the cause of women or a person familiar with issues relating to sexual harassment.',
    },
    {
      heading: 'Section 6 — Powers of the ICC',
      body: 'The ICC shall have the same powers as are vested in a civil court under the Code of Civil Procedure, 1908, when trying a suit, in respect of the following matters: summoning and examining any person on oath; requiring the discovery and production of documents; and any other matter which may be prescribed. The ICC shall prepare an annual report of the complaints received and the outcome of the inquiry and submit it to the employer.',
    },
    {
      heading: 'Section 9 — Complaint of Sexual Harassment',
      body: 'Any woman employed in an establishment may make a complaint of sexual harassment to the ICC within a period of three months from the date of the incident. In case of a series of incidents, within three months from the date of the last incident. The ICC may, for the reasons to be recorded in writing, extend the time limit by a further three months if it is satisfied that the circumstances were such which prevented the woman from filing the complaint.',
    },
    {
      heading: 'Section 11 — Inquiry into Complaint',
      body: 'Upon receipt of a complaint, the ICC shall proceed to make an inquiry in the manner prescribed. The ICC shall forward a copy of the complaint to the respondent within seven working days. The respondent shall file his written reply within ten working days from the receipt of the complaint. The inquiry shall be completed within ninety days from the receipt of the complaint. The ICC shall forward its inquiry report to the employer within ten days from the date of completion of the inquiry.',
    },
    {
      heading: 'Section 13 — Inquiry Process',
      body: 'The inquiry process shall follow principles of natural justice. Both the complainant and the respondent shall have the right to be accompanied by a support person of their choice during the proceedings. The proceedings shall be conducted in a fair and impartial manner. The identity of the complainant, respondent, and witnesses shall be kept confidential at all stages of the inquiry.',
    },
    {
      heading: 'Section 14 — Penalties for Non-compliance',
      body: 'Where the employer fails to constitute an Internal Complaints Committee under sub-section (1) of section 4, or defaults in constituting or reconstituting the ICC, or fails to take action under section 13, the employer shall be punishable with a fine of up to fifty thousand rupees. Any subsequent conviction shall be punishable with imprisonment of up to three years or with both. Repeated non-compliance may lead to cancellation of licence or registration.',
    },
    {
      heading: 'Section 16 — Prohibition of Disclosure of Identity',
      body: 'No person, including the ICC or any member thereof, the employer, any internal or external committee, the police, or any authority, shall publish or communicate or cause to be published or communicated, the identity and address of the complainant, the respondent, or the witnesses. Any person who contravenes this provision shall be liable for a penalty as may be prescribed under the Act.',
    },
    {
      heading: "Section 19 \u2014 Employer's Duty to Display Notice",
      body: 'Every employer shall at conspicuous places in the workplace, publish the penal consequences of sexual harassment and the order constituted under the ICC. The notice shall be in English and in the language understood at the place of work. The employer shall also forward a copy of the ICC composition and the ICC charter to the District Officer and shall also incorporate the same in the standing orders under the Industrial Employment (Standing Orders) Act, 1946.',
    },
    {
      heading: "Section 22 \u2014 Employer's Responsibility",
      body: 'It shall be the duty of the employer to provide a safe working environment to all employees. The employer shall ensure that the employees are provided with the necessary facilities as prescribed, including the constitution of the ICC, disclosure of penal consequences, and undertaking awareness programmes. The employer shall also ensure that no retaliation or adverse action is taken against the complainant or witnesses.',
    },
  ];

  for (const g of guidelines) {
    const estH = 20 + g.body.split(' ').length * 2.5;
    if (y + estH > d.H - d.M - 30) { y = d.newPage(); }
    d.doc.font(F.bold).fontSize(8).fillColor(COLORS.teal).text(g.heading, d.M, y, { width: d.cw, lineBreak: false });
    y = d.doc.y + 3;
    d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.navyLight).text(g.body, d.M, y, { width: d.cw, lineGap: 2 });
    y = d.doc.y + 8;
  }

  // ── PAGE 3+: RIGHTS & REMEDIES ────────────────────────────────────────
  y = d.gap(40);
  if (y > d.H - 150) { y = d.newPage(); }
  y = d.secTitle('RIGHTS OF THE COMPLAINANT & REMEDIES', y);

  const rights = [
    {
      heading: 'Right to File a Complaint',
      body: 'Any woman who has been subjected to sexual harassment at the workplace has the right to file a complaint with the ICC. The complaint may be filed in writing within three months of the incident. If the complainant is unable to make a complaint in writing, any member of the ICC shall render all reasonable assistance to make the complaint in writing. The ICC may also initiate suo motu proceedings if the complainant is unable to file a complaint due to any reason.',
    },
    {
      heading: 'Right to Interim Relief',
      body: 'Pending the completion of the inquiry, the ICC may recommend to the employer to implement the following interim measures: (a) Transfer of the complainant or the respondent to any other workplace; (b) Grant of leave to the complainant for a period of three months; (c) Restraint on the respondent from reporting any assessment or performance of the complainant; (d) Any other relief as may be appropriate under the circumstances.',
    },
    {
      heading: 'Right to Compensation',
      body: 'Where the ICC arrives at a conclusion that sexual harassment has taken place, it shall recommend to the employer that the respondent be liable to pay such compensation as may be determined. The compensation shall be paid to the complainant and shall take into account: (i) the mental pain, suffering, and emotional distress; (ii) loss in career opportunities; (iii) medical expenses incurred; (iv) the financial status of the respondent; and (v) the feasibility of payment of lump sum compensation.',
    },
    {
      heading: 'Right Against Retaliation',
      body: 'No woman shall be subjected to victimisation or retaliation for filing a complaint or participating in proceedings under the POSH Act. Any adverse action taken against the complainant, witness, or any person who assists in the complaint shall be treated as a separate violation. The employer shall ensure that no termination, demotion, or unfavourable transfer is made as a consequence of the complaint.',
    },
    {
      heading: 'Right to Conciliation',
      body: 'Before the commencement of the inquiry, the ICC may, at the request of the complainant, attempt to settle the matter through conciliation. The settlement arrived at through conciliation shall be signed by the complainant and the respondent and shall be forwarded to the employer. No monetary settlement shall be made as a basis for conciliation. If conciliation fails, the ICC shall proceed with the inquiry.',
    },
    {
      heading: 'Right to an Appeal',
      body: 'Either party aggrieved by the outcome of the inquiry or any recommendation of the ICC may prefer an appeal to the court or tribunal in accordance with the provisions of the service rules applicable or the Industrial Disputes Act, 1947. The appeal shall be filed within ninety days of the recommendation.',
    },
  ];

  for (const r of rights) {
    const estH = 20 + r.body.split(' ').length * 2.5;
    if (y + estH > d.H - d.M - 30) { y = d.newPage(); }
    d.doc.font(F.bold).fontSize(8).fillColor(COLORS.teal).text(r.heading, d.M, y, { width: d.cw, lineBreak: false });
    y = d.doc.y + 3;
    d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.navyLight).text(r.body, d.M, y, { width: d.cw, lineGap: 2 });
    y = d.doc.y + 8;
  }

  // ── PAGE: EMPLOYER OBLIGATIONS & INSTITUTIONAL POLICY ─────────────────
  y = d.gap(40);
  if (y > d.H - 150) { y = d.newPage(); }
  y = d.secTitle('EMPLOYER OBLIGATIONS & INSTITUTIONAL POLICY', y);

  const obligations = [
    {
      heading: 'Workplace Definition (Section 2(n))',
      body: 'For the purposes of the POSH Act, "workplace" includes any place visited by the employee arising out of or during the course of employment, including transportation provided by the employer for commuting to and from the place of employment. It covers educational institutions, hospitals, sports institutions, and any other place where the employer has control or influence.',
    },
    {
      heading: 'Annual Reporting Requirement',
      body: 'Every employer shall prepare an annual report as prescribed under Section 21 of the POSH Act and submit it to the District Officer. The report shall contain: (a) the number of complaints of sexual harassment received; (b) the number of complaints disposed of; (c) the number of cases pending for more than ninety days; and (d) the number of workshops or awareness programmes conducted. The employer shall also make the annual report available to all employees.',
    },
    {
      heading: 'Mandatory Training & Awareness',
      body: 'The employer shall organise regular workshops and awareness programmes at regular intervals to sensitise employees about the provisions of the POSH Act and the penal consequences. Such programmes shall be conducted for all employees including senior management, the ICC members, and contract workers. The training shall cover the definition of sexual harassment, the complaint procedure, and the duties of the ICC.',
    },
    {
      heading: 'Internal Policy Requirements',
      body: 'The institution shall formulate and continuously update a comprehensive anti-sexual harassment policy. The policy shall include: (a) a clear definition of sexual harassment with examples; (b) the procedure for filing and processing complaints; (c) the composition and role of the ICC; (d) the measures for prevention; (e) the disciplinary action for perpetrators; (f) the protection mechanisms for complainants and witnesses; and (g) the consequences of false or malicious complaints.',
    },
    {
      heading: 'V-POSH Platform Commitment',
      body: 'V-POSH (VIT-AP Prevention of Sexual Harassment) is the institutional digital platform of VIT-AP University designed to facilitate the reporting, tracking, and redressal of sexual harassment complaints in full compliance with the POSH Act, 2013 and the UGC (Prevention, Prohibition and Redressal of Sexual Harassment of Women Students and Employees in Higher Educational Institutions) Regulations, 2015. This platform ensures confidentiality, transparency, and timely resolution of all complaints.',
    },
    {
      heading: 'Contact & Emergency Helpline',
      body: 'In case of emergency or for immediate assistance, the following resources are available:\nV-POSH Cell Email: vposh@vitap.ac.in\nEmergency Helpline: +91 863-2377777 / 1800-112-9900\nPOSH Policy Version: V-POSH Policy v2026.1\nInstitution: VIT-AP University, Amaravati, Andhra Pradesh\nFor more information, visit: https://vposh.vitap.ac.in/awareness',
    },
  ];

  for (const ob of obligations) {
    const estH = 20 + ob.body.split(' ').length * 2.5;
    if (y + estH > d.H - d.M - 30) { y = d.newPage(); }
    d.doc.font(F.bold).fontSize(8).fillColor(COLORS.teal).text(ob.heading, d.M, y, { width: d.cw, lineBreak: false });
    y = d.doc.y + 3;
    d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.navyLight).text(ob.body, d.M, y, { width: d.cw, lineGap: 2 });
    y = d.doc.y + 8;
  }

  // Confidentiality
  if (!addSectionToPage(d, y, 70)) { y = d.newPage(); }
  y = d.gap(d.M + 40);
  y = d.secTitle('CONFIDENTIALITY NOTICE', y);
  d.doc.save().rect(d.M, y, d.cw, 42).fill(COLORS.slateBg).restore();
  d.doc.font(F.bold).fontSize(8).fillColor(COLORS.red).text('CONFIDENTIAL DOCUMENT', d.M + 10, y + 8, { width: d.cw - 20, lineBreak: false });
  d.doc.font(F.regular).fontSize(7.5).fillColor(COLORS.slate).text(
    'This document contains information relating to a confidential grievance proceeding. It is intended only for authorized use and must be handled in accordance with applicable institutional privacy and confidentiality requirements under the POSH Act, 2013.',
    d.M + 10, y + 18, { width: d.cw - 20, lineGap: 2 }
  );
  y = d.doc.y + 12;

  // QR
  if (!addSectionToPage(d, y, 90)) { y = d.newPage(); }
  y = d.gap(d.M + 40);
  const qr = await qrBuf(`${publicBaseUrl()}/verify/${complaint.referenceId}?doc=${d.docId}&token=${d.verifyToken}`);
  if (qr) {
    d.doc.image(qr, d.M + (d.cw - 60) / 2, y, { width: 60, height: 60 });
    d.doc.font(F.bold).fontSize(7).fillColor(COLORS.navy).text('Document Verification', d.M, y + 65, { width: d.cw, align: 'center', lineBreak: false });
    d.doc.font(F.regular).fontSize(6.5).fillColor(COLORS.slateLight).text(d.docId, d.M, y + 76, { width: d.cw, align: 'center', lineBreak: false });
    y = d.doc.y + 10;
  }

  // Contact
  if (!addSectionToPage(d, y, 28)) { y = d.newPage(); }
  d.doc.font(F.bold).fontSize(8).fillColor(COLORS.navy).text('V-POSH * VIT-AP University', d.M, y, { width: d.cw, align: 'center', lineBreak: false });
  d.doc.font(F.regular).fontSize(7).fillColor(COLORS.slate)
    .text('Email: vposh@vitap.ac.in  |  Helpline: +91 863-2377777 / 1800-112-9900', d.M, y + 12, { width: d.cw, align: 'center', lineBreak: false });

  d.paintHeadersFooters();
  return { buffer: await d.buf(), docId: d.docId, verifyToken: d.verifyToken, filename: `VPOSH_${complaint.referenceId}_Case_Status_Report.pdf` };
}

// ─── Document Store ──────────────────────────────────────────────────────────
function addSectionToPage(d, y, needed) {
  // Returns true when the remaining vertical space on the current page is
  // enough for a section of at least `needed` pts. Callers use this to
  // decide whether to start a fresh page so section headers are never
  // orphaned at the bottom of a page.
  return y + needed <= d.H - d.M - 20;
}

function renderRulesBlock(d, y, complaint) {
  const rules = [
    {
      heading: 'How This Complaint Was Received',
      body: [
        'This complaint was submitted through the V-POSH platform of VIT-AP University, the institutional grievance portal constituted to receive and redress complaints of sexual harassment in accordance with the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 (the \"POSH Act\") and the rules made thereunder.',
        'On submission, the complaint was time-stamped and assigned a unique reference ID for statutory tracking. The Internal Complaints Committee (ICC) is required to acknowledge receipt of the complaint within seven (7) working days and to commence preliminary scrutiny and, where appropriate, formal inquiry proceedings.',
      ],
    },
    {
      heading: 'Confidentiality & Privacy',
      body: [
        'All disclosures, identity markers, and evidence relating to this complaint remain strictly confidential. Access is restricted solely to the members of the ICC entrusted with the inquiry and to such other persons as may be required for the limited purpose of conducting the inquiry or implementing any recommendation.',
        'The identity of the complainant and of any witness shall not be disclosed to the respondent or to any other person except to the extent strictly necessary for the conduct of the inquiry, and only through the ICC.',
      ],
    },
    {
      heading: 'Interim Relief',
      body: [
        'Pending the completion of the inquiry, the ICC may, at the request of the complainant or on its own motion, recommend interim measures including, without limitation, transfer of the complainant or the respondent to any other workplace, department, or academic unit, or the grant of leave to the aggrieved woman up to a period of three months, or such other relief as may be appropriate under the circumstances.',
        'No such interim measure shall be construed as a presumption of guilt, nor shall it be used to penalise either party.',
      ],
    },
    {
      heading: 'Inquiry & Timeline',
      body: [
        'Upon acknowledgment, the ICC conducts a preliminary assessment of the complaint. If the complaint discloses a prima facie case of sexual harassment, the ICC proceeds to a formal inquiry. The inquiry is to be completed within ninety (90) days of its commencement, or within such extended period as the ICC may determine on recording reasons.',
        'The ICC shall provide the complainant and the respondent a fair and reasonable opportunity to be heard and to present evidence and witnesses. The inquiry shall be conducted in a manner that respects the dignity and privacy of the complainant.',
      ],
    },
    {
      heading: 'Action on Conclusion of Inquiry',
      body: [
        'If the ICC concludes that sexual harassment has been committed, it shall recommend to the employer/institution the action that is necessary and appropriate, which may include disciplinary action, deduction of salary, mandatory counselling, or such other measures as may be warranted.',
        'The ICC may also recommend that the respondent be liable to pay such compensation as may be determined, and that action be taken under the applicable service rules or institutional regulations.',
        'The report of the ICC and its recommendations are forwarded to the competent authority for action within sixty (60) days of the conclusion of the inquiry.',
      ],
    },
    {
      heading: 'Prohibition of Victimization',
      body: [
        'No person shall be subjected to any kind of victimization or unfair treatment by the employer or by any other person in connection with the making of a complaint under the POSH Act or in the course of an inquiry.',
        'Any act of victimization, retaliation, or intimidation against the complainant or any witness is itself a violation and shall be dealt with as a separate grievance under the same procedures.',
      ],
    },
    {
      heading: 'False or Malicious Complaints',
      body: [
        'Where the ICC concludes that the allegation of sexual harassment has not been proved, no action shall be taken against the complainant. However, if the inquiry establishes that the complaint was malicious, was knowingly false, or was made with the intent to defame or to humiliate, the ICC may recommend action against the complainant in accordance with applicable service rules or institutional policy.',
        'An action to counter a malicious or knowingly false complaint does not, by itself, discourage or deter genuine complaints made in good faith.',
      ],
    },
  ];

  const ruleH = 9;
  const ruleGap = 6;
  const ruleTextGap = 4;
  const left = d.M;
  const width = d.cw;
  const fontSize = 8.5;

  d.doc.font(F.regular).fontSize(fontSize);

  for (const rule of rules) {
    // Determine whether the heading itself fits on the current page.
    if (y + ruleH + 2 > d.H - d.M - 20) {
      y = d.newPage();
    }
    d.doc.font(F.bold).fontSize(ruleH).fillColor(COLORS.teal)
      .text(rule.heading.toUpperCase(), left, y, { width });
    y = d.doc.y + ruleGap;
    if (y > d.H - d.M - 20) { y = d.newPage(); }
    d.doc.font(F.regular).fontSize(fontSize).fillColor(COLORS.navyLight);
    for (const para of rule.body) {
      // Compute lines that fit the width WITHOUT breaking words.
      // pdfkit's text() with a width can break long words; we avoid that
      // by pre-splitting on spaces and only wrapping at space boundaries.
      const lines = wrapLines(d, para, width);
      if (lines.length === 0) continue;
      // If the block won't fit, move to next page.
      if (y + fontSize * lines.length + (lines.length - 1) * 2.5 + 6 > d.H - d.M - 20) {
        y = d.newPage();
      }
      for (const line of lines) {
        if (y + fontSize + 4 > d.H - d.M - 20) { y = d.newPage(); }
        // Render each pre-wrapped line as a single line. We MUST pass
        // lineBreak: false so pdfkit does not attempt its own wrapping
        // (which breaks words with negative spacing in the TJ array).
        // We also omit width entirely — with lineBreak: false and no width
        // pdfkit renders the string exactly as given on one line.
        d.doc.text(line, left, y, { lineBreak: false, lineGap: 2.5 });
        y = d.doc.y;
      }
      y += ruleTextGap;
    }
    d.doc.save().moveTo(left, y).lineTo(left + width, y)
      .lineWidth(0.4).strokeColor(COLORS.slateMuted).stroke();
    y += 10;
  }
  return d.doc.y;
}

function wrapLines(d, text, width) {
  // Wrap `text` to `width` using only space boundaries (never break a word).
  // Uses pdfkit's widthOfString for measurement.
  d.doc.font(F.regular).fontSize(8.5);
  const out = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') { out.push(''); continue; }
    const words = paragraph.split(' ');
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = line + ' ' + words[i];
      if (d.doc.widthOfString(candidate) <= width) {
        line = candidate;
      } else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out;
}

const store = new Map();
function storeDocument(id, data) { store.set(id, { ...data, createdAt: new Date().toISOString(), status: 'active' }); }
function getDocument(id) { return store.get(id) || null; }
function revokeDocument(id) { const d = store.get(id); if (d) d.status = 'revoked'; }

module.exports = { generateAcknowledgement, generateStatusReport, storeDocument, getDocument, revokeDocument, genDocId, COLORS };
