// ─────────────────────────────────────────────────────
// GymGuide — routines.js
// Fetch #1: GET /api/routines  (read from Supabase)
// Fetch #2: POST /api/logs     (write to Supabase)
// Fetch #3: GET /api/logs      (read logs for chart)
// Chart.js: weekly workout bar chart
// ─────────────────────────────────────────────────────

function getSessionId() {
  let id = localStorage.getItem('gymguide_session');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2, 11) + Date.now();
    localStorage.setItem('gymguide_session', id);
  }
  return id;
}
const SESSION_ID = getSessionId();

// ── Toast ─────────────────────────────────────────────
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

// ── FETCH ROUTINES (FETCH CALL #1) ────────────────────
async function loadRoutines() {
  const loading = document.getElementById('routinesLoading');
  const empty = document.getElementById('routinesEmpty');
  const list = document.getElementById('routinesList');

  try {
    const res = await fetch('/api/routines');
    if (!res.ok) throw new Error();
    const routines = await res.json();

    loading.style.display = 'none';

    if (routines.length === 0) {
      empty.style.display = 'block';
      return;
    }

    list.innerHTML = routines.map((r, i) => {
      const exercises = r.routine_exercises || [];
      const estTime = exercises.length * 7; // rough estimate
      const created = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      return `
        <div class="routine-card" style="animation-delay:${i * 0.06}s">
          <div class="routine-header" onclick="toggleRoutine('routine-${r.id}')">
            <div>
              <div class="routine-name">${r.name}</div>
              <div class="routine-meta">
                Created ${created} &nbsp;•&nbsp;
                ${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} &nbsp;•&nbsp;
                Est. ~${estTime} min
              </div>
            </div>
            <div class="routine-actions">
              <button class="complete-btn" onclick="event.stopPropagation(); logWorkout(${r.id}, '${r.name.replace(/'/g, "\\'")}')">
                ✓ Done
              </button>
              <button class="btn-danger" onclick="event.stopPropagation(); deleteRoutine(${r.id})">
                🗑
              </button>
            </div>
          </div>
          <div class="routine-body" id="routine-${r.id}">
            ${exercises.length === 0 ? '<p style="color:var(--text-muted);font-size:0.85rem;">No exercises in this routine.</p>' :
              exercises.map(ex => `
                <div class="exercise-row">
                  <span class="exercise-row-name">${ex.exercise_name || ex.exercise_id}</span>
                  <span class="exercise-row-meta">${ex.sets} sets × ${ex.reps} reps &nbsp;•&nbsp; ${ex.rest_seconds}s rest</span>
                </div>
              `).join('')
            }
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    loading.style.display = 'none';
    list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Failed to load routines. Check your connection.</p>';
  }
}

// ── TOGGLE ROUTINE BODY ───────────────────────────────
function toggleRoutine(id) {
  const body = document.getElementById(id);
  if (body) body.classList.toggle('open');
}

// ── LOG WORKOUT (FETCH CALL #2 — POST to Supabase) ───
async function logWorkout(routineId, routineName) {
  try {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: SESSION_ID,
        routine_id: routineId,
        notes: `Completed ${routineName}`
      })
    });

    if (!res.ok) throw new Error();
    showToast(`🔥 "${routineName}" logged! Keep it up!`, '#52c97a');
    loadWeeklyChart(); // refresh chart
  } catch {
    showToast('Failed to log workout. Try again.', '#e05252');
  }
}

// ── DELETE ROUTINE ────────────────────────────────────
async function deleteRoutine(id) {
  if (!confirm('Delete this routine?')) return;

  try {
    const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast('Routine deleted.', '#888');
    loadRoutines();
  } catch {
    showToast('Failed to delete. Try again.', '#e05252');
  }
}

// ── WEEKLY CHART (FETCH CALL #3 — Chart.js) ──────────
async function loadWeeklyChart() {
  try {
    const res = await fetch(`/api/logs?session_id=${SESSION_ID}`);
    if (!res.ok) return;
    const logs = await res.json();

    // Build last 7 days labels + counts
    const days = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStr = d.toISOString().split('T')[0];
      const count = logs.filter(log => log.completed_at && log.completed_at.startsWith(dayStr)).length;
      days.push(label);
      counts.push(count);
    }

    const ctx = document.getElementById('weeklyChart').getContext('2d');

    // Destroy old chart if exists
    if (window._weeklyChart) window._weeklyChart.destroy();

    window._weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Workouts',
          data: counts,
          backgroundColor: counts.map(c => c > 0 ? 'rgba(232, 197, 71, 0.85)' : 'rgba(42,42,42,0.8)'),
          borderWidth: 0,
          borderRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.parsed.y} workout${ctx.parsed.y !== 1 ? 's' : ''}`
            },
            backgroundColor: '#1c1c1c',
            borderColor: '#2a2a2a',
            borderWidth: 1,
            titleColor: '#f0ede8',
            bodyColor: '#888',
            titleFont: { family: 'DM Sans' },
            bodyFont: { family: 'DM Sans' }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#888', font: { family: 'DM Sans', size: 12 } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: '#888',
              font: { family: 'DM Sans', size: 12 }
            },
            grid: { color: 'rgba(255,255,255,0.04)' }
          }
        }
      }
    });

  } catch (err) {
    console.error('Chart load error:', err);
  }
}

// ── INIT ──────────────────────────────────────────────
loadRoutines();
loadWeeklyChart();
