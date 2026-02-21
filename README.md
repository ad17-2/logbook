# ELD Trip Planner

A full-stack application that generates FMCSA-compliant trip plans for commercial truck drivers. Given a current location, pickup, and dropoff, the system calculates a route, inserts mandatory HOS (Hours of Service) rest stops, and produces daily ELD log sheets with duty-status timelines rendered as SVG grid charts.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Architecture Overview](#architecture-overview)
- [HOS Rules Implemented](#hos-rules-implemented)
- [How Trip Planning Works](#how-trip-planning-works)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Environment Variables](#environment-variables)

---

## Problem Statement

Commercial motor vehicle (CMV) drivers in the United States must comply with FMCSA Hours of Service regulations (49 CFR Part 395). These rules cap driving time, mandate rest breaks, and limit total on-duty hours over rolling multi-day periods. Violations result in fines and out-of-service orders.

This application solves the planning problem: given a trip from A to B to C, when and where must the driver stop to remain compliant? It produces:

1. A route with total distance and driving time.
2. A list of stops (pickup, dropoff, 30-minute breaks, 10-hour rest periods, 34-hour restarts, fuel stops) with locations and times.
3. Daily log sheets with duty-status segments, hour totals, mileage, and 70-hour cycle recaps -- matching the format of FMCSA paper logs.

---

## Architecture Overview

```
+---------------------------+         +---------------------------+
|        Frontend           |         |         Backend           |
|  React 19 + TypeScript    |  HTTP   |  Django 4.2 + DRF         |
|  Vite 7 + Tailwind 4     | ------>  |  Python 3.11              |
|  Leaflet + react-leaflet  |         |  Gunicorn (prod)          |
|  Zod schema validation    |         |  SQLite (minimal, no ORM  |
+---------------------------+         |    models used)           |
          |                           +---------------------------+
          |                                      |
          |  (dev) Vite proxy /api -> :8000      |
          |  (prod) Nginx proxy /api -> backend  |
          |                                      |
          +--------------------------------------+
                                                 |
                              +------------------+------------------+
                              |                                     |
                    +-------------------+              +-------------------+
                    |   Nominatim API   |              |    OSRM API       |
                    | (OpenStreetMap)   |              | (routing engine)  |
                    |  Geocoding +      |              |  Route geometry,  |
                    |  location search  |              |  step-by-step     |
                    +-------------------+              |  segments         |
                                                       +-------------------+
```

**Key design decisions:**

- No database models are used. The application is stateless -- every trip plan is computed on the fly from external geocoding and routing APIs.
- The backend is a pure computation layer: geocode addresses, fetch route, simulate HOS constraints, generate daily logs.
- The frontend validates input with Zod schemas that transform snake_case API responses into camelCase TypeScript types at the boundary.
- Leaflet renders the route polyline and stop markers on an interactive map.
- Daily log sheets are rendered as SVG elements that replicate the standard FMCSA paper log grid (4 duty status rows x 24-hour timeline).

---

## HOS Rules Implemented

The application enforces the following FMCSA property-carrying vehicle rules, configured in `backend/trips/services/hos_calculator.py` as a frozen dataclass:

```python
@dataclass(frozen=True)
class HOSConfig:
    drive_limit: float = 11.0       # Max driving hours per shift
    window_limit: float = 14.0      # Max on-duty window per shift
    break_trigger: float = 8.0      # Must break after this many consecutive hours
    cycle_limit: float = 70.0       # Max on-duty hours in 8-day cycle
    fuel_distance: float = 1000.0   # Fuel stop every N miles
    rest_duration: float = 10.0     # Mandatory off-duty rest period (hours)
    restart_duration: float = 34.0  # Full cycle restart period (hours)
    break_duration: float = 0.5     # 30-minute break duration
    fuel_duration: float = 0.5      # Fuel stop duration
```

### Rule Details

| Rule | Limit | Consequence When Reached |
|------|-------|--------------------------|
| **11-Hour Driving Limit** | 11 hours of driving per shift | 10-hour off-duty rest period inserted |
| **14-Hour Duty Window** | 14 hours from shift start (driving + all on-duty time) | 10-hour off-duty rest period inserted |
| **30-Minute Break** | After 8 consecutive hours of driving | 30-minute off-duty break inserted |
| **70-Hour/8-Day Cycle** | 70 total on-duty hours in any 8-day period | 34-hour restart inserted (resets cycle to 0) |
| **Fuel Stop** | Every 1,000 miles driven | 30-minute on-duty fuel stop inserted |

After a **10-hour rest**, the driver's shift resets: drive time, elapsed shift time, and break timer all go to zero. After a **34-hour restart**, the cycle counter also resets to zero.

---

## How Trip Planning Works

The trip planning pipeline runs through four services invoked by `plan_trip()` in `backend/trips/services/trip_planner.py`:

### Step 1: Geocoding

`geocoding.py` resolves each text address (current, pickup, dropoff) to coordinates via the Nominatim API. Each result contains `lat`, `lng`, and `display_name`. Results are restricted to US addresses (`countrycodes=us`).

### Step 2: Route Calculation

`routing.py` sends the three waypoints to the OSRM API as a single multi-stop route request (`current -> pickup -> dropoff`). The response includes:

- A full-resolution polyline (decoded from Google's encoded polyline format via the `polyline` library).
- Two legs, each broken into step-level segments with distance (miles) and duration (hours).

The segments are split into `to_pickup_segments` and `to_dropoff_segments` for the HOS calculator.

### Step 3: HOS Simulation

`hos_calculator.py` is a state-machine simulator. It maintains a `DriverState`:

```python
@dataclass
class DriverState:
    current_time: datetime
    drive_time_used: float = 0          # Hours driven this shift
    elapsed_since_shift_start: float = 0 # Hours since shift began
    time_since_last_break: float = 0     # Hours since last 30-min break
    cycle_hours_used: float = 0          # Total on-duty hours in cycle
    miles_since_last_fuel: float = 0     # Miles since last fuel stop
    total_miles_driven: float = 0
    shift_started: bool = False
    timeline: list = field(default_factory=list)
```

For each route segment, the simulator:

1. Calculates how far the driver can go before hitting any limit (drive limit, window limit, break trigger, cycle limit, fuel distance).
2. Takes the minimum of all limits and the remaining segment distance.
3. Appends a `driving` event to the timeline.
4. If a limit is reached (drivable time is zero), inserts the appropriate stop:
   - **Cycle limit reached** -> 34-hour restart
   - **Drive limit or window limit reached** -> 10-hour rest
   - **Break trigger reached** -> 30-minute break
   - **Fuel distance reached** -> 30-minute fuel stop
5. Repeats until the segment is fully consumed.

Between the two route legs, a 1-hour **Pickup** on-duty activity is inserted. After the second leg, a 1-hour **Dropoff** activity is inserted. These on-duty activities also respect the 14-hour window and 70-hour cycle limits.

The output is a chronological `timeline` -- a flat list of events, each with:
- `status`: one of `driving`, `on_duty_not_driving`, `off_duty`, `sleeper_berth`
- `start_time` / `end_time`: datetime objects
- `duration_hours`, `location`, `remark`, `miles`
- `is_stop`: whether this event represents a stop the driver must make
- `event_type_label`: `pickup`, `dropoff`, `rest_break`, `ten_hr_rest`, `fuel`

### Step 4: Daily Log Generation

`log_generator.py` slices the timeline into calendar days (midnight UTC boundaries). For each day:

1. **Segment extraction**: Events that overlap the day are clipped to [day_start, day_end]. Each produces a segment with `status`, `start_time` (0-24 hours), `end_time` (0-24 hours).
2. **Merging**: Consecutive segments with the same status and no remark are merged.
3. **Gap filling**: Any uncovered periods within the 24-hour day are filled with `off_duty` segments. The result is a gapless 0-24 timeline.
4. **Totals**: Hours per duty status are summed.
5. **Cycle recap**: Cumulative on-duty hours (driving + on_duty_not_driving) are tracked across days for the 70-hour/8-day recap.
6. **Location labels**: From/to labels are derived from waypoint names (start, pickup, dropoff) or "En route".

Each daily log contains: date, day number, from/to locations, total miles, segments array, totals by status, cycle recap, and remarks.

---

## Backend Architecture

### Django Project Layout

The backend uses a split settings pattern (`config/settings/base.py`, `local.py`, `production.py`) and a single Django app `trips` with no database models.

### Service Layer

All business logic lives in `trips/services/`:

| Module | Responsibility |
|--------|---------------|
| `geocoding.py` | Address-to-coordinates via Nominatim |
| `location_search.py` | Autocomplete location search via Nominatim |
| `routing.py` | Multi-waypoint routing via OSRM, polyline decoding, segment extraction |
| `hos_calculator.py` | HOS state machine simulator, generates timeline of driving/rest events |
| `log_generator.py` | Slices timeline into daily ELD log sheets with segments, totals, recaps |
| `trip_planner.py` | Orchestrator -- calls geocoding, routing, HOS, log generation |

### API Layer

| Module | Responsibility |
|--------|---------------|
| `api/views.py` | Two class-based views: `TripPlanView` (POST), `LocationSearchView` (GET) |
| `api/serializers.py` | DRF serializers for request validation and response shaping |
| `api/exceptions.py` | Custom exception classes (`GeocodingError`, `RoutingError`, `LocationNotFound`) and a custom exception handler that normalizes all errors to `{errors: [...], status_code: N}` |
| `api/urls.py` | Route registration under `/api/` |

### External Dependencies

| Service | Purpose | Default URL |
|---------|---------|-------------|
| Nominatim | Geocoding and location search | `https://nominatim.openstreetmap.org` |
| OSRM | Route calculation | `http://router.project-osrm.org` |

Both URLs are configurable via environment variables.

---

## Frontend Architecture

### Tech Stack

- **React 19** with TypeScript 5.9
- **Vite 7** for dev server and build
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin
- **Leaflet** + **react-leaflet 5** for map rendering
- **Zod 4** for runtime API response validation and snake_case-to-camelCase transformation

### Component Tree

```
App
 +-- TripProvider (context)
      +-- AppContent
           +-- TripForm
           |    +-- LocationInput (x3: current, pickup, dropoff)
           |    |    +-- useLocationSearch (debounced autocomplete)
           |    |    +-- useClickOutside (dropdown dismissal)
           |    +-- Cycle used slider + number input
           |    +-- Start time datetime input
           +-- TripResults (shown after successful plan)
           |    +-- Stat cards (distance, driving time, days, stops)
           |    +-- RouteMap
           |    |    +-- MapContainer + TileLayer (OpenStreetMap)
           |    |    +-- Polyline (route)
           |    |    +-- Marker + Popup (per stop)
           |    |    +-- FitBounds (auto-zoom to route)
           |    +-- LogSheet (per day)
           |         +-- LogSheetGrid (SVG)
           |              +-- GridBackground (24h grid, hour labels, status rows)
           |              +-- DutyStatusLines (horizontal + vertical line segments)
           |              +-- TotalHoursColumn (per-status totals)
           +-- LoadingSkeleton (shimmer animation during API call)
```

### State Management

State is managed via React Context + `useReducer`:

```typescript
// State shape
interface AppState {
  input: TripInput;
  loading: boolean;
  result: TripResult | null;
  error: string | null;
}

// Actions
type Action =
  | { type: 'SET_INPUT'; payload: TripInput }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RESULT'; payload: TripResult }
  | { type: 'SET_ERROR'; payload: string };
```

The `TripProvider` wraps the app. Components access state via `useTripContext()`.

### API Layer

The frontend API layer in `src/api/` consists of:

- **`client.ts`**: Base `apiFetch<T>()` function that prepends `VITE_API_URL`, sets JSON headers, and throws `ApiError` with structured error data on non-2xx responses.
- **`trips.ts`**: `planTrip(input)` -- POSTs to `/api/trip/plan/`, transforms camelCase input to snake_case for the backend, validates and transforms the response through `tripPlanResponseSchema`.
- **`locations.ts`**: `searchLocations(query)` -- GETs `/api/locations/search/?q=...`, validates response through `locationSearchResultSchema`.
- **`schemas.ts`**: Zod schemas with `.transform()` that convert snake_case API responses to camelCase TypeScript types.

### Form Validation

The trip form uses a Zod schema for client-side validation:

```typescript
const tripSchema = z.object({
  currentLocation: z.string().min(3, 'Location must be at least 3 characters'),
  pickupLocation: z.string().min(3, 'Location must be at least 3 characters'),
  dropoffLocation: z.string().min(3, 'Location must be at least 3 characters'),
  currentCycleUsed: z.number().min(0).max(70),
  startTime: z.string(),
}).refine(
  (d) => d.pickupLocation.trim().toLowerCase() !== d.dropoffLocation.trim().toLowerCase(),
  { message: 'Dropoff must be different from pickup', path: ['dropoffLocation'] },
);
```

Validation errors display on blur. A warning (not an error) appears when cycle hours exceed 60.

### Hooks

| Hook | Purpose |
|------|---------|
| `useLocationSearch(query)` | Debounces input (300ms), fetches location suggestions, manages dropdown open state and keyboard active index |
| `useDebounce(value, delay)` | Generic debounce hook |
| `useClickOutside(ref, callback)` | Fires callback on mousedown outside the ref element |

### Log Sheet Grid (SVG)

The `LogSheetGrid` component renders an SVG chart that replicates the standard FMCSA paper log format:

- **Grid dimensions**: 1020x340 viewBox, grid area from x=140 to x=920, 4 rows of 45px each.
- **Hour columns**: 24 columns with 15-minute tick marks. Midnight and Noon are labeled and emphasized.
- **Duty status rows**: Off Duty, Sleeper Berth, Driving, On Duty (Not Driving) -- matching the standard ELD row order.
- **Line drawing**: Each segment draws a horizontal line at its status row's center Y. Vertical lines connect consecutive segments at different status levels.
- **Total hours column**: Per-status totals and grand total displayed to the right of the grid.

---

## API Reference

### POST /api/trip/plan/

Plans a trip with HOS-compliant stops and generates daily log sheets.

**Request Body:**

```json
{
  "current_location": "San Francisco, CA",
  "pickup_location": "Sacramento, CA",
  "dropoff_location": "New York, NY",
  "current_cycle_used": 10.0,
  "start_time": "2026-01-15T08:00:00Z"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `current_location` | string | yes | 2-500 characters |
| `pickup_location` | string | yes | 2-500 characters |
| `dropoff_location` | string | yes | 2-500 characters, must differ from pickup |
| `current_cycle_used` | float | yes | 0-70 |
| `start_time` | ISO 8601 datetime | no | Defaults to current UTC time |

**Response (200):**

```json
{
  "route": {
    "total_distance_miles": 2850.3,
    "total_duration_hours": 42.15,
    "polyline": [[37.77, -122.42], [38.58, -121.49], ...]
  },
  "stops": [
    {
      "type": "rest_break",
      "location": { "lat": 39.52, "lng": -119.81, "name": "Reno, Nevada" },
      "arrival_time": "2026-01-15T16:00:00+00:00",
      "departure_time": "2026-01-15T16:30:00+00:00",
      "duration_hours": 0.5
    },
    {
      "type": "pickup",
      "location": { "lat": 38.58, "lng": -121.49, "name": "Sacramento, California" },
      "arrival_time": "2026-01-15T10:00:00+00:00",
      "departure_time": "2026-01-15T11:00:00+00:00",
      "duration_hours": 1.0
    }
  ],
  "daily_logs": [
    {
      "date": "2026-01-15",
      "day_number": 1,
      "from_location": "San Francisco, California",
      "to_location": "En route",
      "total_miles": 520,
      "segments": [
        { "status": "off_duty", "start_time": 0, "end_time": 8, "remark": "" },
        { "status": "driving", "start_time": 8, "end_time": 16, "remark": "" },
        { "status": "off_duty", "start_time": 16, "end_time": 16.5, "remark": "30-min break" },
        { "status": "driving", "start_time": 16.5, "end_time": 19, "remark": "" },
        { "status": "sleeper_berth", "start_time": 19, "end_time": 24, "remark": "" }
      ],
      "totals": {
        "off_duty": 8.5,
        "sleeper_berth": 5,
        "driving": 10.5,
        "on_duty_not_driving": 0
      },
      "recap": {
        "cycle_hours_used": 20.5,
        "cycle_hours_available": 49.5
      },
      "remarks": ["30-min break - Reno, Nevada"]
    }
  ]
}
```

**Stop types:** `pickup`, `dropoff`, `rest_break`, `ten_hr_rest`, `fuel`

**Duty statuses:** `off_duty`, `sleeper_berth`, `driving`, `on_duty_not_driving`

**Segment times:** `start_time` and `end_time` in segments are decimal hours from midnight (0-24), not ISO timestamps.

**Error Response (400/502):**

```json
{
  "errors": [
    { "field": "dropoff_location", "message": "Dropoff location must be different from pickup location." }
  ],
  "status_code": 400
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Validation error or address not found |
| 502 | External service (Nominatim or OSRM) unavailable |

---

### GET /api/locations/search/

Returns location autocomplete suggestions for the given query.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | yes | Search query (min 2 characters) |

**Response (200):**

```json
[
  { "name": "San Francisco, San Francisco County, California, USA", "lat": 37.7749, "lng": -122.4194 },
  { "name": "San Jose, Santa Clara County, California, USA", "lat": 37.3382, "lng": -121.8863 }
]
```

Returns an empty array if the query is shorter than 2 characters.

---

## Project Structure

```
logbook/
+-- docker-compose.yml          # Development: backend + frontend with hot-reload
+-- docker-compose.prod.yml     # Production: backend (gunicorn) + frontend (nginx)
+-- .gitignore
+--
+-- backend/
|   +-- Dockerfile              # Python 3.11-slim, gunicorn, collectstatic
|   +-- manage.py
|   +-- requirements.txt        # Django 4.2, DRF, requests, polyline, django-environ
|   +-- pyproject.toml          # pytest config (DJANGO_SETTINGS_MODULE, pythonpath)
|   +--
|   +-- config/
|   |   +-- urls.py             # Root URL conf: /admin/, /api/
|   |   +-- wsgi.py
|   |   +-- asgi.py
|   |   +-- settings/
|   |       +-- base.py         # Shared settings, REST_FRAMEWORK, logging, external URLs
|   |       +-- local.py        # DEBUG=True, CORS_ALLOW_ALL_ORIGINS=True
|   |       +-- production.py   # DEBUG=False, secure cookies, env-based ALLOWED_HOSTS
|   |
|   +-- trips/
|       +-- apps.py
|       +-- models.py           # Empty (no database models)
|       +-- admin.py
|       +--
|       +-- api/
|       |   +-- urls.py         # trip/plan/, locations/search/
|       |   +-- views.py        # TripPlanView, LocationSearchView
|       |   +-- serializers.py  # Request/response serializers
|       |   +-- exceptions.py   # GeocodingError, RoutingError, LocationNotFound, custom handler
|       |
|       +-- services/
|       |   +-- trip_planner.py     # Orchestrator
|       |   +-- geocoding.py        # Nominatim geocoding
|       |   +-- location_search.py  # Nominatim location search
|       |   +-- routing.py          # OSRM routing + polyline decode
|       |   +-- hos_calculator.py   # HOS state machine
|       |   +-- log_generator.py    # Timeline-to-daily-log conversion
|       |
|       +-- tests/
|           +-- test_services.py    # HOS calculator tests
|           +-- test_serializers.py # Request serializer validation tests
|           +-- test_views.py       # API integration tests (mocked external services)
|
+-- frontend/
|   +-- Dockerfile              # Multi-stage: node build + nginx serve
|   +-- Dockerfile.dev          # Dev container with hot-reload
|   +-- nginx.conf              # Reverse proxy /api/ to backend, SPA fallback
|   +-- package.json            # React 19, Leaflet, Zod 4, Vitest, Testing Library
|   +-- vite.config.ts          # Vite + React + Tailwind plugins, /api proxy, test config
|   +-- tsconfig.json
|   +-- index.html
|   +--
|   +-- src/
|       +-- main.tsx                # React root
|       +-- App.tsx                 # Layout, conditional results display
|       +-- types.ts                # TypeScript interfaces for all domain types
|       +-- index.css               # Tailwind theme (custom design tokens), animations
|       +--
|       +-- api/
|       |   +-- client.ts           # apiFetch(), ApiError class
|       |   +-- trips.ts            # planTrip()
|       |   +-- locations.ts        # searchLocations()
|       |   +-- schemas.ts          # Zod schemas with snake_case -> camelCase transforms
|       |
|       +-- context/
|       |   +-- trip-context-value.ts  # AppState, Action types, createContext
|       |   +-- trip-context.tsx       # TripProvider with useReducer
|       |   +-- use-trip-context.ts    # useTripContext() hook
|       |
|       +-- hooks/
|       |   +-- use-debounce.ts        # Generic debounce
|       |   +-- use-click-outside.ts   # Click-outside detection
|       |   +-- use-location-search.ts # Autocomplete with debounce
|       |
|       +-- lib/
|       |   +-- format.ts             # formatHours(), formatTime(), stopTypeName()
|       |   +-- constants.ts          # HOS_CYCLE_LIMIT, STOP_COLORS, DUTY_STATUS_CONFIG
|       |
|       +-- components/
|       |   +-- loading-skeleton.tsx
|       |   +-- form/
|       |   |   +-- trip-form.tsx      # Main form with Zod validation
|       |   |   +-- location-input.tsx # Autocomplete input with dropdown
|       |   +-- results/
|       |       +-- trip-results.tsx   # Stats grid + map + log sheets
|       |       +-- route-map.tsx      # Leaflet map with route and stop markers
|       |       +-- log-sheet.tsx      # Daily log card (header, grid, remarks, recap)
|       |       +-- log-sheet-grid.tsx # SVG grid replicating FMCSA paper log format
|       |
|       +-- __tests__/
|           +-- setup.ts              # jest-dom/vitest setup
|           +-- format.test.ts        # Utility function tests
|           +-- api.test.ts           # Schema validation + API client tests
|           +-- trip-form.test.tsx     # Form rendering + validation + submission tests
|           +-- location-input.test.tsx # Autocomplete behavior tests
|
+-- resources/                        # Reference materials
    +-- blank-paper-log.png
    +-- fmcsa-hos-395-drivers-guide-to-hos-2022-04-28-0-1-.pdf
    +-- fmsca-image.png
    +-- new-full-stack-dev-assessment.docx
```

---

## Running the Application

### Docker (recommended)

**Development** (with hot-reload on both frontend and backend):

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000

The Vite dev server proxies `/api` requests to the backend container.

**Production:**

```bash
docker compose -f docker-compose.prod.yml up --build
```

- Application: http://localhost (nginx serves frontend, proxies `/api` to backend)
- Backend: http://localhost:8000

### Local Development (without Docker)

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver
```

The backend runs on http://localhost:8000.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on http://localhost:5173 and proxies `/api` to http://localhost:8000 (configurable via `VITE_API_TARGET`).

---

## Testing

### Backend Tests

```bash
cd backend
pip install -r requirements.txt
pytest
```

The test suite covers:

| File | What it tests |
|------|---------------|
| `test_services.py` | HOS calculator: short trips without breaks, 30-min break after 8h, 10-hour rest after drive limit, 34-hour restart after cycle limit, fuel stops, timeline chronological order, zero-distance segment handling. Also verifies `HOSConfig` default values and immutability. |
| `test_serializers.py` | Request validation: valid data, minimum length, negative/over-max cycle hours, same pickup/dropoff rejection, optional start_time, missing required fields. |
| `test_views.py` | API integration: successful trip plan (mocked geocode + route), validation error responses, geocoding failure propagation, location search success/empty/short query/service failure. |

Tests use `pytest-django`. External services (Nominatim, OSRM) are mocked in view and integration tests.

### Frontend Tests

```bash
cd frontend
npm run test
```

The test suite uses Vitest + Testing Library:

| File | What it tests |
|------|---------------|
| `format.test.ts` | `formatHours()` edge cases (0, whole, fractional, large, rounding), `stopTypeName()` known and unknown types. |
| `api.test.ts` | Zod schema parsing (valid response, missing fields, invalid polyline), `ApiError` construction, `apiFetch()` success/structured errors/fallback errors/unparseable responses. |
| `trip-form.test.tsx` | Form rendering, disabled submit when incomplete, enabled submit when valid, dropoff-matches-pickup validation, cycle warning at 60+, `planTrip()` called on submit. |
| `location-input.test.tsx` | Renders label/input, onChange fires, error display, suggestion dropdown appearance, suggestion click selection, keyboard navigation (ArrowDown/Enter), Escape to close, onBlur callback. |

---

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SETTINGS_MODULE` | `config.settings.production` | Settings module to use |
| `DJANGO_SECRET_KEY` | `django-insecure-dev-key-...` | Django secret key (change in production) |
| `NOMINATIM_BASE_URL` | `https://nominatim.openstreetmap.org` | Nominatim geocoding API base URL |
| `OSRM_BASE_URL` | `http://router.project-osrm.org` | OSRM routing API base URL |
| `ALLOWED_HOSTS` | `[]` | Comma-separated list of allowed hosts (production) |
| `CORS_ALLOWED_ORIGINS` | `[]` | Comma-separated list of allowed CORS origins (production) |
| `SECURE_SSL_REDIRECT` | `False` | Redirect HTTP to HTTPS (production) |
| `SECURE_HSTS_SECONDS` | `0` | HSTS header seconds (production) |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` (empty, uses relative paths) | API base URL for production builds |
| `VITE_API_TARGET` | `http://localhost:8000` | Vite dev server proxy target for `/api` |
