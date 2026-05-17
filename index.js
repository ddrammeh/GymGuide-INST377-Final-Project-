const express = require('express');
const supabaseClient = require('@supabase/supabase-js');
const dotenv = require('dotenv');

const app = express();
const port = 3000;
dotenv.config();

app.use(express.json());
app.use(express.static(__dirname + '/public'));
app.get('/style.css', (req, res) => {
  res.sendFile('style.css', { root: __dirname + '/public' });
});

app.get('/app.js', (req, res) => {
  res.sendFile('app.js', { root: __dirname + '/public' });
});

app.get('/routines.js', (req, res) => {
  res.sendFile('routines.js', { root: __dirname + '/public' });
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseClient.createClient(supabaseUrl, supabaseKey);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const EXERCISEDB_HOST = 'exercisedb.p.rapidapi.com';

// ─────────────────────────────────────────────
// PAGE ROUTES
// ─────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname + '/public' });
});

app.get('/routines', (req, res) => {
  res.sendFile('routines.html', { root: __dirname + '/public' });
});

app.get('/about', (req, res) => {
  res.sendFile('about.html', { root: __dirname + '/public' });
});

// ─────────────────────────────────────────────
// API ENDPOINT 1: GET exercises from ExerciseDB (External API)
// Satisfies: "1 Must get data from some external provider"
// ─────────────────────────────────────────────

app.get('/api/exercises', async (req, res) => {
  const { bodyPart, equipment, limit = 20, offset = 0 } = req.query;

  try {
    let url;

    if (bodyPart) {
      url = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=${limit}&offset=${offset}`;
    } else if (equipment) {
      url = `https://exercisedb.p.rapidapi.com/exercises/equipment/${encodeURIComponent(equipment)}?limit=${limit}&offset=${offset}`;
    } else {
      url = `https://exercisedb.p.rapidapi.com/exercises?limit=${limit}&offset=${offset}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': EXERCISEDB_HOST
      }
    });

    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.length} exercises from ExerciseDB`);
    res.json(data);

  } catch (error) {
    console.error('ExerciseDB fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch exercises', details: error.message });
  }
});

// GET single exercise by ID from ExerciseDB
app.get('/api/exercises/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const response = await fetch(`https://exercisedb.p.rapidapi.com/exercises/exercise/${id}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': EXERCISEDB_HOST
      }
    });

    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('ExerciseDB single fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch exercise', details: error.message });
  }
});

// ─────────────────────────────────────────────
// API ENDPOINT 2: GET routines from Supabase
// Satisfies: "1 Must Retrieve Data from your database"
// ─────────────────────────────────────────────

app.get('/api/routines', async (req, res) => {
  console.log('Fetching all routines from Supabase');

  const { data, error } = await supabase
    .from('routines')
    .select(`
      *,
      routine_exercises (*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    res.status(500).json({ error: error.message });
  } else {
    console.log(`Returning ${data.length} routines`);
    res.json(data);
  }
});

// GET single routine by ID
app.get('/api/routines/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('routines')
    .select(`
      *,
      routine_exercises (*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.json(data);
  }
});

// ─────────────────────────────────────────────
// API ENDPOINT 3: POST routine to Supabase
// Satisfies: "1 Must Write Data to your DB"
// ─────────────────────────────────────────────

app.post('/api/routines', async (req, res) => {
  console.log('Creating new routine:', req.body);

  const { name, session_id, exercises } = req.body;

  if (!name || !session_id) {
    return res.status(400).json({ error: 'Routine name and session_id are required' });
  }

  // Insert the routine
  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .insert({ name, session_id })
    .select()
    .single();

  if (routineError) {
    console.error('Error creating routine:', routineError);
    return res.status(500).json({ error: routineError.message });
  }

  // Insert exercises if provided
  if (exercises && exercises.length > 0) {
    const exerciseRows = exercises.map((ex, index) => ({
      routine_id: routine.id,
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      exercise_order: index + 1,
      sets: ex.sets || 3,
      reps: ex.reps || 10,
      rest_seconds: ex.rest_seconds || 60
    }));

    const { error: exError } = await supabase
      .from('routine_exercises')
      .insert(exerciseRows);

    if (exError) {
      console.error('Error adding exercises:', exError);
      return res.status(500).json({ error: exError.message });
    }
  }

  console.log('Routine created successfully:', routine.id);
  res.status(201).json(routine);
});

// DELETE a routine
app.delete('/api/routines/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.json({ message: 'Routine deleted successfully' });
  }
});

// POST workout log
app.post('/api/logs', async (req, res) => {
  const { session_id, routine_id, notes } = req.body;

  const { data, error } = await supabase
    .from('workout_logs')
    .insert({ session_id, routine_id, notes })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.status(201).json(data);
  }
});

// GET workout logs
app.get('/api/logs', async (req, res) => {
  const { session_id } = req.query;

  let query = supabase.from('workout_logs').select('*').order('completed_at', { ascending: false });

  if (session_id) {
    query = query.eq('session_id', session_id);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.json(data);
  }
});

app.get('/api/gif', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  res.setHeader('Content-Type', 'image/gif');
  res.send(Buffer.from(buffer));
});

app.listen(port, () => {
  console.log(`🏋️  GymGuide server running on port ${port}`);
});
