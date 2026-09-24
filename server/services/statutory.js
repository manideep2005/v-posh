// POSH statutory clock engine.
//
// Every deadline below comes from the Sexual Harassment of Women at Workplace
// (Prevention, Prohibition and Redressal) Act, 2013. The engine is pure: it
// derives milestones from a complaint document so the same numbers appear in
// the student tracker, the ICC workspace, the super-admin dashboard and the
// escalation sweep.

const DAY = 24 * 60 * 60 * 1000;

// Statuses that mean "the inquiry has actually started".
const INQUIRY_STATUSES = ['Under Review', 'Investigation', 'Action Taken', 'Resolved'];
const CLOSED = 'Resolved';

const MILESTONES = [
  {
    key: 'filingWindow',
    label: 'Filing window',
    legalRef: '§9 — within 3 months of the incident',
    // Informational: measured against the incident date rather than receipt.
    from: 'incidentDate',
    days: 90,
    applies: () => true,
  },
  {
    key: 'acknowledgement',
    label: 'Acknowledgement to complainant',
    legalRef: '§11(2) — ICC must acknowledge receipt',
    from: 'createdAt',
    days: 7,
    // Met as soon as the case moves past "Submitted".
    metWhen: (c) => c.status !== 'Submitted',
  },
  {
    key: 'respondentNotice',
    label: 'Copy of complaint to respondent',
    legalRef: '§11(1) — forward within 7 working days',
    from: 'createdAt',
    days: 7,
    metWhen: (c) => INQUIRY_STATUSES.includes(c.status),
  },
  {
    key: 'inquiry',
    label: 'Inquiry completion',
    legalRef: '§11(4) — within 90 days (extendable once, with reasons)',
    from: 'createdAt',
    days: 90,
    extendable: true,
    metWhen: (c) => c.status === CLOSED || c.status === 'Action Taken',
  },
  {
    key: 'report',
    label: 'Inquiry report to employer',
    legalRef: '§13(1) — within 10 days of completing the inquiry',
    from: 'inquiryCompletedAt',
    days: 10,
    onlyWhenStarted: true,
    metWhen: (c) => c.status === 'Action Taken' || c.status === CLOSED,
  },
  {
    key: 'employerAction',
    label: 'Employer action on recommendation',
    legalRef: '§13(3) — within 60 days of the report',
    from: 'inquiryCompletedAt',
    days: 70, // 10 days for the report + 60 days for action
    onlyWhenStarted: true,
    metWhen: (c) => c.status === 'Action Taken' || c.status === CLOSED,
  },
];

function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / DAY);
}

/**
 * Build the statutory milestone list for one complaint.
 * @param {object} complaint
 * @param {Array}  history  optional statusHistory rows (used for metAt timestamps)
 * @returns {{milestones: Array, health: object}}
 */
function statutoryMilestones(complaint, history = []) {
  if (!complaint || !complaint.createdAt) return { milestones: [], health: { state: 'unknown' } };

  const now = new Date();
  const extensionDays = Number(complaint.inquiryExtensionDays || 0);
  const completedAt = complaint.resolvedAt || complaint.inquiryCompletedAt || null;

  // When was the inquiry completed? Prefer an explicit stamp, else the moment
  // the case first reached a terminal status in its history.
  let inquiryCompletedAt = complaint.inquiryCompletedAt || complaint.resolvedAt;
  if (!inquiryCompletedAt && history.length) {
    const closing = history.find(h => h.newStatus === CLOSED || h.newStatus === 'Action Taken');
    if (closing) inquiryCompletedAt = closing.createdAt;
  }

  const milestones = MILESTONES.map(spec => {
    if (spec.onlyWhenStarted && !inquiryCompletedAt && !['Action Taken', CLOSED].includes(complaint.status)) {
      return null; // not yet triggered — do not invent a deadline
    }

    const base = spec.from === 'incidentDate' ? complaint.incidentDate : complaint.createdAt;
    if (!base) return null;

    let dueAt = addDays(base, spec.days + (spec.extendable ? extensionDays : 0));

    const met = spec.metWhen ? spec.metWhen(complaint) : false;
    let metAt = null;
    if (met && history.length) {
      const hit = history.find(h => h.newStatus && h.newStatus !== 'Paused' && h.newStatus !== complaint.status) || history[0];
      metAt = (spec.key === 'inquiry' && inquiryCompletedAt) ? inquiryCompletedAt : hit && hit.createdAt;
    }
    if (met && spec.key === 'inquiry') metAt = inquiryCompletedAt || metAt;

    const daysRemaining = daysBetween(now, dueAt);
    let status;
    if (met) status = 'met';
    else if (daysRemaining < 0) status = 'overdue';
    else if (daysRemaining <= 7) status = 'due-soon';
    else status = 'on-track';

    // A closed case that never met an earlier milestone still reports overdue,
    // because the statutory record should show it.
    if (spec.key === 'filingWindow' && complaint.incidentDate) {
      const filedLate = daysBetween(complaint.incidentDate, complaint.createdAt) > 90;
      if (filedLate) status = complaint.filingExtensionRecorded ? 'met' : 'overdue';
    }

    return {
      key: spec.key,
      label: spec.label,
      legalRef: spec.legalRef,
      dueAt: dueAt.toISOString(),
      status,
      met,
      metAt: metAt ? new Date(metAt).toISOString() : null,
      daysRemaining,
      extendedBy: spec.extendable ? extensionDays : 0,
    };
  }).filter(Boolean);

  const overdue = milestones.filter(m => m.status === 'overdue');
  const dueSoon = milestones.filter(m => m.status === 'due-soon');
  const nextDue = milestones
    .filter(m => m.status !== 'met')
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0] || null;

  return {
    milestones,
    health: {
      state: complaint.status === CLOSED ? 'closed' : overdue.length ? 'overdue' : dueSoon.length ? 'due-soon' : 'on-track',
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      daysOpen: daysBetween(complaint.createdAt, now),
      ageBucket: ageBucket((now - new Date(complaint.createdAt)) / DAY),
      nextDue: nextDue ? { key: nextDue.key, label: nextDue.label, dueAt: nextDue.dueAt, daysRemaining: nextDue.daysRemaining } : null,
      overdueMilestones: overdue.map(m => m.label),
    },
  };
}

function ageBucket(daysOpen) {
  if (daysOpen <= 7) return '0-7';
  if (daysOpen <= 30) return '8-30';
  if (daysOpen <= 90) return '31-90';
  return '90+';
}

/**
 * Roll a complaint list up into compliance numbers for dashboards.
 */
function complianceSummary(complaints, historyByComplaint = {}) {
  const buckets = { '0-7': 0, '8-30': 0, '31-90': 0, '90+': 0 };
  let overdue = 0;
  let dueSoon = 0;
  let unassigned = 0;
  const offenders = [];

  for (const complaint of complaints) {
    if (complaint.status === CLOSED) continue;
    const { health } = statutoryMilestones(complaint, historyByComplaint[complaint.id] || []);
    buckets[health.ageBucket] = (buckets[health.ageBucket] || 0) + 1;
    if (health.overdueCount > 0) {
      overdue++;
      offenders.push({
        id: complaint.id,
        referenceId: complaint.referenceId,
        title: complaint.title,
        status: complaint.status,
        assignedAdminName: complaint.assignedAdminName || null,
        overdueMilestones: health.overdueMilestones,
        daysOpen: health.daysOpen,
      });
    } else if (health.dueSoonCount > 0) {
      dueSoon++;
    }
    if (!complaint.assignedAdminId) unassigned++;
  }

  offenders.sort((a, b) => b.daysOpen - a.daysOpen);
  return { openCases: complaints.filter(c => c.status !== CLOSED).length, overdue, dueSoon, unassigned, buckets, offenders: offenders.slice(0, 8) };
}

module.exports = { statutoryMilestones, complianceSummary, ageBucket, MILESTONES };
