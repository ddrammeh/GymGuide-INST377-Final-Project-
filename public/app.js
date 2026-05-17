// ─────────────────────────────────────────────────────
// GymGuide — app.js (Home Page)
// Uses Fetch API to hit backend, Toastify for notifications
// ─────────────────────────────────────────────────────

// ── Session ID (no login needed) ──────────────────────
function getSessionId() {
  let id = localStorage.getItem('gymguide_session');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2, 11) + Date.now();
    localStorage.setItem('gymguide_session', id);
  }
  return id;
}
const SESSION_ID = getSessionId();

// ── State ─────────────────────────────────────────────
let currentBodyPart = null;
let currentEquipment = null;
let currentPage = 0;
const PAGE_SIZE = 15;
let pendingExercise = null; // for the routine modal

// ── DOM refs ──────────────────────────────────────────
const exerciseGrid = document.getElementById('exerciseGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const resultsHeader = document.getElementById('resultsHeader');
const resultsTitle = document.getElementById('resultsTitle');
const paginationControls = document.getElementById('paginationControls');
const pageInfo = document.getElementById('pageInfo');
const statExercises = document.getElementById('statExercises');
const statRoutines = document.getElementById('statRoutines');
const statWorkouts = document.getElementById('statWorkouts');

// ── FETCH EXERCISES (FETCH CALL #1 — External API via backend) ────
async function fetchExercises(bodyPart, equipment, offset = 0) {
  showLoading();

  let url = `/api/exercises?limit=${PAGE_SIZE}&offset=${offset}`;
  if (bodyPart) url += `&bodyPart=${encodeURIComponent(bodyPart)}`;
  if (equipment) url += `&equipment=${encodeURIComponent(equipment)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    renderExercises(data, offset);
    statExercises.textContent = data.length > 0 ? data.length + (offset > 0 ? '+' : '') : '0';
  } catch (err) {
    console.error(err);
    showToast('Failed to load exercises. Check your connection.', '#e05252');
    hideLoading();
    emptyState.style.display = 'block';
    emptyState.querySelector('p').textContent = '⚠️ Could not load exercises. Please try again.';
  }
}

// ── FETCH ROUTINES COUNT (FETCH CALL #2 — Supabase via backend) ───
async function fetchRoutinesCount() {
  try {
    const res = await fetch('/api/routines');
    if (!res.ok) return;
    const data = await res.json();
    statRoutines.textContent = data.length;
  } catch (e) {
    statRoutines.textContent = '0';
  }
}

// ── FETCH WORKOUT LOGS COUNT (FETCH CALL #3 — Supabase via backend) ─
async function fetchWorkoutStats() {
  try {
    const res = await fetch(`/api/logs?session_id=${SESSION_ID}`);
    if (!res.ok) return;
    const logs = await res.json();
    // Count workouts from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLogs = logs.filter(log => new Date(log.completed_at) > sevenDaysAgo);
    statWorkouts.textContent = recentLogs.length;
  } catch (e) {
    statWorkouts.textContent = '0';
  }
}

// ── RENDER EXERCISES ──────────────────────────────────
function renderExercises(exercises, offset) {
  hideLoading();
  emptyState.style.display = 'none';
  resultsHeader.style.display = 'flex';

  if (exercises.length === 0) {
    exerciseGrid.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.querySelector('p').textContent = 'No exercises found. Try different filters.';
    paginationControls.style.display = 'none';
    return;
  }

  const label = currentBodyPart
    ? currentBodyPart.toUpperCase() + ' EXERCISES'
    : currentEquipment
    ? currentEquipment.toUpperCase() + ' EXERCISES'
    : 'EXERCISES';
  resultsTitle.textContent = `${label} (${exercises.length} results)`;

  exerciseGrid.innerHTML = exercises.map((ex, i) => `
    <div class="exercise-card" style="animation-delay:${i * 0.04}s">
      <img src="/api/gif?url=${encodeURIComponent(ex.gifUrl || '')}" alt="${ex.name}" loading="lazy" onerror="this.style.display='none'" />
      <div class="card-name">${ex.name}</div>
      <div class="card-meta">
        <span class="card-tag target">${ex.target}</span>
        <span class="card-tag">${ex.equipment}</span>
        <span class="card-tag">${ex.bodyPart}</span>
      </div>
      ${ex.instructions && ex.instructions.length > 0 ? `
        <div class="card-instructions">
          ${ex.instructions.slice(0, 2).map((s, n) => `${n+1}. ${s}`).join('<br/>')}
        </div>
      ` : ''}
      <div class="card-actions">
        <button class="btn-add-routine" onclick="openRoutineModal('${ex.id}', '${ex.name.replace(/'/g, "\\'")}')">
          ➕ Save to Routine
        </button>
      </div>
    </div>
  `).join('');

  // Pagination
  paginationControls.style.display = 'flex';
  pageInfo.textContent = `Page ${Math.floor(offset / PAGE_SIZE) + 1}`;
  document.getElementById('prevPage').disabled = offset === 0;
  document.getElementById('prevPage').style.opacity = offset === 0 ? '0.3' : '1';
  document.getElementById('nextPage').disabled = exercises.length < PAGE_SIZE;
  document.getElementById('nextPage').style.opacity = exercises.length < PAGE_SIZE ? '0.3' : '1';
}

// ── STATES ────────────────────────────────────────────
function showLoading() {
  loadingState.style.display = 'block';
  emptyState.style.display = 'none';
  exerciseGrid.innerHTML = '';
  paginationControls.style.display = 'none';
}

function hideLoading() {
  loadingState.style.display = 'none';
}

// ── SEARCH ────────────────────────────────────────────
async function searchExercises(query) {
  if (!query.trim()) return;
  showLoading();
  resultsHeader.style.display = 'flex';

  try {
    // Fetch a broad set then filter client-side by name
    const res = await fetch(`/api/exercises?limit=100`);
    if (!res.ok) throw new Error();
    const all = await res.json();
    const filtered = all.filter(ex =>
      ex.name.toLowerCase().includes(query.toLowerCase()) ||
      ex.target.toLowerCase().includes(query.toLowerCase())
    );
    renderExercises(filtered, 0);
    resultsTitle.textContent = `SEARCH: "${query}" (${filtered.length} results)`;
  } catch {
    showToast('Search failed. Try again.', '#e05252');
    hideLoading();
  }
}

// ── ROUTINE MODAL ─────────────────────────────────────
function openRoutineModal(exerciseId, exerciseName) {
  pendingExercise = { exercise_id: exerciseId, exercise_name: exerciseName };
  document.getElementById('modalExerciseName').textContent = exerciseName;

  // Pre-fill routine name if stored
  const lastRoutine = localStorage.getItem('gymguide_last_routine');
  if (lastRoutine) document.getElementById('routineName').value = lastRoutine;

  document.getElementById('routineModal').style.display = 'flex';
}

function closeRoutineModal() {
  document.getElementById('routineModal').style.display = 'none';
  pendingExercise = null;
}

// ── SAVE TO ROUTINE (POST — FETCH CALL to backend) ────
async function saveToRoutine() {
  if (!pendingExercise) return;

  const routineName = document.getElementById('routineName').value.trim();
  if (!routineName) {
    showToast('Please enter a routine name!', '#e05252');
    return;
  }

  const sets = parseInt(document.getElementById('modalSets').value);
  const reps = parseInt(document.getElementById('modalReps').value);
  const rest_seconds = parseInt(document.getElementById('modalRest').value);

  const payload = {
    name: routineName,
    session_id: SESSION_ID,
    exercises: [{
      exercise_id: pendingExercise.exercise_id,
      exercise_name: pendingExercise.exercise_name,
      sets,
      reps,
      rest_seconds
    }]
  };

  try {
    const res = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error();

    localStorage.setItem('gymguide_last_routine', routineName);
    closeRoutineModal();
    showToast(`✓ Saved to "${routineName}"!`, '#52c97a');
    fetchRoutinesCount(); // update stat
  } catch {
    showToast('Failed to save routine. Try again.', '#e05252');
  }
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, bg = '#e8c547') {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: 'bottom',
    position: 'right',
    style: {
      background: bg,
      color: bg === '#e8c547' ? '#000' : '#fff',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: '0.9rem',
      fontWeight: '600',
      borderRadius: '0',
      boxShadow: 'none'
    }
  }).showToast();
}

// ── EVENT LISTENERS ───────────────────────────────────

// Muscle buttons
document.querySelectorAll('.muscle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentBodyPart = btn.dataset.bodypart;
    currentEquipment = null;
    document.querySelectorAll('.eq-check').forEach(c => c.checked = false);
    currentPage = 0;
    fetchExercises(currentBodyPart, null, 0);
  });
});

// Apply equipment filters
document.getElementById('applyFilters').addEventListener('click', () => {
  const checked = [...document.querySelectorAll('.eq-check:checked')].map(c => c.value);
  if (checked.length === 0) {
    showToast('Select at least one equipment type.', '#e05252');
    return;
  }
  currentEquipment = checked[0]; // ExerciseDB filters one at a time
  currentBodyPart = null;
  document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'));
  currentPage = 0;
  fetchExercises(null, currentEquipment, 0);
});

// Clear filters
document.getElementById('clearFilters').addEventListener('click', () => {
  currentBodyPart = null;
  currentEquipment = null;
  currentPage = 0;
  document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.eq-check').forEach(c => c.checked = false);
  exerciseGrid.innerHTML = '';
  resultsHeader.style.display = 'none';
  paginationControls.style.display = 'none';
  emptyState.style.display = 'block';
  emptyState.querySelector('p').textContent = '👆 Pick a muscle group or equipment filter to get started.';
  statExercises.textContent = '—';
});

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('clearFilters').click();
});

// Search
document.getElementById('searchBtn').addEventListener('click', () => {
  searchExercises(document.getElementById('searchInput').value);
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchExercises(e.target.value);
});

// Pagination
document.getElementById('prevPage').addEventListener('click', () => {
  if (currentPage === 0) return;
  currentPage--;
  fetchExercises(currentBodyPart, currentEquipment, currentPage * PAGE_SIZE);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('nextPage').addEventListener('click', () => {
  currentPage++;
  fetchExercises(currentBodyPart, currentEquipment, currentPage * PAGE_SIZE);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Modal
document.getElementById('saveRoutineBtn').addEventListener('click', saveToRoutine);
document.getElementById('closeModal').addEventListener('click', closeRoutineModal);
document.getElementById('routineModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeRoutineModal();
});

// ── INIT ──────────────────────────────────────────────
fetchRoutinesCount();
fetchWorkoutStats();
