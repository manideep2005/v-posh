const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

// ---------------------------------------------------------------------------
// Storage engine
//
// The application talks to this module through a small async collection API:
//   await db.<collection>.insertOne(doc)
//   await db.<collection>.findById(id)
//   await db.<collection>.findOne(queryObj | predicateFn)
//   await db.<collection>.find(queryObj | predicateFn)
//   await db.<collection>.updateOne(id | predicateFn, updates)
//   await db.<collection>.deleteOne(id)
//   await db.<collection>.count(queryObj | predicateFn)
//
// Two interchangeable engines implement it:
//   - MongoDB (default when MONGODB_URI is configured) — production
//   - JSON file on disk — zero-setup fallback for development
//
// Predicate functions (e.g. c => c.id === x || c.referenceId === y) are not
// expressible as native Mongo queries; for those, documents are synced into
// an in-memory mirror and evaluated in JS. Plain-object queries run natively
// in MongoDB.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const MONGO_COLLECTIONS = {
  users: 'users',
  complaints: 'complaints',
  complaintUpdates: 'complaint_updates',
  statusHistory: 'complaint_status_history',
  attachments: 'attachments',
  notifications: 'notifications',
  auditLogs: 'audit_logs',
  departments: 'departments',
  categories: 'complaint_categories',
  announcements: 'announcements'
};

const JSON_COLLECTION_KEYS = {
  ...MONGO_COLLECTIONS,
  departments: 'departments',
  categories: 'complaint_categories',
  announcements: 'announcements'
};

let driver = null; // 'mongodb' | 'json'
let mongoClient = null;
let mongoDb = null;
const mirrorCache = new Map(); // collectionName -> docs (used for predicate evaluation)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function stripInternal(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function withId(doc) {
  if (!doc) return doc;
  if (doc.id) return stripInternal(doc);
  return stripInternal({ ...doc, id: doc._id ? String(doc._id) : uuidv4() });
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// JSON file engine
// ---------------------------------------------------------------------------

const jsonState = {};

function jsonEnsureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // Read-only filesystem (e.g. serverless) — JSON engine cannot persist there.
    // Callers get in-memory behavior; MongoDB should be configured in such hosts.
    return false;
  }
  return true;
}

function jsonLoad() {
  jsonEnsureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      Object.assign(jsonState, loaded);
    } catch (err) {
      console.error('Failed to parse db.json, starting fresh:', err.message);
    }
  }
  for (const key of Object.values(JSON_COLLECTION_KEYS)) {
    if (!Array.isArray(jsonState[key])) jsonState[key] = [];
  }
}

function jsonSave() {
  if (!jsonEnsureDir()) return;
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(jsonState, null, 2), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.warn('JSON store not writable (in-memory only):', err.message);
  }
}

const jsonEngine = {
  find(name, query) {
    const items = jsonState[name] || [];
    if (query === undefined || query === null) return [...items];
    if (typeof query === 'function') return items.filter(query);
    if (isPlainObject(query)) {
      const keys = Object.keys(query);
      return items.filter(item => keys.every(k => item[k] === query[k]));
    }
    return [];
  },
  findById(name, id) {
    return (jsonState[name] || []).find(item => item.id === id) || null;
  },
  insertOne(name, doc) {
    const newDoc = { id: doc.id || uuidv4(), createdAt: new Date().toISOString(), ...doc, id: doc.id || uuidv4() };
    // ensure id stays first-defined and never overwritten by doc spread
    newDoc.id = doc.id || uuidv4();
    (jsonState[name] = jsonState[name] || []).push(newDoc);
    jsonSave();
    return newDoc;
  },
  updateOne(name, idOrPredicate, updates) {
    let item = null;
    if (typeof idOrPredicate === 'string') {
      item = this.findById(name, idOrPredicate);
    } else if (typeof idOrPredicate === 'function') {
      item = (jsonState[name] || []).find(idOrPredicate) || null;
    } else if (isPlainObject(idOrPredicate)) {
      item = this.findOne(name, idOrPredicate);
    }
    if (!item) return null;
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    jsonSave();
    return item;
  },
  deleteOne(name, id) {
    const items = jsonState[name] || [];
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    const [removed] = items.splice(idx, 1);
    jsonSave();
    return removed;
  },
  findOne(name, query) {
    const results = this.find(name, query);
    return results[0] || null;
  },
  count(name, query) {
    return this.find(name, query).length;
  },
  nextReferenceId(name, prefix) {
    let maxSeq = 100;
    for (const c of jsonState[name] || []) {
      if (c.referenceId && c.referenceId.startsWith(prefix)) {
        const seq = parseInt(c.referenceId.slice(prefix.length), 10);
        if (!Number.isNaN(seq) && seq >= maxSeq) maxSeq = seq + 1;
      }
    }
    return `${prefix}${String(maxSeq).padStart(6, '0')}`;
  },
  async init() {
    jsonLoad();
    return 'json';
  },
  async close() { /* nothing to close */ }
};

// ---------------------------------------------------------------------------
// MongoDB engine
// ---------------------------------------------------------------------------

const mongoEngine = {
  col(name) {
    // Accepts either the JS facade key (complaintUpdates) or the final Mongo
    // collection name (complaint_updates) — normalizes both.
    return mongoDb.collection(MONGO_COLLECTIONS[name] || name);
  },

  async refreshMirror(name) {
    const docs = await this.col(name).find({}).toArray();
    mirrorCache.set(name, docs.map(withId));
  },

  async find(name, query) {
    if (query === undefined || query === null) {
      const docs = await this.col(name).find({}).toArray();
      return docs.map(withId);
    }
    if (typeof query === 'function') {
      await this.refreshMirror(name);
      return (mirrorCache.get(name) || []).filter(query);
    }
    if (isPlainObject(query)) {
      if (Object.keys(query).length === 0) {
        const docs = await this.col(name).find({}).toArray();
        return docs.map(withId);
      }
      const docs = await this.col(name).find(query).toArray();
      return docs.map(withId);
    }
    return [];
  },

  async findOne(name, query) {
    if (query !== null && typeof query === 'object' && !Array.isArray(query) && Object.keys(query).length > 0) {
      const doc = await this.col(name).findOne(query);
      return withId(doc);
    }
    const results = await this.find(name, query);
    return results[0] || null;
  },

  async findById(name, id) {
    const doc = await this.col(name).findOne({ _id: id });
    return withId(doc);
  },

  async insertOne(name, doc) {
    const id = doc.id || uuidv4();
    const full = {
      ...doc,
      id,
      _id: id,
      createdAt: doc.createdAt || new Date().toISOString()
    };
    await this.col(name).insertOne(full);
    return withId(full);
  },

  async updateOne(name, idOrPredicate, updates) {
    let targetId = null;
    if (typeof idOrPredicate === 'string') {
      targetId = idOrPredicate;
    } else if (typeof idOrPredicate === 'function' || isPlainObject(idOrPredicate)) {
      await this.refreshMirror(name);
      const items = mirrorCache.get(name) || [];
      const found = items.find(item =>
        typeof idOrPredicate === 'function' ? idOrPredicate(item) : Object.keys(idOrPredicate).every(k => item[k] === idOrPredicate[k])
      );
      targetId = found ? found.id : null;
    }
    if (!targetId) return null;

    const result = await this.col(name).findOneAndUpdate(
      { _id: targetId },
      { $set: { ...updates, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return withId(result);
  },

  async deleteOne(name, id) {
    const doc = await this.col(name).findOneAndDelete({ _id: id });
    return withId(doc);
  },

  async count(name, query) {
    if (query === undefined || query === null) {
      return this.col(name).countDocuments({});
    }
    if (typeof query === 'function') {
      await this.refreshMirror(name);
      return (mirrorCache.get(name) || []).filter(query).length;
    }
    if (isPlainObject(query) && Object.keys(query).length > 0) {
      return this.col(name).countDocuments(query);
    }
    return this.col(name).countDocuments({});
  },

  async nextReferenceId(name, prefix) {
    const yearPart = prefix; // e.g. "POSH-2026-"
    const last = await this.col(name)
      .find({ referenceId: { $regex: `^${yearPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } })
      .sort({ referenceId: -1 })
      .limit(1)
      .toArray();
    let maxSeq = 100;
    if (last[0] && last[0].referenceId) {
      const seq = parseInt(last[0].referenceId.slice(yearPart.length), 10);
      if (!Number.isNaN(seq) && seq >= maxSeq) maxSeq = seq + 1;
    }
    return `${yearPart}${String(maxSeq).padStart(6, '0')}`;
  },

  async init() {
    const { MongoClient } = require('mongodb');
    const uri = config.MONGODB_URI;
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    try {
      await mongoClient.connect();
      mongoDb = mongoClient.db(config.MONGODB_DB_NAME);

      // Create indexes for frequently queried fields
      await this.col('users').createIndex({ email: 1 }, { unique: true });
      await this.col('users').createIndex({ studentId: 1 });
      await this.col('complaints').createIndex({ referenceId: 1 }, { unique: true });
      await this.col('complaints').createIndex({ userId: 1 });
      await this.col('complaints').createIndex({ status: 1 });
      await this.col('complaints').createIndex({ assignedAdminId: 1 });
      await this.col('complaint_updates').createIndex({ complaintId: 1 });
      await this.col('complaint_status_history').createIndex({ complaintId: 1 });
      await this.col('attachments').createIndex({ complaintId: 1 });
      await this.col('notifications').createIndex({ userId: 1 });
      await this.col('audit_logs').createIndex({ createdAt: -1 });

      // Bootstrap reference/config data
      await bootstrapCollections(this);

      return 'mongodb';
    } catch (err) {
      // Always release the socket pool so callers can fall back cleanly
      try { await mongoClient.close(); } catch { /* ignore */ }
      mongoClient = null;
      mongoDb = null;
      throw err;
    }
  },

  async close() {
    if (mongoClient) await mongoClient.close();
  }
};

const DEFAULT_DEPARTMENTS = [
  { id: 'dept_1', name: 'Computer Science & Engineering', code: 'CSE', headName: 'Dr. A. Sharma' },
  { id: 'dept_2', name: 'Electronics & Communication', code: 'ECE', headName: 'Dr. R. Verma' },
  { id: 'dept_3', name: 'Mechanical Engineering', code: 'MECH', headName: 'Dr. S. Nair' },
  { id: 'dept_4', name: 'Civil Engineering', code: 'CIVIL', headName: 'Dr. P. Gupta' },
  { id: 'dept_5', name: 'Management Studies', code: 'MBA', headName: 'Dr. M. Iyer' },
  { id: 'dept_6', name: 'Humanities & Social Sciences', code: 'HSS', headName: 'Dr. K. Bannerjee' }
];

const DEFAULT_CATEGORIES = [
  { id: 'cat_1', name: 'Verbal / Non-Verbal Harassment', description: 'Unwelcome sexually colored remarks, offensive comments, or gestures', slaDays: 7 },
  { id: 'cat_2', name: 'Physical Conduct & Assault', description: 'Unwelcome physical contact, stalking, or physical intimidation', slaDays: 3 },
  { id: 'cat_3', name: 'Digital & Cyber Harassment', description: 'Harassment via electronic media, emails, social media, or messaging', slaDays: 5 },
  { id: 'cat_4', name: 'Quid Pro Quo / Academic Coercion', description: 'Demand for sexual favors linked to academic grades, attendance, or benefits', slaDays: 3 },
  { id: 'cat_5', name: 'Hostile Academic Environment', description: 'Systemic creation of an intimidating or hostile educational environment', slaDays: 10 }
];

const DEFAULT_SETTINGS = {
  institutionName: 'VIT-AP University',
  poshCellEmail: 'vposh@vitap.ac.in',
  emergencyHelpline: '+91 863-2377777 / 1800-112-9900',
  poshPolicyVersion: 'V-POSH Policy v2026.1',
  slaWarningDays: 2,
  allowAnonymousSubmission: false,
  requireReviewStep: true
};

async function bootstrapCollections(engine) {
  for (const dept of DEFAULT_DEPARTMENTS) {
    const existing = await engine.findById('departments', dept.id);
    if (!existing) await engine.insertOne('departments', dept);
  }
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await engine.findById('categories', cat.id);
    if (!existing) await engine.insertOne('categories', cat);
  }
  // $setOnInsert keeps this idempotent and race-safe across concurrent starts
  await engine.col('system_settings').updateOne(
    { _id: 'system_settings' },
    { $setOnInsert: DEFAULT_SETTINGS },
    { upsert: true }
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const dbExports = {
  driver: null,

  // Idempotent + memoized so serverless invocations reuse the connection
  // pool across warm starts instead of reconnecting on every request.
  async initDb() {
    const G = globalThis;
    if (G.__poshDbReady) {
      this.driver = await G.__poshDbReady;
      return this.driver;
    }
    G.__poshDbReady = (async () => {
      if (config.MONGODB_URI) {
        try {
          return await mongoEngine.init();
        } catch (err) {
          console.error('MongoDB connection failed, falling back to JSON file store:', err.message);
          return await jsonEngine.init();
        }
      }
      return await jsonEngine.init();
    })();
    this.driver = await G.__poshDbReady;
    driver = this.driver;
    return this.driver;
  },

  async closeDb() {
    if (this.driver === 'mongodb') await mongoEngine.close();
    globalThis.__poshDbReady = null;
  },

  // Raw handle for GridFS (evidence storage)
  getMongoDb() {
    return this.driver === 'mongodb' ? mongoDb : null;
  },

  async getSettings() {
    if (this.driver === 'mongodb') {
      const doc = await mongoEngine.col('system_settings').findOne({ _id: 'system_settings' });
      return doc ? stripInternal(doc) : { ...DEFAULT_SETTINGS };
    }
    // JSON engine keeps settings inside the same file
    if (!jsonState.system_settings) jsonState.system_settings = { ...DEFAULT_SETTINGS };
    return jsonState.system_settings;
  },

  async updateSettings(newSettings) {
    if (this.driver === 'mongodb') {
      await mongoEngine.col('system_settings').updateOne(
        { _id: 'system_settings' },
        { $set: newSettings },
        { upsert: true }
      );
      return this.getSettings();
    }
    jsonState.system_settings = { ...(jsonState.system_settings || DEFAULT_SETTINGS), ...newSettings };
    jsonSave();
    return jsonState.system_settings;
  },

  // Convenience for the health endpoint / logs
  getEngineName() {
    return this.driver;
  }
};

// Build collection facades bound to the active engine
for (const key of Object.keys(MONGO_COLLECTIONS)) {
  dbExports[key] = {
    async find(query) { return engine().find(MONGO_COLLECTIONS[key], query); },
    async findOne(query) { return engine().findOne(MONGO_COLLECTIONS[key], query); },
    async findById(id) { return engine().findById(MONGO_COLLECTIONS[key], id); },
    async insertOne(doc) { return engine().insertOne(MONGO_COLLECTIONS[key], doc); },
    async updateOne(idOrPredicate, updates) { return engine().updateOne(MONGO_COLLECTIONS[key], idOrPredicate, updates); },
    async deleteOne(id) { return engine().deleteOne(MONGO_COLLECTIONS[key], id); },
    async count(query) { return engine().count(MONGO_COLLECTIONS[key], query); }
  };
}

// Reference-ID helper lives on complaints directly
dbExports.complaints.nextReferenceId = async function (prefix) {
  return engine().nextReferenceId('complaints', prefix);
};

function engine() {
  if (!driver) throw new Error('Database not initialized. Call initDb() first.');
  return driver === 'mongodb' ? mongoEngine : jsonEngine;
}

module.exports = dbExports;
