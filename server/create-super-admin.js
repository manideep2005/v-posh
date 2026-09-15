require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Safe Super Admin provisioning — creates or repairs ONLY the super admin
 * account. Never touches complaints, users, or any other data.
 *
 * Usage:
 *   node server/create-super-admin.js                          # defaults
 *   node server/create-super-admin.js me@vitap.ac.in MyPass1   # custom
 */
const bcrypt = require('bcryptjs');
const config = require('./config');
const { initDb, closeDb, users } = require('./db');

const EMAIL = (process.argv[2] || 'superadmin@vitap.ac.in').toLowerCase().trim();
const PASSWORD = process.argv[3] || 'SuperAdmin123!';

(async () => {
  await initDb();
  const existing = await users.findOne({ email: EMAIL });

  if (existing) {
    if (existing.role === 'super_admin' && existing.status === 'active') {
      console.log(`✅ ${EMAIL} already exists with role=super_admin, status=active. Nothing to do.`);
    } else {
      await users.updateOne(existing.id, { role: 'super_admin', status: 'active' });
      console.log(`🔧 Repaired ${EMAIL}: role '${existing.role}' → 'super_admin', status → 'active'.`);
    }
  } else {
    await users.insertOne({
      email: EMAIL,
      password: await bcrypt.hash(PASSWORD, config.BCRYPT_ROUNDS),
      name: 'Super Administrator',
      role: 'super_admin',
      employeeId: 'EMP-SA-001',
      department: 'Administration',
      status: 'active',
      permissions: ['all', 'manage_admins', 'view_audit_logs', 'system_config'],
      lastActiveAt: new Date().toISOString()
    });
    console.log(`✅ Created super admin: ${EMAIL} / ${PASSWORD}`);
  }

  await closeDb();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
