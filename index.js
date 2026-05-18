const express = require('express')
const app = express()
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

dotenv.config()

// connect to supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const PORT = 3000
app.use(express.json())
app.use(express.static(__dirname + '/public'))

// serve html pages
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html')
})

app.get('/routines', (req, res) => {
  res.sendFile(__dirname + '/public/routines.html')
})

app.get('/about', (req, res) => {
  res.sendFile(__dirname + '/public/about.html')
})

// get exercises from exercisedb api
app.get('/api/exercises', async (req, res) => {
  const { bodyPart, equipment, limit = 15, offset = 0 } = req.query

  let url = `https://exercisedb.p.rapidapi.com/exercises?limit=${limit}&offset=${offset}`

  if (bodyPart) {
    url = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${bodyPart}?limit=${limit}&offset=${offset}`
  } else if (equipment) {
    url = `https://exercisedb.p.rapidapi.com/exercises/equipment/${equipment}?limit=${limit}&offset=${offset}`
  }

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
      }
    })
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.log('error fetching exercises:', err)
    res.status(500).json({ error: 'could not fetch exercises' })
  }
})

// get single exercise by id
app.get('/api/exercises/:id', async (req, res) => {
  try {
    const response = await fetch(`https://exercisedb.p.rapidapi.com/exercises/exercise/${req.params.id}`, {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
      }
    })
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'could not fetch exercise' })
  }
})

// proxy gif from exercisedb
app.get('/api/gif', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'no url provided' })
  try {
    const response = await fetch(url)
    const buffer = await response.arrayBuffer()
    res.setHeader('Content-Type', 'image/gif')
    res.send(Buffer.from(buffer))
  } catch (err) {
    res.status(500).json({ error: 'could not load gif' })
  }
})

// get all routines from supabase
app.get('/api/routines', async (req, res) => {
  const { data, error } = await supabase
    .from('routines')
    .select('*, routine_exercises(*)')
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
  } else {
    res.json(data)
  }
})

// save a new routine to supabase
app.post('/api/routines', async (req, res) => {
  const { name, session_id, exercises } = req.body

  if (!name || !session_id) {
    return res.status(400).json({ error: 'name and session_id are required' })
  }

  const { data: routine, error } = await supabase
    .from('routines')
    .insert({ name, session_id })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  if (exercises && exercises.length > 0) {
    const rows = exercises.map((ex, i) => ({
      routine_id: routine.id,
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      exercise_order: i + 1,
      sets: ex.sets || 3,
      reps: ex.reps || 10,
      rest_seconds: ex.rest_seconds || 60
    }))

    const { error: exError } = await supabase.from('routine_exercises').insert(rows)
    if (exError) return res.status(500).json({ error: exError.message })
  }

  res.status(201).json(routine)
})

// delete a routine
app.delete('/api/routines/:id', async (req, res) => {
  const { error } = await supabase.from('routines').delete().eq('id', req.params.id)
  if (error) {
    res.status(500).json({ error: error.message })
  } else {
    res.json({ message: 'routine deleted' })
  }
})

// log a completed workout
app.post('/api/logs', async (req, res) => {
  const { session_id, routine_id, notes } = req.body
  const { data, error } = await supabase
    .from('workout_logs')
    .insert({ session_id, routine_id, notes })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
  } else {
    res.status(201).json(data)
  }
})

// get workout logs
app.get('/api/logs', async (req, res) => {
  const { session_id } = req.query
  let query = supabase.from('workout_logs').select('*').order('completed_at', { ascending: false })
  if (session_id) query = query.eq('session_id', session_id)

  const { data, error } = await query
  if (error) {
    res.status(500).json({ error: error.message })
  } else {
    res.json(data)
  }
})

app.listen(PORT, () => {
  console.log('server running on port ' + PORT)
})