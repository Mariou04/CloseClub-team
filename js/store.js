/* =========================================================================
   CloseClub Team — Capa de datos
   -------------------------------------------------------------------------
   Usa Supabase si está disponible. Si algo falla, cae a localStorage.
   ========================================================================= */

const STORAGE_KEYS = {
  session: 'ccteam_session',
  stories: 'ccteam_stories',
  reports: 'ccteam_reports',
  cards: 'ccteam_cards',
};

const USERS = [
  { code: 'LM', label: 'LM' },
  { code: 'ED', label: 'ED' },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}

function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function isOnline() {
  return window.supabaseClient && window.supabaseClient.sb;
}

let _alerted = false;

async function trySupabase(fn) {
  if (!isOnline()) return { ok: false };
  try {
    const result = await fn();
    return { ok: true, data: result };
  } catch (e) {
    console.error('❌ Supabase error:', e.message);
    if (!_alerted) {
      _alerted = true;
      alert('⚠️ Sin conexión a la nube. Tus datos se guardan localmente hasta que reconecte. Tu compañero no los verá.');
    }
    return { ok: false };
  }
}

/* ---------------------------- Sesión / usuario --------------------------- */

async function getSession() { return readLS(STORAGE_KEYS.session, null); }
async function setSession(userCode) { writeLS(STORAGE_KEYS.session, { code: userCode }); return { code: userCode }; }
async function clearSession() { localStorage.removeItem(STORAGE_KEYS.session); }

/* ------------------------------ Auto-migracion --------------------------- */

let _migrated = false;

async function autoMigrate() {
  if (_migrated || !isOnline()) return;
  _migrated = true;
  try {
    for (let i = 0; i < 3; i++) {
      const tables = ['stories', 'reports', 'cards'];
      const keys = [STORAGE_KEYS.stories, STORAGE_KEYS.reports, STORAGE_KEYS.cards];
      const local = readLS(keys[i], []);
      if (!local.length) continue;
      const mapped = local.map((r, idx) => {
        const base = { title: r.title, description: r.description || '', created_by: r.createdBy };
        if (keys[i] === STORAGE_KEYS.stories) return { ...base, priority: r.priority || 'Media', status: r.status || 'Pendiente', order_index: idx };
        if (keys[i] === STORAGE_KEYS.reports) return { ...base, type: r.type || 'Mejora', status: r.status || 'Pendiente' };
        return { ...base, content: r.content || '', category: r.category || 'Fichajes', column: r.column || 'Ideas' };
      });
      await window.supabaseClient.sb(tables[i]).insert(mapped);
      localStorage.removeItem(keys[i]);
    }
    if (readLS(STORAGE_KEYS.stories, []).length || readLS(STORAGE_KEYS.reports, []).length || readLS(STORAGE_KEYS.cards, []).length) {
      console.info('Migración completada.');
    }
  } catch (e) {
    console.warn('Migración no disponible:', e.message);
  }
}

/* ------------------------------ Historias -------------------------------- */

async function getStories() {
  const r = await trySupabase(async () => {
    await autoMigrate();
    const { data } = await window.supabaseClient.sb('stories').select('*', { order: 'order_index', ascending: true });
    return data || [];
  });
  return r.ok ? r.data : readLS(STORAGE_KEYS.stories, []);
}

async function addStory(story) {
  const r = await trySupabase(() =>
    window.supabaseClient.sb('stories').insert({
      title: story.title, description: story.description || '',
      priority: story.priority || 'Media', status: story.status || 'Pendiente',
      created_by: story.createdBy, order_index: 0,
    })
  );
  if (r.ok) return r.data;

  const stories = readLS(STORAGE_KEYS.stories, []);
  const ns = { id: uid(), title: story.title, description: story.description || '',
    priority: story.priority || 'Media', status: story.status || 'Pendiente',
    createdBy: story.createdBy, createdAt: new Date().toISOString() };
  stories.push(ns);
  writeLS(STORAGE_KEYS.stories, stories);
  return ns;
}

async function updateStory(id, changes) {
  const mapped = {};
  ['title','description','priority','status','order_index'].forEach(k => {
    if (changes[k] !== undefined) mapped[k] = changes[k];
  });
  const r = await trySupabase(() => window.supabaseClient.sb('stories').update(id, mapped));
  if (r.ok) return r.data;

  const stories = readLS(STORAGE_KEYS.stories, []);
  const idx = stories.findIndex(s => s.id === id);
  if (idx === -1) return null;
  stories[idx] = { ...stories[idx], ...changes };
  writeLS(STORAGE_KEYS.stories, stories);
  return stories[idx];
}

async function deleteStory(id) {
  const r = await trySupabase(() => window.supabaseClient.sb('stories').delete(id));
  if (r.ok) return;
  const stories = readLS(STORAGE_KEYS.stories, []).filter(s => s.id !== id);
  writeLS(STORAGE_KEYS.stories, stories);
}

async function reorderStories(orderedIds) {
  const updates = orderedIds.map((id, index) => ({ id, order_index: index }));
  const r = await trySupabase(() => window.supabaseClient.sb('stories').upsert(updates));
  if (r.ok) return updates;
  const stories = readLS(STORAGE_KEYS.stories, []);
  const map = new Map(stories.map(s => [s.id, s]));
  const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
  writeLS(STORAGE_KEYS.stories, reordered);
  return reordered;
}

/* ------------------------------- Reportes -------------------------------- */

async function getReports() {
  const r = await trySupabase(async () => {
    await autoMigrate();
    const { data } = await window.supabaseClient.sb('reports').select('*', { order: 'created_at', ascending: false });
    return data || [];
  });
  return r.ok ? r.data : readLS(STORAGE_KEYS.reports, []);
}

async function addReport(report) {
  const r = await trySupabase(() =>
    window.supabaseClient.sb('reports').insert({
      title: report.title, description: report.description || '',
      type: report.type || 'Mejora', status: report.status || 'Pendiente', created_by: report.createdBy,
    })
  );
  if (r.ok) return r.data;
  const reports = readLS(STORAGE_KEYS.reports, []);
  const nr = { id: uid(), title: report.title, description: report.description || '',
    type: report.type || 'Mejora', status: report.status || 'Pendiente',
    createdBy: report.createdBy, createdAt: new Date().toISOString() };
  reports.unshift(nr);
  writeLS(STORAGE_KEYS.reports, reports);
  return nr;
}

async function updateReport(id, changes) {
  const mapped = {};
  ['title','description','type','status'].forEach(k => { if (changes[k] !== undefined) mapped[k] = changes[k]; });
  const r = await trySupabase(() => window.supabaseClient.sb('reports').update(id, mapped));
  if (r.ok) return r.data;
  const reports = readLS(STORAGE_KEYS.reports, []);
  const idx = reports.findIndex(r => r.id === id);
  if (idx === -1) return null;
  reports[idx] = { ...reports[idx], ...changes };
  writeLS(STORAGE_KEYS.reports, reports);
  return reports[idx];
}

async function deleteReport(id) {
  const r = await trySupabase(() => window.supabaseClient.sb('reports').delete(id));
  if (r.ok) return;
  writeLS(STORAGE_KEYS.reports, readLS(STORAGE_KEYS.reports, []).filter(r => r.id !== id));
}

/* --------------------------------- Cards ---------------------------------- */

async function getCards() {
  const r = await trySupabase(async () => {
    await autoMigrate();
    const { data } = await window.supabaseClient.sb('cards').select('*', { order: 'created_at', ascending: true });
    return data || [];
  });
  return r.ok ? r.data : readLS(STORAGE_KEYS.cards, []);
}

async function addCard(card) {
  const r = await trySupabase(() =>
    window.supabaseClient.sb('cards').insert({
      title: card.title, content: card.content || '',
      category: card.category || 'Fichajes', column: card.column || 'Ideas', created_by: card.createdBy,
    })
  );
  if (r.ok) return r.data;
  const cards = readLS(STORAGE_KEYS.cards, []);
  const nc = { id: uid(), title: card.title, content: card.content || '',
    category: card.category || 'Fichajes', column: card.column || 'Ideas',
    createdBy: card.createdBy, createdAt: new Date().toISOString() };
  cards.push(nc);
  writeLS(STORAGE_KEYS.cards, cards);
  return nc;
}

async function updateCard(id, changes) {
  const mapped = {};
  ['title','content','category','column'].forEach(k => { if (changes[k] !== undefined) mapped[k] = changes[k]; });
  const r = await trySupabase(() => window.supabaseClient.sb('cards').update(id, mapped));
  if (r.ok) return r.data;
  const cards = readLS(STORAGE_KEYS.cards, []);
  const idx = cards.findIndex(c => c.id === id);
  if (idx === -1) return null;
  cards[idx] = { ...cards[idx], ...changes };
  writeLS(STORAGE_KEYS.cards, cards);
  return cards[idx];
}

async function deleteCard(id) {
  const r = await trySupabase(() => window.supabaseClient.sb('cards').delete(id));
  if (r.ok) return;
  writeLS(STORAGE_KEYS.cards, readLS(STORAGE_KEYS.cards, []).filter(c => c.id !== id));
}

/* ------------------------------- Exportar --------------------------------- */

window.Store = {
  USERS,
  getSession, setSession, clearSession,
  getStories, addStory, updateStory, deleteStory, reorderStories,
  getReports, addReport, updateReport, deleteReport,
  getCards, addCard, updateCard, deleteCard,
};
