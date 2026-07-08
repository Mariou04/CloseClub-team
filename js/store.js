/* =========================================================================
   CloseClub Team — Capa de datos
   -------------------------------------------------------------------------
   Usa Supabase si está configurado (window.supabaseClient ≠ null).
   Si no, cae a localStorage para seguir funcionando sin conexión.
   ========================================================================= */

const STORAGE_KEYS = {
  session: 'ccteam_session',
  stories: 'ccteam_stories',
  reports: 'ccteam_reports',
  cards: 'ccteam_cards',
  users: 'ccteam_users',
};

const USERS = [
  { code: 'LM', label: 'LM' },
  { code: 'ED', label: 'ED' },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Error leyendo storage', key, e);
    return fallback;
  }
}

function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const db = () => window.supabaseClient;

/* ---------------------------- helpers Supabase --------------------------- */

function isOnline() {
  return db() !== null && db() !== undefined;
}

/* ---------------------------- Sesión / usuario --------------------------- */

async function getSession() {
  if (isOnline()) {
    const { data: { user }, error } = await db().auth.getUser();
    if (error || !user) return readLS(STORAGE_KEYS.session, null);
    const code = user.user_metadata?.code || user.email?.split('@')[0]?.toUpperCase() || null;
    return code ? { code } : null;
  }
  return readLS(STORAGE_KEYS.session, null);
}

async function setSession(userCode) {
  writeLS(STORAGE_KEYS.session, { code: userCode });
  return { code: userCode };
}

async function clearSession() {
  if (isOnline()) {
    await db().auth.signOut();
  }
  localStorage.removeItem(STORAGE_KEYS.session);
}

/* ------------------------------ Historias -------------------------------- */

async function getStories() {
  if (isOnline()) {
    const { data, error } = await db()
      .from('stories')
      .select('*')
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  return readLS(STORAGE_KEYS.stories, []);
}

async function addStory(story) {
  if (isOnline()) {
    const { data, error } = await db()
      .from('stories')
      .insert({
        title: story.title,
        description: story.description || '',
        priority: story.priority || 'Media',
        status: story.status || 'Pendiente',
        created_by: story.createdBy,
        order_index: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const stories = await getStories();
  const newStory = {
    id: uid(),
    title: story.title,
    description: story.description || '',
    priority: story.priority || 'Media',
    status: story.status || 'Pendiente',
    createdBy: story.createdBy,
    createdAt: new Date().toISOString(),
  };
  stories.push(newStory);
  writeLS(STORAGE_KEYS.stories, stories);
  return newStory;
}

async function updateStory(id, changes) {
  if (isOnline()) {
    const mapped = {};
    if (changes.title !== undefined) mapped.title = changes.title;
    if (changes.description !== undefined) mapped.description = changes.description;
    if (changes.priority !== undefined) mapped.priority = changes.priority;
    if (changes.status !== undefined) mapped.status = changes.status;
    if (changes.order_index !== undefined) mapped.order_index = changes.order_index;
    const { data, error } = await db()
      .from('stories')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const stories = await getStories();
  const idx = stories.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  stories[idx] = { ...stories[idx], ...changes };
  writeLS(STORAGE_KEYS.stories, stories);
  return stories[idx];
}

async function deleteStory(id) {
  if (isOnline()) {
    const { error } = await db().from('stories').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  const stories = await getStories();
  writeLS(STORAGE_KEYS.stories, stories.filter((s) => s.id !== id));
}

async function reorderStories(orderedIds) {
  if (isOnline()) {
    const updates = orderedIds.map((id, index) => ({
      id,
      order_index: index,
    }));
    const { error } = await db().from('stories').upsert(updates);
    if (error) throw error;
    return updates;
  }

  const stories = await getStories();
  const map = new Map(stories.map((s) => [s.id, s]));
  const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean);
  writeLS(STORAGE_KEYS.stories, reordered);
  return reordered;
}

/* ------------------------------- Reportes -------------------------------- */

async function getReports() {
  if (isOnline()) {
    const { data, error } = await db()
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  return readLS(STORAGE_KEYS.reports, []);
}

async function addReport(report) {
  if (isOnline()) {
    const { data, error } = await db()
      .from('reports')
      .insert({
        title: report.title,
        description: report.description || '',
        type: report.type || 'Mejora',
        status: report.status || 'Pendiente',
        created_by: report.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const reports = await getReports();
  const newReport = {
    id: uid(),
    title: report.title,
    description: report.description || '',
    type: report.type || 'Mejora',
    status: report.status || 'Pendiente',
    createdBy: report.createdBy,
    createdAt: new Date().toISOString(),
  };
  reports.unshift(newReport);
  writeLS(STORAGE_KEYS.reports, reports);
  return newReport;
}

async function updateReport(id, changes) {
  if (isOnline()) {
    const mapped = {};
    if (changes.title !== undefined) mapped.title = changes.title;
    if (changes.description !== undefined) mapped.description = changes.description;
    if (changes.type !== undefined) mapped.type = changes.type;
    if (changes.status !== undefined) mapped.status = changes.status;
    const { data, error } = await db()
      .from('reports')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const reports = await getReports();
  const idx = reports.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  reports[idx] = { ...reports[idx], ...changes };
  writeLS(STORAGE_KEYS.reports, reports);
  return reports[idx];
}

async function deleteReport(id) {
  if (isOnline()) {
    const { error } = await db().from('reports').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  const reports = await getReports();
  writeLS(STORAGE_KEYS.reports, reports.filter((r) => r.id !== id));
}

/* --------------------------------- Cards ---------------------------------- */

async function getCards() {
  if (isOnline()) {
    const { data, error } = await db()
      .from('cards')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  return readLS(STORAGE_KEYS.cards, []);
}

async function addCard(card) {
  if (isOnline()) {
    const { data, error } = await db()
      .from('cards')
      .insert({
        title: card.title,
        content: card.content || '',
        category: card.category || 'Fichajes',
        column: card.column || 'Ideas',
        created_by: card.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const cards = await getCards();
  const newCard = {
    id: uid(),
    title: card.title,
    content: card.content || '',
    category: card.category || 'Fichajes',
    column: card.column || 'Ideas',
    createdBy: card.createdBy,
    createdAt: new Date().toISOString(),
  };
  cards.push(newCard);
  writeLS(STORAGE_KEYS.cards, cards);
  return newCard;
}

async function updateCard(id, changes) {
  if (isOnline()) {
    const mapped = {};
    if (changes.title !== undefined) mapped.title = changes.title;
    if (changes.content !== undefined) mapped.content = changes.content;
    if (changes.category !== undefined) mapped.category = changes.category;
    if (changes.column !== undefined) mapped.column = changes.column;
    const { data, error } = await db()
      .from('cards')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const cards = await getCards();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  cards[idx] = { ...cards[idx], ...changes };
  writeLS(STORAGE_KEYS.cards, cards);
  return cards[idx];
}

async function deleteCard(id) {
  if (isOnline()) {
    const { error } = await db().from('cards').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  const cards = await getCards();
  writeLS(STORAGE_KEYS.cards, cards.filter((c) => c.id !== id));
}

/* -------------------------------- Migración -------------------------------- */

async function migrateLocalToSupabase() {
  if (!isOnline()) return;

  const localStories = readLS(STORAGE_KEYS.stories, []);
  const localReports = readLS(STORAGE_KEYS.reports, []);
  const localCards = readLS(STORAGE_KEYS.cards, []);

  if (localStories.length) {
    const { data: existing } = await db().from('stories').select('id').limit(1);
    if (!existing || existing.length === 0) {
      const mapped = localStories.map((s, i) => ({
        title: s.title,
        description: s.description || '',
        priority: s.priority || 'Media',
        status: s.status || 'Pendiente',
        created_by: s.createdBy,
        order_index: i,
      }));
      await db().from('stories').insert(mapped);
    }
  }

  if (localReports.length) {
    const { data: existing } = await db().from('reports').select('id').limit(1);
    if (!existing || existing.length === 0) {
      const mapped = localReports.map((r) => ({
        title: r.title,
        description: r.description || '',
        type: r.type || 'Mejora',
        status: r.status || 'Pendiente',
        created_by: r.createdBy,
      }));
      await db().from('reports').insert(mapped);
    }
  }

  if (localCards.length) {
    const { data: existing } = await db().from('cards').select('id').limit(1);
    if (!existing || existing.length === 0) {
      const mapped = localCards.map((c) => ({
        title: c.title,
        content: c.content || '',
        category: c.category || 'Fichajes',
        column: c.column || 'Ideas',
        created_by: c.createdBy,
      }));
      await db().from('cards').insert(mapped);
    }
  }

  console.info('CloseClub Team: migración de localStorage a Supabase completada.');
}

/* ------------------------------- Exportar --------------------------------- */

window.Store = {
  USERS,
  getSession, setSession, clearSession,
  getStories, addStory, updateStory, deleteStory, reorderStories,
  getReports, addReport, updateReport, deleteReport,
  getCards, addCard, updateCard, deleteCard,
  migrateLocalToSupabase,
};
