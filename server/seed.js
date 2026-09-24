require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const config = require('./config');
const db = require('./db');

// This script WIPES users, complaints, updates, history, attachments,
// notifications and audit logs. It must never run against production by
// accident, and it must never leave fabricated demo content behind there.
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const FORCE = process.argv.includes('--force');
const WITH_SAMPLES = process.argv.includes('--demo') || !IS_PRODUCTION;

function printCredentials() {
  if (!WITH_SAMPLES) return;
  console.log('--- DEFAULT CREDENTIALS ---');
  console.log('Super Admin : superadmin@vitap.ac.in / SuperAdmin123!');
  console.log('Admin       : presiding.officer@vitap.ac.in / Admin123!');
  console.log('Student     : student@student.vitap.ac.in / Student123!');
  console.log('---------------------------');
}

async function seed() {
  console.log('Seeding POSH Platform database...');

  if (IS_PRODUCTION && !FORCE) {
    console.error('Refusing to seed: this environment reports as production.');
    console.error('Seeding DELETES all users, complaints, history and audit logs.');
    console.error('If this really is a throwaway/demo database, re-run with --force');
    console.error('(add --demo to also create sample complaints instead of accounts only).');
    process.exit(1);
  }

  await db.initDb();

  // Clear existing data for a clean provisioning run
  for (const col of ['users', 'complaints', 'complaintUpdates', 'statusHistory', 'attachments', 'notifications', 'auditLogs']) {
    const existing = await db[col].find();
    for (const doc of existing) {
      await db[col].deleteOne(doc.id);
    }
  }

  const passwordHashStudent = await bcrypt.hash('Student123!', config.BCRYPT_ROUNDS);
  const passwordHashAdmin = await bcrypt.hash('Admin123!', config.BCRYPT_ROUNDS);
  const passwordHashSuperAdmin = await bcrypt.hash('SuperAdmin123!', config.BCRYPT_ROUNDS);

  // 1. Super Admin
  const superAdmin = await db.users.insertOne({
    email: 'superadmin@vitap.ac.in',
    password: passwordHashSuperAdmin,
    name: 'Prof. Mani Deep',
    role: 'super_admin',
    employeeId: 'EMP-SA-001',
    department: 'Humanities & Social Sciences',
    status: 'active',
    permissions: ['all', 'manage_admins', 'view_audit_logs', 'system_config'],
    lastActiveAt: new Date().toISOString()
  });

  // 2. Admins (ICC Committee Members)
  const admin1 = await db.users.insertOne({
    email: 'presiding.officer@vitap.ac.in',
    password: passwordHashAdmin,
    name: 'Dr. Meera Deshmukh',
    role: 'admin',
    employeeId: 'EMP-ADM-101',
    department: 'Computer Science & Engineering',
    designation: 'Presiding Officer, ICC',
    status: 'active',
    permissions: ['manage_complaints', 'view_students', 'assign_cases'],
    lastActiveAt: new Date().toISOString()
  });

  const admin2 = await db.users.insertOne({
    email: 'icc.member@vitap.ac.in',
    password: passwordHashAdmin,
    name: 'Adv. Rajesh Malhotra',
    role: 'admin',
    employeeId: 'EMP-ADM-102',
    department: 'Management Studies',
    designation: 'External Legal Member, ICC',
    status: 'active',
    permissions: ['manage_complaints', 'view_students'],
    lastActiveAt: new Date().toISOString()
  });

  // 3. Students
  const student1 = await db.users.insertOne({
    email: 'student@student.vitap.ac.in',
    password: passwordHashStudent,
    name: 'Priya Sharma',
    role: 'student',
    studentId: '23BCE0042',
    department: 'Computer Science & Engineering',
    year: '3rd Year B.Tech',
    phone: '+91 9876543210',
    status: 'active',
    lastActiveAt: new Date().toISOString()
  });

  const student2 = await db.users.insertOne({
    email: 'student2@student.vitap.ac.in',
    password: passwordHashStudent,
    name: 'Aarti Kulkarni',
    role: 'student',
    studentId: '24BEC0118',
    department: 'Electronics & Communication',
    year: '2nd Year B.Tech',
    phone: '+91 9812345678',
    status: 'active',
    lastActiveAt: new Date().toISOString()
  });

  // Sample complaints, demo notifications and the seed audit entry are demo
  // content. Production seeding provisions accounts + institutional defaults
  // only, so fabricated cases never reach a live committee.
  if (!WITH_SAMPLES) {
    console.log('Accounts and institutional defaults provisioned.');
    console.log('Sample complaints skipped (production mode) — pass --demo to include them.');
    printCredentials();
    await db.closeDb();
    return;
  }

  // 4. Sample Complaints
  const complaint1 = await db.complaints.insertOne({
    referenceId: 'POSH-2026-000101',
    userId: student1.id,
    studentName: student1.name,
    studentRollNo: student1.studentId,
    studentDept: student1.department,
    title: 'Persistent inappropriate messaging and academic coercion',
    category: 'Digital & Cyber Harassment',
    description: 'During the past two weeks, repeated unwelcome private messages were sent on official academic communication channels demanding non-academic meetings outside college hours.',
    incidentDate: '2026-02-28',
    incidentLocation: 'Online / Academic Portal & Lab 3',
    respondentName: 'Prof. R. V. (Teaching Assistant)',
    respondentDept: 'Computer Science & Engineering',
    status: 'Under Review',
    priority: 'High',
    assignedAdminId: admin1.id,
    assignedAdminName: admin1.name,
    slaDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  });

  await db.statusHistory.insertOne({
    complaintId: complaint1.id,
    previousStatus: null,
    newStatus: 'Submitted',
    changedById: student1.id,
    changedByName: student1.name,
    changedByRole: 'student',
    comment: 'Complaint submitted by student through POSH Portal'
  });

  await db.statusHistory.insertOne({
    complaintId: complaint1.id,
    previousStatus: 'Submitted',
    newStatus: 'Acknowledged',
    changedById: admin1.id,
    changedByName: admin1.name,
    changedByRole: 'admin',
    comment: 'Complaint acknowledged by ICC Presiding Officer'
  });

  await db.statusHistory.insertOne({
    complaintId: complaint1.id,
    previousStatus: 'Acknowledged',
    newStatus: 'Under Review',
    changedById: admin1.id,
    changedByName: admin1.name,
    changedByRole: 'admin',
    comment: 'Initial documentation verified. Proceeding with preliminary scrutiny.'
  });

  await db.complaintUpdates.insertOne({
    complaintId: complaint1.id,
    authorId: admin1.id,
    authorName: admin1.name,
    authorRole: 'admin',
    updateText: 'Your complaint has been formally received and acknowledged by the Internal Complaints Committee (ICC). Confidential inquiry proceedings have commenced in accordance with POSH guidelines.',
    isPublic: true
  });

  // Internal confidential note — never exposed to students via API filters
  await db.complaintUpdates.insertOne({
    complaintId: complaint1.id,
    authorId: admin1.id,
    authorName: admin1.name,
    authorRole: 'admin',
    updateText: 'CONFIDENTIAL ICC NOTE: Digital evidence screenshots verified. Interim relief notice issued to department head to restrict interaction pending inquiry.',
    isPublic: false
  });

  const complaint2 = await db.complaints.insertOne({
    referenceId: 'POSH-2026-000089',
    userId: student2.id,
    studentName: student2.name,
    studentRollNo: student2.studentId,
    studentDept: student2.department,
    title: 'Verbal harassment and hostile demeanor during lab evaluation',
    category: 'Verbal / Non-Verbal Harassment',
    description: 'Repeated offensive remarks made during weekly practical laboratory evaluations in front of peer groups.',
    incidentDate: '2026-01-15',
    incidentLocation: 'Semiconductor Lab, ECE Building',
    respondentName: 'Contractual Lab Instructor',
    respondentDept: 'Electronics & Communication',
    status: 'Resolved',
    priority: 'Medium',
    assignedAdminId: admin2.id,
    assignedAdminName: admin2.name,
    slaDeadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  });

  await db.statusHistory.insertOne({
    complaintId: complaint2.id,
    previousStatus: 'Under Review',
    newStatus: 'Resolved',
    changedById: admin2.id,
    changedByName: admin2.name,
    changedByRole: 'admin',
    comment: 'Formal inquiry completed. Executive corrective action enforced by university administration.'
  });

  await db.complaintUpdates.insertOne({
    complaintId: complaint2.id,
    authorId: admin2.id,
    authorName: admin2.name,
    authorRole: 'admin',
    updateText: 'The ICC committee has finalized its recommendations. Necessary institutional corrective measures have been implemented. Case is formally closed.',
    isPublic: true
  });

  // 5. Initial Notifications
  await db.notifications.insertOne({
    userId: student1.id,
    title: 'Complaint Status Updated',
    message: 'Your complaint POSH-2026-000101 status has been changed to "Under Review".',
    type: 'status_update',
    referenceId: complaint1.referenceId,
    isRead: false
  });

  // 6. Audit Log
  await db.auditLogs.insertOne({
    actorId: superAdmin.id,
    actorName: superAdmin.name,
    actorRole: 'super_admin',
    action: 'SYSTEM_INITIALIZATION',
    targetType: 'SYSTEM',
    targetId: 'SYSTEM',
    details: 'POSH Complaint Management Platform initialized with institutional security protocols.',
    ipAddress: '127.0.0.1'
  });

  console.log('Seeding completed successfully!');
  printCredentials();

  await db.closeDb();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
