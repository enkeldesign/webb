'use strict';

const STORAGE_KEY = 'enkel-todo-server-v1';
const PROFILE_KEY = 'enkel-todo-profile';
const POLL_INTERVAL = 20000;

const state = {
  actor: '',
  tasks: [],
  sortKey: 'priority',
  sortDirection: 'asc',
  draggedId: null,
  loading: false,
  pollTimer: null
};

const elements = {};

window.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  updateDirectionButton();
  openProfileDialog();
});

function cacheElements() {
  const ids = [
    'profileButton', 'addButton', 'sortSelect', 'directionButton', 'refreshButton',
    'settingsButton', 'syncStatus', 'taskBody', 'emptyState', 'profileDialog',
    'taskDialog', 'taskForm', 'taskDialogHeading', 'taskId', 'titleInput',
    'nextStepInput', 'urgencyInput', 'valueInput', 'calmInput', 'energyInput',
    'tagsInput', 'statusInput', 'settingsDialog', 'settingsForm', 'serverUrlInput',
    'anonKeyInput', 'accessCodeInput', 'forgetSettingsButton', 'initializeDialog',
    'initializeButton', 'taskRowTemplate'
  ];

  for (const id of ids) elements[id] = document.getElementById(id);
}

function bindEvents() {
  document.querySelectorAll('[data-profile]').forEach(button => {
    button.addEventListener('click', () => chooseProfile(button.dataset.profile));
  });

  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });

  elements.profileDialog.addEventListener('cancel', event => event.preventDefault());
  elements.profileButton.addEventListener('click', openProfileDialog);
  elements.addButton.addEventListener('click', () => openTaskDialog());
  elements.settingsButton.addEventListener('click', openSettingsDialog);
  elements.refreshButton.addEventListener('click', () => loadTasks({ announce: true }));
  elements.sortSelect.addEventListener('change', handleSortChange);
  elements.directionButton.addEventListener('click', toggleSortDirection);
  elements.taskForm.addEventListener('submit', saveTask);
  elements.settingsForm.addEventListener('submit', saveSettings);
  elements.forgetSettingsButton.addEventListener('click', forgetSettings);
  elements.initializeButton.addEventListener('click', initializeDatabase);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getSettings()) loadTasks({ announce: false });
  });
}

function openProfileDialog() {
  if (!elements.profileDialog.open) elements.profileDialog.showModal();
}

async function chooseProfile(profile) {
  state.actor = profile;
  sessionStorage.setItem(PROFILE_KEY, profile);
  elements.profileButton.textContent = profile;
  elements.profileDialog.close();

  if (!getSettings()) {
    openSettingsDialog();
    return;
  }

  await loadTasks({ announce: false });
  startPolling();
}

function getSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value?.url || !value?.anonKey || !value?.accessCode) return null;
    return value;
  } catch {
    return null;
  }
}

function openSettingsDialog() {
  const settings = getSettings();
  elements.serverUrlInput.value = settings?.url ?? '';
  elements.anonKeyInput.value = settings?.anonKey ?? '';
  elements.accessCodeInput.value = settings?.accessCode ?? '';
  elements.settingsDialog.showModal();
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = {
    url: elements.serverUrlInput.value.trim().replace(/\/$/, ''),
    anonKey: elements.anonKeyInput.value.trim(),
    accessCode: elements.accessCodeInput.value
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  elements.settingsDialog.close();
  await loadTasks({ announce: true });
  startPolling();
}

function forgetSettings() {
  if (!confirm('Glömma serveradress, anon-nyckel och familjekod på den här enheten?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state.tasks = [];
  renderTasks();
  stopPolling();
  elements.settingsDialog.close();
  setSyncStatus('Inte ansluten.');
}

async function rpc(functionName, body = {}) {
  const settings = getSettings();
  if (!settings) throw new Error('MISSING_SETTINGS');

  const response = await fetch(`${settings.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: settings.anonKey,
      Authorization: `Bearer ${settings.anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_access_code: settings.accessCode, ...body })
  });

  if (!response.ok) {
    let detail = '';
    try {
      const error = await response.json();
      detail = [error.message, error.details, error.hint].filter(Boolean).join(' ');
    } catch {
      detail = await response.text();
    }
    const requestError = new Error(detail || `Serverfel ${response.status}`);
    requestError.status = response.status;
    throw requestError;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadTasks({ announce = false } = {}) {
  if (state.loading || !getSettings()) return;
  state.loading = true;
  setBusy(true);

  try {
    const tasks = await rpc('todo_list');
    state.tasks = Array.isArray(tasks) ? tasks : [];
    renderTasks();
    setSyncStatus(`Synkad ${formatTime(new Date())}.`);
    if (announce) announceStatus('Listan är uppdaterad.');
  } catch (error) {
    if (error.message.includes('TODO_NOT_INITIALIZED')) {
      elements.initializeDialog.showModal();
      setSyncStatus('Databasen behöver initieras.');
    } else if (error.message === 'MISSING_SETTINGS') {
      openSettingsDialog();
    } else {
      setSyncStatus(`Kunde inte synka: ${friendlyError(error)}`);
    }
  } finally {
    state.loading = false;
    setBusy(false);
  }
}

async function initializeDatabase() {
  elements.initializeButton.disabled = true;
  try {
    await rpc('todo_initialize', { p_actor: state.actor });
    elements.initializeDialog.close();
    await loadTasks({ announce: true });
  } catch (error) {
    setSyncStatus(`Kunde inte skapa listan: ${friendlyError(error)}`);
  } finally {
    elements.initializeButton.disabled = false;
  }
}

function handleSortChange() {
  state.sortKey = elements.sortSelect.value;
  state.sortDirection = state.sortKey === 'priority' || state.sortKey === 'title' ? 'asc' : 'desc';
  updateDirectionButton();
  renderTasks();
}

function toggleSortDirection() {
  if (state.sortKey === 'priority') return;
  state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
  updateDirectionButton();
  renderTasks();
}

function updateDirectionButton() {
  const isPriority = state.sortKey === 'priority';
  elements.directionButton.disabled = isPriority;
  elements.directionButton.textContent = state.sortDirection === 'asc' ? 'Stigande' : 'Fallande';
  elements.directionButton.setAttribute('aria-pressed', String(state.sortDirection === 'desc'));
}

function calculateScore(task) {
  return task.urgency * 5 + task.calm * 3 + task.value_creation * 2 - task.energy * 2;
}

function sortedTasks() {
  const tasks = [...state.tasks];
  const direction = state.sortDirection === 'asc' ? 1 : -1;

  return tasks.sort((a, b) => {
    let aValue;
    let bValue;

    switch (state.sortKey) {
      case 'score':
        aValue = calculateScore(a);
        bValue = calculateScore(b);
        break;
      case 'value':
        aValue = a.value_creation;
        bValue = b.value_creation;
        break;
      case 'title':
        return a.title.localeCompare(b.title, 'sv') * direction;
      case 'status':
        aValue = statusOrder(a.status);
        bValue = statusOrder(b.status);
        break;
      case 'updated_at':
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
      default:
        aValue = a[state.sortKey];
        bValue = b[state.sortKey];
    }

    if (aValue === bValue) return a.priority - b.priority;
    return (aValue - bValue) * direction;
  });
}

function renderTasks() {
  const tasks = sortedTasks();
  elements.taskBody.replaceChildren();
  elements.emptyState.hidden = tasks.length > 0;
  const canReorder = state.sortKey === 'priority';

  tasks.forEach((task, visibleIndex) => {
    const row = elements.taskRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = task.id;
    row.draggable = canReorder;

    row.querySelector('.priority-number').textContent = task.priority;
    row.querySelector('.task-title').textContent = task.title;
    row.querySelector('.next-step').textContent = task.next_step || 'Inte angivet';
    setRating(row.querySelector('.urgency'), task.urgency, 'Brådska');
    setRating(row.querySelector('.value'), task.value_creation, 'Värdeskapande');
    setRating(row.querySelector('.calm'), task.calm, 'Lugnvärde');
    setRating(row.querySelector('.energy'), task.energy, 'Energikostnad');
    row.querySelector('.score').textContent = calculateScore(task);
    renderTags(row.querySelector('.tags'), task.tags);
    renderStatus(row.querySelector('.status'), task);

    const upButton = row.querySelector('.move-up');
    const downButton = row.querySelector('.move-down');
    upButton.disabled = !canReorder || visibleIndex === 0;
    downButton.disabled = !canReorder || visibleIndex === tasks.length - 1;
    upButton.addEventListener('click', () => moveTask(task.id, -1));
    downButton.addEventListener('click', () => moveTask(task.id, 1));

    row.querySelector('.edit-button').addEventListener('click', () => openTaskDialog(task));
    row.querySelector('.delete-button').addEventListener('click', () => deleteTask(task));

    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('dragleave', handleDragLeave);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);

    elements.taskBody.append(row);
  });
}

function setRating(cell, value, label) {
  cell.textContent = `${value}/5`;
  cell.setAttribute('aria-label', `${label}: ${value} av 5`);
}

function renderTags(cell, tags = []) {
  cell.replaceChildren();
  if (!tags.length) {
    cell.textContent = 'Inga';
    return;
  }
  for (const tag of tags) {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = tag;
    cell.append(chip);
  }
}

function renderStatus(cell, task) {
  const badge = document.createElement('span');
  badge.className = 'status-badge';
  badge.textContent = statusLabel(task.status);
  badge.title = `Senast ändrad av ${task.updated_by} ${formatDateTime(task.updated_at)}`;
  cell.replaceChildren(badge);
}

function openTaskDialog(task = null) {
  elements.taskForm.reset();
  elements.taskId.value = task?.id ?? '';
  elements.taskDialogHeading.textContent = task ? 'Redigera uppgift' : 'Lägg till uppgift';
  elements.titleInput.value = task?.title ?? '';
  elements.nextStepInput.value = task?.next_step ?? '';
  elements.urgencyInput.value = task?.urgency ?? 3;
  elements.valueInput.value = task?.value_creation ?? 3;
  elements.calmInput.value = task?.calm ?? 3;
  elements.energyInput.value = task?.energy ?? 3;
  elements.tagsInput.value = task?.tags?.join(', ') ?? '';
  elements.statusInput.value = task?.status ?? 'todo';
  elements.taskDialog.showModal();
  elements.titleInput.focus();
}

async function saveTask(event) {
  event.preventDefault();
  const submitButton = elements.taskForm.querySelector('[type="submit"]');
  submitButton.disabled = true;

  const id = elements.taskId.value;
  const payload = {
    p_actor: state.actor,
    p_title: elements.titleInput.value.trim(),
    p_next_step: elements.nextStepInput.value.trim(),
    p_urgency: Number(elements.urgencyInput.value),
    p_value_creation: Number(elements.valueInput.value),
    p_calm: Number(elements.calmInput.value),
    p_energy: Number(elements.energyInput.value),
    p_tags: parseTags(elements.tagsInput.value),
    p_status: elements.statusInput.value
  };

  try {
    if (id) await rpc('todo_update', { p_id: id, ...payload });
    else await rpc('todo_create', payload);
    elements.taskDialog.close();
    await loadTasks({ announce: true });
  } catch (error) {
    setSyncStatus(`Kunde inte spara: ${friendlyError(error)}`);
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteTask(task) {
  if (!confirm(`Ta bort ”${task.title}”?`)) return;
  try {
    await rpc('todo_delete', { p_id: task.id, p_actor: state.actor });
    await loadTasks({ announce: true });
  } catch (error) {
    setSyncStatus(`Kunde inte ta bort: ${friendlyError(error)}`);
  }
}

async function moveTask(id, offset) {
  if (state.sortKey !== 'priority') return;
  const ordered = [...state.tasks].sort((a, b) => a.priority - b.priority);
  const index = ordered.findIndex(task => task.id === id);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
  await persistOrder(ordered);
}

function handleDragStart(event) {
  if (state.sortKey !== 'priority') {
    event.preventDefault();
    return;
  }
  state.draggedId = event.currentTarget.dataset.id;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(event) {
  if (!state.draggedId || state.sortKey !== 'priority') return;
  event.preventDefault();
  event.currentTarget.classList.add('drag-target');
  event.dataTransfer.dropEffect = 'move';
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove('drag-target');
}

async function handleDrop(event) {
  event.preventDefault();
  const targetId = event.currentTarget.dataset.id;
  event.currentTarget.classList.remove('drag-target');
  if (!state.draggedId || state.draggedId === targetId) return;

  const ordered = [...state.tasks].sort((a, b) => a.priority - b.priority);
  const fromIndex = ordered.findIndex(task => task.id === state.draggedId);
  const toIndex = ordered.findIndex(task => task.id === targetId);
  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);
  await persistOrder(ordered);
}

function handleDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-target').forEach(row => row.classList.remove('drag-target'));
  state.draggedId = null;
}

async function persistOrder(ordered) {
  const previous = state.tasks.map(task => ({ ...task }));
  const priorities = new Map(ordered.map((task, index) => [task.id, index + 1]));
  state.tasks = state.tasks.map(task => ({ ...task, priority: priorities.get(task.id) }));
  renderTasks();
  setSyncStatus('Sparar ny prioritering…');

  try {
    await rpc('todo_reorder', { p_ids: ordered.map(task => task.id), p_actor: state.actor });
    setSyncStatus(`Prioritering sparad ${formatTime(new Date())}.`);
  } catch (error) {
    state.tasks = previous;
    renderTasks();
    setSyncStatus(`Kunde inte spara ordningen: ${friendlyError(error)}`);
  }
}

function parseTags(value) {
  return [...new Set(value.split(',').map(tag => tag.trim()).filter(Boolean))].slice(0, 12);
}

function statusLabel(status) {
  return { todo: 'Att göra', doing: 'Pågående', done: 'Klar' }[status] ?? status;
}

function statusOrder(status) {
  return { doing: 1, todo: 2, done: 3 }[status] ?? 4;
}

function friendlyError(error) {
  if (error.message.includes('TODO_ACCESS_DENIED')) return 'familjekoden stämmer inte.';
  if (error.message.includes('Failed to fetch')) return 'servern kunde inte nås.';
  return error.message || 'ett okänt fel uppstod.';
}

function setBusy(isBusy) {
  elements.refreshButton.disabled = isBusy;
  elements.refreshButton.textContent = isBusy ? 'Hämtar…' : 'Uppdatera';
}

function setSyncStatus(message) {
  elements.syncStatus.textContent = message;
}

function announceStatus(message) {
  setSyncStatus(`${message} ${formatTime(new Date())}`);
}

function formatTime(date) {
  return new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function startPolling() {
  stopPolling();
  state.pollTimer = window.setInterval(() => {
    if (!document.hidden) loadTasks({ announce: false });
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer);
  state.pollTimer = null;
}
