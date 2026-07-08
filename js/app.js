/* =========================================================================
   CloseClub Team — app.js
   Lógica de UI. Toda lectura/escritura de datos pasa por window.Store
   (ver js/store.js), así que conectar Supabase más adelante no toca
   este archivo salvo detalles menores de sesión.
   ========================================================================= */

const state = {
  user: null,
  activeSection: 'stories',
  stories: [],
  reports: [],
  cards: [],
  reportFilter: 'Todos',
  boardFilter: 'Todos',
  dragStoryId: null,
  dragCardId: null,
};

const el = (id) => document.getElementById(id);

/* --------------------------------- Login --------------------------------- */

function renderUserPick() {
  const wrap = el('user-pick');
  wrap.innerHTML = '';
  Store.USERS.forEach((u) => {
    const card = document.createElement('button');
    card.className = 'user-card';
    card.type = 'button';
    card.dataset.code = u.code;
    card.innerHTML = `
      <div class="user-avatar">${u.label}</div>
      <div class="user-name">${u.label}</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.user-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      el('btn-login').disabled = false;
      el('btn-login').dataset.code = u.code;
    });
    wrap.appendChild(card);
  });
}

async function handleLogin() {
  const code = el('btn-login').dataset.code;
  if (!code) return;
  await Store.setSession(code);
  state.user = code;
  await bootApp();
}

async function handleLogout() {
  await Store.clearSession();
  state.user = null;
  el('app-shell').classList.add('hidden');
  el('login-screen').classList.remove('hidden');
  document.querySelectorAll('.user-card').forEach((c) => c.classList.remove('selected'));
  el('btn-login').disabled = true;
  delete el('btn-login').dataset.code;
}

/* ------------------------------ Navegación -------------------------------- */

function setActiveSection(name) {
  state.activeSection = name;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  document.querySelectorAll('.section').forEach((sec) => {
    sec.classList.toggle('hidden', sec.id !== `section-${name}`);
  });
}

/* ============================= HISTORIAS ================================= */

const PRIORITIES = ['Alta', 'Media', 'Baja'];

function renderStories() {
  const wrap = el('priority-groups');
  wrap.innerHTML = '';

  PRIORITIES.forEach((priority) => {
    const items = state.stories.filter((s) => s.priority === priority);

    const group = document.createElement('div');
    group.innerHTML = `
      <div class="priority-group-title">
        <span class="priority-chip ${priority}"></span> ${priority} · ${items.length}
      </div>
    `;

    const stack = document.createElement('div');
    stack.className = 'stack';
    stack.dataset.priority = priority;

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Sin historias aquí todavía. Arrastra una o crea una nueva.';
      stack.appendChild(empty);
    } else {
      items.forEach((story) => stack.appendChild(buildStoryCard(story)));
    }

    attachStackDropZone(stack);
    group.appendChild(stack);
    wrap.appendChild(group);
  });
}

function buildStoryCard(story) {
  const card = document.createElement('div');
  card.className = 'story-card' + (story.status === 'Hecho' ? ' done' : '');
  card.draggable = true;
  card.dataset.id = story.id;
  card.dataset.priority = story.priority;

  card.innerHTML = `
    <div class="story-body">
      <p class="story-title">${escapeHtml(story.title)}</p>
      ${story.description ? `<p class="story-desc">${escapeHtml(story.description)}</p>` : ''}
      <div class="story-meta">
        <select class="status-select" data-id="${story.id}">
          <option ${story.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
          <option ${story.status === 'En progreso' ? 'selected' : ''}>En progreso</option>
          <option ${story.status === 'Hecho' ? 'selected' : ''}>Hecho</option>
        </select>
        <span class="tag">${story.createdBy || '—'}</span>
      </div>
    </div>
    <button class="icon-btn" data-delete="${story.id}" title="Eliminar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
    </button>
  `;

  card.addEventListener('dragstart', () => {
    state.dragStoryId = story.id;
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  card.querySelector('.status-select').addEventListener('change', async (e) => {
    await Store.updateStory(story.id, { status: e.target.value });
    await refreshStories();
  });

  card.querySelector('[data-delete]').addEventListener('click', async () => {
    await Store.deleteStory(story.id);
    await refreshStories();
  });

  return card;
}

function attachStackDropZone(stack) {
  stack.addEventListener('dragover', (e) => {
    e.preventDefault();
    stack.classList.add('drag-over');
  });
  stack.addEventListener('dragleave', () => stack.classList.remove('drag-over'));
  stack.addEventListener('drop', async (e) => {
    e.preventDefault();
    stack.classList.remove('drag-over');
    const id = state.dragStoryId;
    if (!id) return;
    const newPriority = stack.dataset.priority;

    // Determinar posición de inserción según el card más cercano al soltar
    const afterEl = [...stack.querySelectorAll('.story-card:not(.dragging)')].find((c) => {
      const rect = c.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    });

    const current = state.stories.find((s) => s.id === id);
    if (!current) return;
    current.priority = newPriority;

    const others = state.stories.filter((s) => s.id !== id);
    let insertIndex = others.length;
    if (afterEl) {
      insertIndex = others.findIndex((s) => s.id === afterEl.dataset.id);
    }
    others.splice(insertIndex === -1 ? others.length : insertIndex, 0, current);

    await Store.updateStory(id, { priority: newPriority });
    await Store.reorderStories(others.map((s) => s.id));
    await refreshStories();
    state.dragStoryId = null;
  });
}

async function refreshStories() {
  state.stories = await Store.getStories();
  renderStories();
}

async function handleAddStory() {
  const title = el('story-title').value.trim();
  if (!title) return;
  await Store.addStory({
    title,
    description: el('story-desc').value.trim(),
    priority: el('story-priority').value,
    status: el('story-status').value,
    createdBy: state.user,
  });
  el('story-title').value = '';
  el('story-desc').value = '';
  await refreshStories();
}

/* ============================== REPORTES =================================== */

function renderReports() {
  const list = el('report-list');
  list.innerHTML = '';

  const filtered = state.reports.filter(
    (r) => state.reportFilter === 'Todos' || r.type === state.reportFilter
  );

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No hay reportes aquí todavía.</div>';
    return;
  }

  filtered.forEach((report) => {
    const item = document.createElement('div');
    item.className = 'report-item' + (report.status === 'Resuelto' ? ' resolved' : '');

    item.innerHTML = `
      <button class="report-check ${report.status === 'Resuelto' ? 'checked' : ''}" data-id="${report.id}" title="Marcar como resuelto">
        ${report.status === 'Resuelto' ? '✓' : ''}
      </button>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span class="type-badge ${report.type}">${report.type}</span>
          <select class="status-select" data-status="${report.id}">
            <option ${report.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option ${report.status === 'En progreso' ? 'selected' : ''}>En progreso</option>
            <option ${report.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
          </select>
          <span class="tag">${report.createdBy || '—'}</span>
        </div>
        <p class="report-title">${escapeHtml(report.title)}</p>
        ${report.description ? `<p class="report-desc">${escapeHtml(report.description)}</p>` : ''}
      </div>
      <button class="icon-btn" data-delete="${report.id}" title="Eliminar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    `;

    item.querySelector('.report-check').addEventListener('click', async () => {
      const newStatus = report.status === 'Resuelto' ? 'Pendiente' : 'Resuelto';
      await Store.updateReport(report.id, { status: newStatus });
      await refreshReports();
    });

    item.querySelector('[data-status]').addEventListener('change', async (e) => {
      await Store.updateReport(report.id, { status: e.target.value });
      await refreshReports();
    });

    item.querySelector('[data-delete]').addEventListener('click', async () => {
      await Store.deleteReport(report.id);
      await refreshReports();
    });

    list.appendChild(item);
  });
}

async function refreshReports() {
  state.reports = await Store.getReports();
  renderReports();
}

async function handleAddReport() {
  const title = el('report-title').value.trim();
  if (!title) return;
  await Store.addReport({
    title,
    description: el('report-desc').value.trim(),
    type: el('report-type').value,
    status: el('report-status').value,
    createdBy: state.user,
  });
  el('report-title').value = '';
  el('report-desc').value = '';
  await refreshReports();
}

function setupReportFilters() {
  el('report-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    state.reportFilter = btn.dataset.filter;
    document.querySelectorAll('#report-filters .filter-chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    renderReports();
  });
}

/* ================================ BOARD ===================================== */

const BOARD_COLUMNS = ['Ideas', 'En proceso', 'Publicado'];

function renderBoard() {
  const wrap = el('board-columns');
  wrap.innerHTML = '';

  const filtered = state.cards.filter(
    (c) => state.boardFilter === 'Todos' || c.category === state.boardFilter
  );

  BOARD_COLUMNS.forEach((colName) => {
    const items = filtered.filter((c) => c.column === colName);

    const col = document.createElement('div');
    col.className = 'board-column';
    col.innerHTML = `<p class="board-column-title"><span>${colName}</span><span>${items.length}</span></p>`;

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'board-cards';
    cardsWrap.dataset.column = colName;

    if (items.length === 0) {
      cardsWrap.innerHTML = '<div class="empty-state">Vacío por ahora.</div>';
    } else {
      items.forEach((card) => cardsWrap.appendChild(buildPostCard(card)));
    }

    attachBoardDropZone(cardsWrap);
    col.appendChild(cardsWrap);
    wrap.appendChild(col);
  });
}

function buildPostCard(card) {
  const node = document.createElement('div');
  node.className = 'post-card';
  node.draggable = true;
  node.dataset.id = card.id;

  node.innerHTML = `
    <div class="post-card-top">
      <span class="category-badge ${card.category}">${card.category}</span>
      <button class="icon-btn" data-delete="${card.id}" title="Eliminar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    <p class="post-title">${escapeHtml(card.title)}</p>
    ${card.content ? `<p class="post-content">${escapeHtml(card.content)}</p>` : ''}
    <div class="post-card-footer">
      <span class="post-author">${card.createdBy || '—'}</span>
    </div>
  `;

  node.addEventListener('dragstart', () => {
    state.dragCardId = card.id;
    node.classList.add('dragging');
  });
  node.addEventListener('dragend', () => node.classList.remove('dragging'));

  node.querySelector('[data-delete]').addEventListener('click', async () => {
    await Store.deleteCard(card.id);
    await refreshBoard();
  });

  return node;
}

function attachBoardDropZone(zone) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const id = state.dragCardId;
    if (!id) return;
    await Store.updateCard(id, { column: zone.dataset.column });
    await refreshBoard();
    state.dragCardId = null;
  });
}

async function refreshBoard() {
  state.cards = await Store.getCards();
  renderBoard();
}

async function handleAddCard() {
  const title = el('card-title').value.trim();
  if (!title) return;
  await Store.addCard({
    title,
    content: el('card-content').value.trim(),
    category: el('card-category').value,
    column: el('card-column').value,
    createdBy: state.user,
  });
  el('card-title').value = '';
  el('card-content').value = '';
  await refreshBoard();
}

function setupBoardFilters() {
  el('board-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    state.boardFilter = btn.dataset.filter;
    document.querySelectorAll('#board-filters .filter-chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    renderBoard();
  });
}

/* ================================= Utils ===================================== */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ================================== Boot ====================================== */

async function bootApp() {
  el('login-screen').classList.add('hidden');
  el('app-shell').classList.remove('hidden');

  el('sidebar-avatar').textContent = state.user;
  el('sidebar-user-label').textContent = state.user;

  await refreshStories();
  await refreshReports();
  await refreshBoard();
  setActiveSection('stories');
}

async function init() {
  renderUserPick();

  el('btn-login').addEventListener('click', handleLogin);
  el('btn-logout').addEventListener('click', handleLogout);

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => setActiveSection(btn.dataset.section));
  });

  el('btn-add-story').addEventListener('click', handleAddStory);
  el('btn-add-report').addEventListener('click', handleAddReport);
  el('btn-add-card').addEventListener('click', handleAddCard);

  setupReportFilters();
  setupBoardFilters();

  const session = await Store.getSession();
  if (session && session.code) {
    state.user = session.code;
    await bootApp();
  }
}

document.addEventListener('DOMContentLoaded', init);
