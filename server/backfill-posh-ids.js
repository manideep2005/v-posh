require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('./db');
const { derivePoshId, resolveUniquePoshId } = require('./services/poshId');

// Backfills V-POSH IDs for accounts that predate them.
//
// Read-only unless --apply is passed, so it is safe to run against production
// just to see what it would do:
//   node server/backfill-posh-ids.js            (dry run)
//   node server/backfill-posh-ids.js --apply    (write)
const APPLY = process.argv.includes('--apply');

function describe(user) {
  return `${user.name || '(no name)'} <${user.email}> [${user.role}]`;
}

async function main() {
  await db.initDb();

  const users = await db.users.find();
  const taken = new Set(users.map(u => u.poshId).filter(Boolean));

  console.log(`engine   : ${db.getEngineName()}`);
  console.log(`accounts : ${users.length}`);
  console.log(`with id  : ${users.filter(u => u.poshId).length}`);
  console.log(`mode     : ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);
  console.log('');

  let assigned = 0;
  let changed = 0;

  // Stable order so repeated runs describe the same plan.
  const ordered = [...users].sort((a, b) => String(a.email).localeCompare(String(b.email)));

  for (const user of ordered) {
    if (!user.poshId) {
      const base = derivePoshId(user);
      const poshId = await resolveUniquePoshId(base, async c => taken.has(c));
      taken.add(poshId);
      assigned++;
      console.log(`  + ${poshId.padEnd(18)} ${describe(user)}`);
      if (APPLY) await db.users.updateOne(user.id, { poshId });
      continue;
    }

    // The stored id may no longer match the email (renamed account, or an id
    // minted before the derivation rule settled). Report drift without touching
    // it — an existing id is the account's public handle and must stay stable.
    const expected = derivePoshId(user);
    if (user.poshId !== expected) {
      changed++;
      console.log(`  ~ ${user.poshId.padEnd(18)} ${describe(user)}  (derivation now yields ${expected})`);
    }
  }

  console.log('');
  console.log(`assigned : ${assigned}${APPLY ? '' : ' (would be)'}`);
  console.log(`drifted  : ${changed} (left untouched — existing ids are stable)`);

  await db.closeDb();
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
