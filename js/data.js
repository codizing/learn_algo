/* ==========================================================================
   DATA LAYER
   Courses, quizzes and admin-added content live in localStorage so the
   "admin" (whoever has access to /admin.html) can add PDFs/videos without
   touching code. Students only ever read this data.
   Swap this file for real API calls if/when a backend is added — every
   other page only talks to the functions below, never to localStorage
   directly.
   ========================================================================== */

const DB_KEY = 'csp_db_v6';

const SEED = {
  courses: [],
  quizzes: {
    1: [],
    2: []
  },
  users: []
};

const tombstones = {
  courses: new Set(),
  quizzes: new Set()
};

let memoryDB = null;

(function migrateOldDb() {
  try {
    if (localStorage.getItem(DB_KEY)) return;
    const oldKeys = ['csp_db_v5', 'csp_db_v4', 'csp_session_db_v1', 'csp_db'];
    for (const k of oldKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        localStorage.setItem(DB_KEY, raw);
        break;
      }
    }
  } catch (e) {}
})();

function loadDB() {
  if (memoryDB) return structuredClone(memoryDB);
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      memoryDB = normalizeDB(JSON.parse(raw));
      return structuredClone(memoryDB);
    }
  } catch (e) {
    console.warn('loadDB error:', e);
  }
  memoryDB = structuredClone(SEED);
  return structuredClone(memoryDB);
}

function saveDB(db) {
  memoryDB = structuredClone(normalizeDB(db));
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(memoryDB));
  } catch (e) {
    console.warn('saveDB localStorage error:', e);
  }
}

function normalizeQuizQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  return {
    ...q,
    id: q.id || q.firestoreId || ('q_' + Math.random().toString(36).substr(2, 9)),
    firestoreId: q.firestoreId || '',
    year: Number(q.year) || 1,
    q_en: q.q_en || q.q_fr || '',
    q_fr: q.q_fr || q.q_en || '',
    opts_en: Array.isArray(q.opts_en) ? q.opts_en : (Array.isArray(q.opts_fr) ? q.opts_fr : []),
    opts_fr: Array.isArray(q.opts_fr) ? q.opts_fr : (Array.isArray(q.opts_en) ? q.opts_en : []),
    correct: Number(q.correct) || 0
  };
}

function normalizeCourse(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    ...c,
    id: c.id || c.firestoreId || ('c' + Date.now()),
    firestoreId: c.firestoreId || '',
    type: c.type || 'course',
    year: Number(c.year) || 1,
    code: c.code || 'CS',
    title_en: c.title_en || c.title_fr || '',
    title_fr: c.title_fr || c.title_en || '',
    desc_en: c.desc_en || c.desc_fr || '',
    desc_fr: c.desc_fr || c.desc_en || '',
    pdfUrl_en: c.pdfUrl_en || c.pdfUrl || '',
    pdfUrl_fr: c.pdfUrl_fr || c.pdfUrl || '',
    videoUrl: c.videoUrl || ''
  };
}

function courseFingerprint(c) {
  return [c.type || 'course', Number(c.year) || 1, (c.code || '').toUpperCase(), c.title_en || c.title_fr || ''].join('|');
}

function dedupeCourses(list) {
  const items = (list || []).map(normalizeCourse).filter(Boolean);
  const byId = new Map();
  items.forEach(c => {
    const key = String(c.firestoreId || c.id);
    const prev = byId.get(key);
    if (!prev || (c.firestoreId && !prev.firestoreId)) byId.set(key, c);
  });
  const arr = Array.from(byId.values());
  const synced = arr.filter(c => c.firestoreId);
  const unsynced = arr.filter(c => !c.firestoreId);
  const syncedPrints = new Set(synced.map(courseFingerprint));
  return synced.concat(unsynced.filter(u => !syncedPrints.has(courseFingerprint(u))));
}

function normalizeCourses(list) {
  return dedupeCourses(list);
}

function mergeCourses(localList, cloudList) {
  // Cloud snapshot is the source of truth for synced resources. Starting from
  // local+cloud (old behavior) meant deletes never propagated to other users:
  // the removed doc stayed in their localStorage forever. Keep only unsynced
  // local courses (no firestoreId) that aren't already represented in cloud.
  const cloudNormalized = (cloudList || []).map(normalizeCourse).filter(Boolean);
  const cloudKeys = new Set();
  cloudNormalized.forEach(c => {
    cloudKeys.add(String(c.id));
    if (c.firestoreId) cloudKeys.add(String(c.firestoreId));
  });
  const cloudPrints = new Set(cloudNormalized.map(courseFingerprint));

  const fromCloud = cloudNormalized.filter(c => {
    const key = String(c.firestoreId || c.id);
    return !tombstones.courses.has(key) && !tombstones.courses.has(String(c.id));
  });

  const keptLocal = (localList || []).map(normalizeCourse).filter(Boolean).filter(c => {
    const key = String(c.firestoreId || c.id);
    if (tombstones.courses.has(key) || tombstones.courses.has(String(c.id))) return false;
    // Synced (or previously synced) — drop; cloud list already has it or it was deleted
    if (c.firestoreId) return false;
    if (cloudKeys.has(String(c.id))) return false;
    if (cloudPrints.has(courseFingerprint(c))) return false;
    return true;
  });

  return dedupeCourses(fromCloud.concat(keptLocal));
}

function mergeQuizzes(localQ, cloudQ) {
  const result = { 1: [], 2: [] };
  for (const y of [1, 2]) {
    const map = new Map();
    const put = (q) => {
      const n = normalizeQuizQuestion(q);
      if (!n) return;
      const key = String(n.firestoreId || n.id);
      if (tombstones.quizzes.has(key) || tombstones.quizzes.has(String(n.id))) return;
      const prev = map.get(key);
      if (!prev || (n.firestoreId && !prev.firestoreId)) map.set(key, n);
    };
    ((localQ && (localQ[y] || localQ[String(y)])) || []).forEach(put);
    ((cloudQ && (cloudQ[y] || cloudQ[String(y)])) || []).forEach(put);
    result[y] = Array.from(map.values());
  }
  return result;
}

function normalizeDB(db) {
  if (!db || typeof db !== 'object') db = structuredClone(SEED);
  db.courses = normalizeCourses(db.courses);
  db.courses.forEach(c => {
    if (!c.pdfUrl_en && c.pdfUrl) c.pdfUrl_en = c.pdfUrl;
    if (!c.pdfUrl_fr && c.pdfUrl) c.pdfUrl_fr = c.pdfUrl;
  });
  if (!db.quizzes || typeof db.quizzes !== 'object') {
    db.quizzes = { 1: [], 2: [] };
  } else {
    db.quizzes[1] = db.quizzes[1] || db.quizzes['1'] || [];
    db.quizzes[2] = db.quizzes[2] || db.quizzes['2'] || [];
  }
  if (!db.users || !Array.isArray(db.users)) db.users = [];
  return db;
}

function notifyStoreUpdated() {
  document.dispatchEvent(new CustomEvent('dbupdated'));
  if (typeof window.updateHomeYearCounts === 'function') {
    window.updateHomeYearCounts();
  }
}

// Shared write lock. ANY code path that does loadDB() -> mutate -> saveDB()
// must go through this — the 10s poller, the realtime onSnapshot listener,
// and direct applyCloudCourses/applyCloudQuizzes calls all write independently.
// Without a shared lock, two of them can overlap: one reads an old snapshot,
// a second one finishes and saves fresh data, then the first one (still
// working off its older snapshot) saves last and silently wipes out the
// fresh data. This forces every writer to load fresh, mutate, and save as
// one atomic step, always in true call order, no matter which path triggered it.
let _dbLock = Promise.resolve();
function withDbLock(fn) {
  const run = _dbLock.then(fn, fn);
  _dbLock = run.then(() => {}, () => {});
  return run;
}

const Store = {
  async pushUnsyncedToCloud(db) {
    if (!window.FB_Sync) return false;
    let pushed = false;

    for (const course of db.courses) {
      if (course.firestoreId) continue;
      const id = await window.FB_Sync.saveCourse(course);
      if (id) {
        course.firestoreId = id;
        pushed = true;
      }
    }

    for (const year of [1, 2]) {
      for (const question of (db.quizzes[year] || [])) {
        if (question.firestoreId) continue;
        const id = await window.FB_Sync.saveQuizQuestion(question);
        if (id) {
          question.firestoreId = id;
          pushed = true;
        }
      }
    }

    for (const user of (db.users || [])) {
      if (user.firestoreId) continue;
      await window.FB_Sync.saveUser(user);
      user.firestoreId = (user.email || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      pushed = true;
    }

    if (pushed) saveDB(db);
    return pushed;
  },
  async uploadLocalIfNeeded() {
    const db = loadDB();
    const hasUnsynced = db.courses.some(c => !c.firestoreId)
      || [1, 2].some(y => (db.quizzes[y] || []).some(q => !q.firestoreId));
    if (!hasUnsynced) return 0;

    const pushed = await this.pushUnsyncedToCloud(db);
    if (pushed) {
      document.dispatchEvent(new CustomEvent('dbupdated'));
    }
    return pushed ? db.courses.length : 0;
  },
  async syncWithFirebase() {
    // Multiple triggers (initial load, the 10s poller, tab-focus, etc.) can
    // all fire close together. Without this guard, each one independently
    // reads localStorage, fetches from Firestore, then writes back — and a
    // slower call that started with an older snapshot can finish LAST and
    // silently overwrite a correct, more recent save with stale data.
    // This makes every concurrent caller share the same single sync instead.
    if (this._syncInFlight) return this._syncInFlight;
    this._syncInFlight = this._doSyncWithFirebase();
    try {
      return await this._syncInFlight;
    } finally {
      this._syncInFlight = null;
    }
  },
  async _doSyncWithFirebase() {
    if (!window.FB_Sync) return false;
    try {
      const [cloudCourses, cloudQuizzes, cloudUsers] = await Promise.all([
        window.FB_Sync.fetchCourses(),
        window.FB_Sync.fetchQuizzes(),
        window.FB_Sync.fetchUsers()
      ]);
      const reachedCloud = cloudCourses !== null || cloudQuizzes !== null;

      await withDbLock(async () => {
        const db = loadDB();
        let updated = false;

        if (cloudCourses !== null) {
          db.courses = mergeCourses(db.courses, cloudCourses);
          updated = true;
        }

        if (cloudQuizzes !== null) {
          db.quizzes = mergeQuizzes(db.quizzes, cloudQuizzes);
          updated = true;
        }

        if (cloudUsers !== null) {
          db.users = cloudUsers;
          updated = true;
        }

        if (updated) saveDB(db);
      });

      notifyStoreUpdated();
      return reachedCloud;
    } catch (e) {
      console.warn("syncWithFirebase error:", e);
      return false;
    }
  },
  applyCloudCourses(courses) {
    if (courses == null) return;
    withDbLock(() => {
      const db = loadDB();
      db.courses = mergeCourses(db.courses, courses);
      saveDB(db);
    }).then(() => notifyStoreUpdated());
  },
  applyCloudQuizzes(quizzes) {
    if (quizzes == null) return;
    withDbLock(() => {
      const db = loadDB();
      db.quizzes = mergeQuizzes(db.quizzes, quizzes);
      saveDB(db);
    }).then(() => notifyStoreUpdated());
  },
  applyCloudUsers(users) {
    withDbLock(() => {
      const db = loadDB();
      db.users = users || [];
      saveDB(db);
    }).then(() => notifyStoreUpdated());
  },
  async fetchCoursesFromCloud() {
    if (!window.FB_Sync) return [];
    const cloud = await window.FB_Sync.fetchCourses();
    if (cloud === null) return [];
    this.applyCloudCourses(cloud);
    return normalizeCourses(cloud);
  },
  async fetchQuizzesFromCloud() {
    if (!window.FB_Sync) return { 1: [], 2: [] };
    const cloud = await window.FB_Sync.fetchQuizzes();
    if (cloud === null) return { 1: [], 2: [] };
    this.applyCloudQuizzes(cloud);
    return cloud;
  },
  getYearStats(year) {
    return {
      courses: this.getCourses(year, 'course').length,
      td: this.getCourses(year, 'td').length,
      tp: this.getCourses(year, 'tp').length,
      exam: this.getCourses(year, 'exam').length,
      quiz: this.getQuiz(year).length
    };
  },
  getCourses(year, type) {
    const db = loadDB();
    return db.courses.filter(c => {
      const cYear = Number(c.year) || 1;
      const cType = c.type || 'course';
      if (year && cYear !== Number(year)) return false;
      if (type && cType !== type) return false;
      return true;
    });
  },
  getAllCourses() {
    const db = loadDB();
    return db.courses || [];
  },
  async addCourse(course) {
    course.id = (course.type || 'c') + Date.now();
    if (!course.type) course.type = 'course';
    if (!course.pdfUrl_en) course.pdfUrl_en = course.pdfUrl || '';
    if (!course.pdfUrl_fr) course.pdfUrl_fr = course.pdfUrl || '';

    // 1. Add to local memory immediately so UI updates right away
    await withDbLock(() => {
      const db = loadDB();
      db.courses.push(normalizeCourse(course));
      saveDB(db);
    });
    notifyStoreUpdated();

    // 2. Save to Firestore in background, then update the id and re-notify
    if (window.FB_Sync) {
      try {
        const id = await window.FB_Sync.saveCourse(course);
        if (id) {
          course.firestoreId = id;
          await withDbLock(() => {
            const db = loadDB();
            const idx = db.courses.findIndex(c => c.id === course.id);
            if (idx > -1) {
              db.courses[idx].id = id;
              db.courses[idx].firestoreId = id;
            } else {
              db.courses.push(normalizeCourse({ ...course, id, firestoreId: id }));
            }
            db.courses = dedupeCourses(db.courses);
            saveDB(db);
          });
          course.id = id;
          notifyStoreUpdated();
        }
      } catch (e) {
        console.warn('addCourse Firestore save error:', e);
        course._cloudError = e.message || 'CLOUD_SAVE_FAILED';
      }
    } else {
      course._cloudError = 'Firebase is not loaded';
    }

    return course;
  },
  updateCourse(id, patch) {
    withDbLock(() => {
      const db = loadDB();
      const i = db.courses.findIndex(c => c.id === id);
      if (i > -1) {
        db.courses[i] = { ...db.courses[i], ...patch };
        saveDB(db);
      }
    }).then(() => notifyStoreUpdated());
  },
  async deleteCourse(id) {
    let target = null;
    await withDbLock(() => {
      const db = loadDB();
      target = db.courses.find(c => c.id === id || c.firestoreId === id);
      if (target) {
        tombstones.courses.add(String(target.id));
        if (target.firestoreId) tombstones.courses.add(String(target.firestoreId));
      }
      db.courses = db.courses.filter(c => c.id !== id && c.firestoreId !== id);
      if (db.users) {
        db.users.forEach(u => {
          if (u.completedCourses) {
            u.completedCourses = u.completedCourses.filter(cid => cid !== id && (!target || cid !== target.firestoreId));
          }
        });
      }
      saveDB(db);
    });

    notifyStoreUpdated();

    if (window.FB_Sync && target) {
      const cloudId = target.firestoreId || target.id;
      await window.FB_Sync.deleteCourse(cloudId);
    }
    return target;
  },
  getQuiz(year) {
    const db = loadDB();
    const y = Number(year) || 1;
    if (!db || !db.quizzes) return [];
    const rawList = db.quizzes[y] || db.quizzes[String(y)] || [];
    return (Array.isArray(rawList) ? rawList : []).map(normalizeQuizQuestion).filter(Boolean);
  },
  async addQuestion(year, question) {
    const y = Number(year) || 1;
    question.id = 'q_' + Date.now();
    question.year = y;

    // 1. Add to local memory immediately so UI updates right away
    await withDbLock(() => {
      const db = loadDB();
      if (!db.quizzes) db.quizzes = { 1: [], 2: [] };
      if (!db.quizzes[y]) db.quizzes[y] = [];
      db.quizzes[y].push(normalizeQuizQuestion(question));
      saveDB(db);
    });
    notifyStoreUpdated();

    // 2. Save to Firestore in background, update id, re-notify
    if (window.FB_Sync) {
      try {
        const id = await window.FB_Sync.saveQuizQuestion(question);
        if (id) {
          question.firestoreId = id;
          await withDbLock(() => {
            const db = loadDB();
            const list = db.quizzes[y] || [];
            const idx = list.findIndex(q => q.id === question.id);
            if (idx > -1) {
              list[idx].id = id;
              list[idx].firestoreId = id;
            }
            saveDB(db);
          });
          question.id = id;
          notifyStoreUpdated();
        }
      } catch (e) {
        console.warn('addQuestion Firestore save error:', e);
        question._cloudError = e.message || 'CLOUD_SAVE_FAILED';
      }
    } else {
      question._cloudError = 'Firebase is not loaded';
    }

    return question;
  },
  async deleteQuestion(year, questionId) {
    const y = Number(year) || 1;
    let target = null;
    await withDbLock(() => {
      const db = loadDB();
      const list = db.quizzes[y] || db.quizzes[String(y)] || [];
      const i = list.findIndex(q => q.id === questionId || q.firestoreId === questionId);
      if (i > -1) {
        target = list.splice(i, 1)[0];
        if (target) {
          tombstones.quizzes.add(String(target.id));
          if (target.firestoreId) tombstones.quizzes.add(String(target.firestoreId));
        }
      }
      saveDB(db);
    });

    notifyStoreUpdated();

    if (window.FB_Sync && target) {
      const cloudId = target.firestoreId || target.id;
      await window.FB_Sync.deleteQuizQuestion(cloudId);
    }
    return target;
  },
  // ----- USERS & PROGRESS METHODS -----
  getUsers() {
    const db = loadDB();
    return db.users || [];
  },
  getUserByEmail(email) {
    if (!email) return null;
    const db = loadDB();
    const clean = email.trim().toLowerCase();
    return (db.users || []).find(u => (u.email || '').toLowerCase() === clean) || null;
  },
  ensureUser(user) {
    if (!user || !user.email) return null;
    const cleanEmail = user.email.trim().toLowerCase();
    let existing = null;
    return withDbLock(() => {
      const db = loadDB();
      if (!db.users) db.users = [];
      existing = db.users.find(u => (u.email || '').toLowerCase() === cleanEmail);
      if (!existing) {
        existing = {
          id: 'u_' + Date.now(),
          name: user.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          initials: (user.name ? user.name.charAt(0) : cleanEmail.charAt(0)).toUpperCase(),
          registeredAt: new Date().toISOString().split('T')[0],
          completedCourses: [],
          quizResults: []
        };
        db.users.push(existing);
        saveDB(db);
      }
      return existing;
    }).then(result => {
      notifyStoreUpdated();
      if (window.FB_Sync && result) {
        window.FB_Sync.saveUser(result);
      }
      return result;
    });
  },
  addUser(userData) {
    const email = (userData.email || '').trim().toLowerCase();
    if (!email) return { error: 'Email is required' };
    const name = (userData.name || '').trim();
    let newUser = null;

    return withDbLock(() => {
      const db = loadDB();
      if (!db.users) db.users = [];
      if (db.users.some(u => (u.email || '').toLowerCase() === email)) {
        return { error: 'User already exists' };
      }
      newUser = {
        id: 'u_' + Date.now(),
        name: name || email.split('@')[0],
        email: email,
        initials: (name ? name.charAt(0) : email.charAt(0)).toUpperCase(),
        registeredAt: new Date().toISOString().split('T')[0],
        completedCourses: [],
        quizResults: []
      };
      db.users.push(newUser);
      saveDB(db);
      return newUser;
    }).then(result => {
      notifyStoreUpdated();
      if (window.FB_Sync && newUser) {
        window.FB_Sync.saveUser(newUser);
      }
      return result;
    });
  },
  deleteUser(userId) {
    let deletedUser = null;
    return withDbLock(() => {
      const db = loadDB();
      if (db.users) {
        const idx = db.users.findIndex(u => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
        if (idx > -1) {
          deletedUser = db.users.splice(idx, 1)[0];
        }
        saveDB(db);
      }
    }).then(() => {
      notifyStoreUpdated();
      if (window.FB_Sync && deletedUser) {
        window.FB_Sync.deleteUser(deletedUser.id, deletedUser.email);
      }
    });
  },
  resetUserProgress(userId) {
    let target = null;
    return withDbLock(() => {
      const db = loadDB();
      if (db.users) {
        target = db.users.find(u => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
        if (target) {
          target.completedCourses = [];
          target.quizResults = [];
          saveDB(db);
        }
      }
    }).then(() => {
      notifyStoreUpdated();
      if (window.FB_Sync && target) {
        window.FB_Sync.saveUser(target);
      }
    });
  },
  toggleCourseCompletion(email, courseId) {
    if (!email || !courseId) return false;
    const cleanEmail = email.trim().toLowerCase();
    let isCompleted = false;
    let targetUser = null;

    return withDbLock(() => {
      const db = loadDB();
      if (!db.users) db.users = [];
      let user = db.users.find(u => (u.email || '').toLowerCase() === cleanEmail);
      if (!user) {
        user = {
          id: 'u_' + Date.now(),
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          initials: cleanEmail.charAt(0).toUpperCase(),
          registeredAt: new Date().toISOString().split('T')[0],
          completedCourses: [],
          quizResults: []
        };
        db.users.push(user);
      }
      if (!Array.isArray(user.completedCourses)) user.completedCourses = [];
      const idx = user.completedCourses.indexOf(courseId);
      if (idx > -1) {
        user.completedCourses.splice(idx, 1);
        isCompleted = false;
      } else {
        user.completedCourses.push(courseId);
        isCompleted = true;
      }
      targetUser = user;
      saveDB(db);
      return isCompleted;
    }).then(result => {
      notifyStoreUpdated();
      if (window.FB_Sync && targetUser) {
        window.FB_Sync.saveUser(targetUser);
      }
      return result;
    });
  },
  isCourseCompleted(email, courseId) {
    if (!email || !courseId) return false;
    const user = this.getUserByEmail(email);
    return !!(user && Array.isArray(user.completedCourses) && user.completedCourses.includes(courseId));
  },
  saveQuizResult(email, result) {
    if (!email || !result) return;
    const cleanEmail = email.trim().toLowerCase();
    let entry = null;
    let targetUser = null;

    return withDbLock(() => {
      const db = loadDB();
      if (!db.users) db.users = [];
      let user = db.users.find(u => (u.email || '').toLowerCase() === cleanEmail);
      if (!user) {
        user = {
          id: 'u_' + Date.now(),
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          initials: cleanEmail.charAt(0).toUpperCase(),
          registeredAt: new Date().toISOString().split('T')[0],
          completedCourses: [],
          quizResults: []
        };
        db.users.push(user);
      }
      if (!Array.isArray(user.quizResults)) user.quizResults = [];
      entry = {
        year: Number(result.year) || 1,
        score: Number(result.score) || 0,
        total: Number(result.total) || 1,
        percent: Math.round(((Number(result.score) || 0) / (Number(result.total) || 1)) * 100),
        date: new Date().toISOString().split('T')[0]
      };
      user.quizResults.push(entry);
      targetUser = user;
      saveDB(db);
      return entry;
    }).then(res => {
      notifyStoreUpdated();
      if (window.FB_Sync && targetUser) {
        window.FB_Sync.saveUser(targetUser);
      }
      return res;
    });
  },
  resetAll() {
    memoryDB = structuredClone(SEED);
    try { localStorage.setItem(DB_KEY, JSON.stringify(SEED)); } catch (e) {}
    notifyStoreUpdated();
  }
};

window.Store = Store;
