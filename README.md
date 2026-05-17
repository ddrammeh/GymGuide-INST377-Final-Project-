# 🏋️ GymGuide — Workout Exercise Library

## 1. Title
**GymGuide** — Workout Exercise Library

---

## 2. Description

GymGuide is a full-stack web application that helps gym-goers find exercises, build custom workout routines, and track their consistency. Users can browse 1,300+ exercises from the ExerciseDB API filtered by muscle group (chest, back, legs, arms, shoulders, core) or available equipment (dumbbells, barbell, cables, bodyweight, etc.). Exercises are displayed with animated GIFs and step-by-step form instructions.

Users can save exercises into named routines (e.g. "Push Day", "Leg Day"), which are stored in a cloud database. A weekly bar chart visualizes workout completion history, and all data persists across sessions without requiring a login.

**Key Features:**
- Browse & filter 1,300+ exercises via ExerciseDB API
- Save exercises to custom named routines
- Log completed workouts
- Weekly activity chart (Chart.js)
- Responsive design — works on mobile at the gym
- No login required (session-based user data)

**Live Deployment:** [Your Vercel URL here]

**GitHub Repository:** [Your GitHub URL here]

---

## 3. Target Browsers

GymGuide is designed and tested for the following browsers:

| Platform | Browser | Version |
|----------|---------|---------|
| Desktop | Google Chrome | 120+ |
| Desktop | Mozilla Firefox | 121+ |
| Desktop | Microsoft Edge | 120+ |
| Desktop | Apple Safari | 17+ |
| iOS (iPhone/iPad) | Safari Mobile | iOS 16+ |
| Android | Chrome Mobile | 120+ |

The app uses CSS Flexbox/Grid, `fetch()`, `localStorage`, and `async/await` — all of which are supported in all modern browsers listed above. Internet Explorer is not supported.

---

## 4. Link to Developer Manual

See the [Developer Manual](#developer-manual) section below.

---

---

# Developer Manual

> **Audience:** Future developers who will maintain or extend GymGuide. You should have general web development knowledge (Node.js, npm, HTML/CSS/JS, REST APIs) but do not need prior knowledge of this specific system.

---

## 1. Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)
- A [Supabase](https://supabase.com) account (free)
- A [RapidAPI](https://rapidapi.com) account with ExerciseDB subscribed (free tier)
- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free)

### Clone and Install

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/gymguide.git
cd gymguide

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
```

Then edit `.env` with your real values:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_anon_key
RAPIDAPI_KEY=your_rapidapi_key
```

**Where to get each value:**
- `SUPABASE_URL` and `SUPABASE_KEY`: Go to [supabase.com](https://supabase.com) → Your Project → Settings → API
- `RAPIDAPI_KEY`: Go to [RapidAPI ExerciseDB](https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb) → Subscribe (free) → copy your key from the header examples

---

## 2. Setting Up the Database

1. Log in to [supabase.com](https://supabase.com) and open your project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of `docs/supabase_setup.sql`
5. Click **Run**
6. Confirm all 5 tables were created: `routines`, `routine_exercises`, `workout_logs`, `exercise_cache`, `favorites`

> If you see a policy already exists error, that's okay — just remove the `CREATE POLICY` lines from the SQL and re-run.

---

## 3. Running the Application Locally

```bash
npm start
```

This runs the server using `nodemon`, which auto-restarts on file changes.

Open your browser to: **http://localhost:3000**

The app serves:
- `http://localhost:3000/` → Home page (exercise browser)
- `http://localhost:3000/routines` → My Routines page
- `http://localhost:3000/about` → About page

---

## 4. Running Tests

No automated tests are currently written for this project. To manually verify functionality:

1. **Exercise Fetch:** Load the home page, click "Chest" → exercises should appear with GIFs
2. **Equipment Filter:** Check "Dumbbells" → click Apply Filters → dumbbell exercises appear
3. **Save Routine:** Click "Save to Routine" on any exercise → fill in routine name → confirm toast appears
4. **Routines Page:** Go to `/routines` → your saved routine should appear
5. **Log Workout:** Click "✓ Done" on a routine → confirm chart updates

To test API endpoints directly, use a tool like [Insomnia](https://insomnia.rest/) or curl:

```bash
# Get chest exercises
curl "http://localhost:3000/api/exercises?bodyPart=chest"

# Get all routines
curl "http://localhost:3000/api/routines"

# Create a routine
curl -X POST http://localhost:3000/api/routines \
  -H "Content-Type: application/json" \
  -d '{"name":"Push Day","session_id":"test123","exercises":[{"exercise_id":"0001","exercise_name":"Bench Press","sets":3,"reps":10}]}'
```

---

## 5. API Documentation

All API endpoints are defined in `index.js`. The frontend at `public/` calls these endpoints via `fetch()`.

---

### `GET /api/exercises`

**Description:** Fetches exercises from the ExerciseDB external API. Supports filtering by body part or equipment. This satisfies the "external provider" API requirement.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bodyPart` | string | No | Filter by body part (e.g. `chest`, `back`, `legs`, `upper arms`, `shoulders`, `waist`) |
| `equipment` | string | No | Filter by equipment (e.g. `dumbbell`, `barbell`, `body weight`, `cable`, `machine`, `kettlebell`) |
| `limit` | number | No | Number of results (default: 15) |
| `offset` | number | No | Pagination offset (default: 0) |

**Example Request:**
```
GET /api/exercises?bodyPart=chest&limit=15&offset=0
```

**Example Response:**
```json
[
  {
    "id": "0007",
    "name": "alternate incline dumbbell curl",
    "bodyPart": "upper arms",
    "equipment": "dumbbell",
    "target": "biceps",
    "gifUrl": "https://...",
    "instructions": ["Step 1...", "Step 2..."]
  }
]
```

---

### `GET /api/exercises/:id`

**Description:** Fetches a single exercise by its ExerciseDB ID.

**URL Params:** `id` — the exercise ID string (e.g. `0007`)

**Example:** `GET /api/exercises/0007`

---

### `GET /api/routines`

**Description:** Retrieves all saved workout routines from Supabase, with their exercises. This satisfies the "retrieve data from DB" requirement.

**Response:** Array of routine objects, each containing a `routine_exercises` array.

**Example Response:**
```json
[
  {
    "id": 1,
    "session_id": "sess_abc123",
    "name": "Push Day",
    "created_at": "2026-05-01T12:00:00Z",
    "routine_exercises": [
      {
        "id": 1,
        "exercise_id": "0001",
        "exercise_name": "Bench Press",
        "sets": 3,
        "reps": 10,
        "rest_seconds": 60
      }
    ]
  }
]
```

---

### `GET /api/routines/:id`

**Description:** Fetches a single routine by its database ID.

---

### `POST /api/routines`

**Description:** Creates a new workout routine and saves it to Supabase. This satisfies the "write data to DB" requirement.

**Request Body:**
```json
{
  "name": "Push Day",
  "session_id": "sess_abc123",
  "exercises": [
    {
      "exercise_id": "0001",
      "exercise_name": "Bench Press",
      "sets": 3,
      "reps": 10,
      "rest_seconds": 60
    }
  ]
}
```

**Response:** The created routine object (HTTP 201).

---

### `DELETE /api/routines/:id`

**Description:** Deletes a routine and all its exercises (cascade delete).

**Response:** `{ "message": "Routine deleted successfully" }`

---

### `POST /api/logs`

**Description:** Logs a completed workout session to Supabase.

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "routine_id": 1,
  "notes": "Completed Push Day"
}
```

---

### `GET /api/logs`

**Description:** Retrieves workout logs for a session (used by the weekly chart).

**Query Parameters:** `session_id` — the browser session ID

---

## 6. Known Bugs & Future Development Roadmap

### Known Bugs

| Bug | Description | Workaround |
|-----|-------------|------------|
| GIF load failures | Some ExerciseDB GIFs may fail to load if CDN is slow | Images show blank on error — no crash |
| Equipment filter: one at a time | ExerciseDB only supports filtering by one equipment type per request | Select one at a time |
| Session data not shared | Routines are tied to a browser session ID. Switching browsers loses data. | Use the same browser |
| Rate limit | ExerciseDB free tier: 100 requests/day | Cache exercises locally; avoid excessive refreshes |

### Roadmap for Future Development

**High Priority**
- [ ] User authentication (replace session IDs with Supabase Auth accounts)
- [ ] Add exercise to an existing routine (currently creates a new routine each time)
- [ ] Search exercises by name with backend filtering

**Medium Priority**
- [ ] Favorites system (save exercises to a quick-access list)
- [ ] Edit routine (change sets/reps/exercise order)
- [ ] Workout timer with rest period countdown

**Low Priority / Nice to Have**
- [ ] Shareable routine links
- [ ] Progress tracking (log weight/reps per set over time)
- [ ] Progressive Web App (PWA) support for offline access
- [ ] YouTube API integration for video form demonstrations

---

*Documentation written for INST377 — Dynamic Web Applications, University of Maryland*
