// get or create a session id
function getSessionId() {
  let id = localStorage.getItem('gymguide_session')
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Date.now()
    localStorage.setItem('gymguide_session', id)
  }
  return id
}

const SESSION_ID = getSessionId()

// fetch all routines from supabase and display them
async function loadRoutines() {
  const loading = document.getElementById('routinesLoading')
  const empty = document.getElementById('routinesEmpty')
  const list = document.getElementById('routinesList')

  try {
    const res = await fetch('/api/routines')
    const routines = await res.json()

    loading.style.display = 'none'

    if (routines.length === 0) {
      empty.style.display = 'block'
      return
    }

    list.innerHTML = routines.map(r => {
      const exercises = r.routine_exercises || []
      const created = new Date(r.created_at).toLocaleDateString()
      const estTime = exercises.length * 7

      return `
        <div class="routine-card">
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
            ${exercises.length === 0
              ? '<p style="color:#aaa;font-size:0.85rem;">No exercises in this routine.</p>'
              : exercises.map(ex => `
                <div class="exercise-row">
                  <span class="exercise-row-name">${ex.exercise_name || ex.exercise_id}</span>
                  <span class="exercise-row-meta">${ex.sets} sets × ${ex.reps} reps • ${ex.rest_seconds}s rest</span>
                </div>
              `).join('')
            }
          </div>
        </div>
      `
    }).join('')

  } catch (err) {
    loading.style.display = 'none'
    list.innerHTML = '<p style="color:#aaa;text-align:center;padding:30px;">Could not load routines.</p>'
  }
}

// toggle a routine open or closed
function toggleRoutine(id) {
  const body = document.getElementById(id)
  if (body) body.classList.toggle('open')
}

// log a completed workout to supabase
async function logWorkout(routineId, routineName) {
  try {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: SESSION_ID,
        routine_id: routineId,
        notes: 'Completed ' + routineName
      })
    })

    if (!res.ok) throw new Error('log failed')
    alert('Workout logged!')
    loadWeeklyChart()
  } catch (err) {
    alert('Could not log workout. Try again.')
  }
}

// delete a routine
async function deleteRoutine(id) {
  if (!confirm('Delete this routine?')) return

  try {
    const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete failed')
    alert('Routine deleted.')
    loadRoutines()
  } catch (err) {
    alert('Could not delete. Try again.')
  }
}

// load weekly chart using chart.js
async function loadWeeklyChart() {
  try {
    const res = await fetch(`/api/logs?session_id=${SESSION_ID}`)
    const logs = await res.json()

    const days = []
    const counts = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('en-US', { weekday: 'short' })
      const dayStr = d.toISOString().split('T')[0]
      const count = logs.filter(log => log.completed_at && log.completed_at.startsWith(dayStr)).length
      days.push(label)
      counts.push(count)
    }

    const ctx = document.getElementById('weeklyChart').getContext('2d')

    if (window._chart) window._chart.destroy()

    window._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Workouts',
          data: counts,
          backgroundColor: '#e8c547',
          borderWidth: 0,
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#aaa' },
            grid: { color: '#333' }
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: '#aaa' },
            grid: { color: '#333' }
          }
        }
      }
    })

  } catch (err) {
    console.log('chart error:', err)
  }
}

// run on page load
loadRoutines()
loadWeeklyChart()
