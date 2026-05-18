// session id so we can save routines without a login
function getSessionId() {
  let id = localStorage.getItem('gymguide_session')
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Date.now()
    localStorage.setItem('gymguide_session', id)
  }
  return id
}

const SESSION_ID = getSessionId()

// keep track of current filters and page
let currentBodyPart = null
let currentEquipment = null
let currentPage = 0
const PAGE_SIZE = 15
let pendingExercise = null

// grab all the elements we need
const exerciseGrid = document.getElementById('exerciseGrid')
const loadingState = document.getElementById('loadingState')
const emptyState = document.getElementById('emptyState')
const resultsHeader = document.getElementById('resultsHeader')
const resultsTitle = document.getElementById('resultsTitle')
const paginationControls = document.getElementById('paginationControls')
const pageInfo = document.getElementById('pageInfo')
const statExercises = document.getElementById('statExercises')
const statRoutines = document.getElementById('statRoutines')
const statWorkouts = document.getElementById('statWorkouts')

// fetch exercises from our backend which calls exercisedb
async function fetchExercises(bodyPart, equipment, offset = 0) {
  showLoading()

  let url = `/api/exercises?limit=${PAGE_SIZE}&offset=${offset}`
  if (bodyPart) url += `&bodyPart=${encodeURIComponent(bodyPart)}`
  if (equipment) url += `&equipment=${encodeURIComponent(equipment)}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    renderExercises(data, offset)
    statExercises.textContent = data.length
  } catch (err) {
    console.log('fetch error:', err)
    hideLoading()
    emptyState.style.display = 'block'
    emptyState.querySelector('p').textContent = 'Could not load exercises. Try again.'
  }
}

// fetch how many routines the user has saved
async function fetchRoutinesCount() {
  try {
    const res = await fetch('/api/routines')
    const data = await res.json()
    statRoutines.textContent = data.length
  } catch (err) {
    statRoutines.textContent = '0'
  }
}

// fetch workout logs to show this weeks count
async function fetchWorkoutStats() {
  try {
    const res = await fetch(`/api/logs?session_id=${SESSION_ID}`)
    const logs = await res.json()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recent = logs.filter(log => new Date(log.completed_at) > sevenDaysAgo)
    statWorkouts.textContent = recent.length
  } catch (err) {
    statWorkouts.textContent = '0'
  }
}

// render exercise cards on the page
function renderExercises(exercises, offset) {
  hideLoading()
  emptyState.style.display = 'none'
  resultsHeader.style.display = 'flex'

  if (exercises.length === 0) {
    exerciseGrid.innerHTML = ''
    emptyState.style.display = 'block'
    emptyState.querySelector('p').textContent = 'No exercises found. Try different filters.'
    paginationControls.style.display = 'none'
    return
  }

  const label = currentBodyPart
    ? currentBodyPart.toUpperCase() + ' EXERCISES'
    : currentEquipment
    ? currentEquipment.toUpperCase() + ' EXERCISES'
    : 'EXERCISES'

  resultsTitle.textContent = `${label} (${exercises.length} results)`

  exerciseGrid.innerHTML = exercises.map(ex => `
    <div class="exercise-card">
      <img src="/api/gif?url=${encodeURIComponent(ex.gifUrl || '')}" alt="${ex.name}" loading="lazy" onerror="this.style.display='none'" />
      <div class="card-name">${ex.name}</div>
      <div class="card-meta">
        <span class="card-tag target">${ex.target}</span>
        <span class="card-tag">${ex.equipment}</span>
        <span class="card-tag">${ex.bodyPart}</span>
      </div>
      ${ex.instructions && ex.instructions.length > 0 ? `
        <div class="card-instructions">
          ${ex.instructions.slice(0, 2).map((s, n) => `${n + 1}. ${s}`).join('<br/>')}
        </div>
      ` : ''}
      <div class="card-actions">
        <button onclick="openRoutineModal('${ex.id}', '${ex.name.replace(/'/g, "\\'")}')">
          + Save to Routine
        </button>
      </div>
    </div>
  `).join('')

  // show pagination
  paginationControls.style.display = 'flex'
  pageInfo.textContent = `Page ${Math.floor(offset / PAGE_SIZE) + 1}`
  document.getElementById('prevPage').disabled = offset === 0
  document.getElementById('nextPage').disabled = exercises.length < PAGE_SIZE
}

function showLoading() {
  loadingState.style.display = 'block'
  emptyState.style.display = 'none'
  exerciseGrid.innerHTML = ''
  paginationControls.style.display = 'none'
}

function hideLoading() {
  loadingState.style.display = 'none'
}

// search exercises by name
async function searchExercises(query) {
  if (!query.trim()) return
  showLoading()
  resultsHeader.style.display = 'flex'

  try {
    const res = await fetch(`/api/exercises?limit=100`)
    const all = await res.json()
    const filtered = all.filter(ex =>
      ex.name.toLowerCase().includes(query.toLowerCase()) ||
      ex.target.toLowerCase().includes(query.toLowerCase())
    )
    renderExercises(filtered, 0)
    resultsTitle.textContent = `SEARCH: "${query}" (${filtered.length} results)`
  } catch (err) {
    console.log('search error:', err)
    hideLoading()
  }
}

// open the modal to save an exercise to a routine
function openRoutineModal(exerciseId, exerciseName) {
  pendingExercise = { exercise_id: exerciseId, exercise_name: exerciseName }
  document.getElementById('modalExerciseName').textContent = exerciseName

  const lastRoutine = localStorage.getItem('gymguide_last_routine')
  if (lastRoutine) document.getElementById('routineName').value = lastRoutine

  document.getElementById('routineModal').style.display = 'flex'
}

function closeRoutineModal() {
  document.getElementById('routineModal').style.display = 'none'
  pendingExercise = null
}

// save exercise to a routine in supabase
async function saveToRoutine() {
  if (!pendingExercise) return

  const routineName = document.getElementById('routineName').value.trim()
  if (!routineName) {
    alert('Please enter a routine name!')
    return
  }

  const sets = parseInt(document.getElementById('modalSets').value)
  const reps = parseInt(document.getElementById('modalReps').value)
  const rest_seconds = parseInt(document.getElementById('modalRest').value)

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
  }

  try {
    const res = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error('save failed')

    localStorage.setItem('gymguide_last_routine', routineName)
    closeRoutineModal()
    alert('Saved to "' + routineName + '"!')
    fetchRoutinesCount()
  } catch (err) {
    alert('Could not save routine. Try again.')
  }
}

// muscle group buttons
document.querySelectorAll('.muscle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentBodyPart = btn.dataset.bodypart
    currentEquipment = null
    document.querySelectorAll('.eq-check').forEach(c => c.checked = false)
    currentPage = 0
    fetchExercises(currentBodyPart, null, 0)
  })
})

// apply equipment filters
document.getElementById('applyFilters').addEventListener('click', () => {
  const checked = [...document.querySelectorAll('.eq-check:checked')].map(c => c.value)
  if (checked.length === 0) {
    alert('Please select at least one equipment type.')
    return
  }
  currentEquipment = checked[0]
  currentBodyPart = null
  document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'))
  currentPage = 0
  fetchExercises(null, currentEquipment, 0)
})

// clear filters
document.getElementById('clearFilters').addEventListener('click', () => {
  currentBodyPart = null
  currentEquipment = null
  currentPage = 0
  document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.eq-check').forEach(c => c.checked = false)
  exerciseGrid.innerHTML = ''
  resultsHeader.style.display = 'none'
  paginationControls.style.display = 'none'
  emptyState.style.display = 'block'
  emptyState.querySelector('p').textContent = 'Pick a muscle group or equipment filter to get started.'
  statExercises.textContent = '—'
})

// back button
document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('clearFilters').click()
})

// search button
document.getElementById('searchBtn').addEventListener('click', () => {
  searchExercises(document.getElementById('searchInput').value)
})

document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchExercises(e.target.value)
})

// pagination
document.getElementById('prevPage').addEventListener('click', () => {
  if (currentPage === 0) return
  currentPage--
  fetchExercises(currentBodyPart, currentEquipment, currentPage * PAGE_SIZE)
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

document.getElementById('nextPage').addEventListener('click', () => {
  currentPage++
  fetchExercises(currentBodyPart, currentEquipment, currentPage * PAGE_SIZE)
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

// modal buttons
document.getElementById('saveRoutineBtn').addEventListener('click', saveToRoutine)
document.getElementById('closeModal').addEventListener('click', closeRoutineModal)
document.getElementById('routineModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeRoutineModal()
})

// load stats on page load
fetchRoutinesCount()
fetchWorkoutStats()