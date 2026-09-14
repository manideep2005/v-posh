const fs = require('fs');
const path = require('path');
const db = require('./server/db');
const s = require('./server/services/pdf');
(async () => {
  try {
    await db.initDb();
    const c = (await db.complaints.find({}))[0];
    const u = (await db.users.find({})).find(x => x.id === c?.userId) || (await db.users.find({}))[0];
    if (!c || !u) { console.log('no seed'); return await db.closeDb(); }
    const r = await s.generateStatusReport(c, u, [], []);
    const out = path.join(__dirname, 'status_check.pdf');
    fs.writeFileSync(out, r.buffer);
    console.log('WROTE', out, 'bytes:', r.buffer.length, 'docId:', r.docId);
  } catch (e) { console.error(e.message || e); }
  finally { try { await db.closeDb(); } catch {} }
})();
