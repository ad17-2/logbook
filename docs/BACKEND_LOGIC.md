# Backend Business Logic

This document provides an in-depth walkthrough of the backend business logic -- from the moment a trip plan request arrives to the final response containing route data, stops, and daily ELD logs. It covers every service module, traces the full execution path, and explains the HOS simulation algorithm in detail.

All business logic lives in `backend/trips/services/`. The API layer (`backend/trips/api/`) handles HTTP concerns (serialization, validation, error formatting) and delegates entirely to the service layer.

---

## Table of Contents

- [Trip Planning Pipeline](#trip-planning-pipeline)
- [Route Service](#route-service)
- [HOS Calculator](#hos-calculator)
- [Stop Generation](#stop-generation)
- [Daily Log Generation](#daily-log-generation)
- [Duty Status Segments](#duty-status-segments)

---

## Trip Planning Pipeline

When `POST /api/trip/plan/` is called, the request flows through these layers:

### 1. API Entry Point (`api/views.py`)

```python
class TripPlanView(APIView):
    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = plan_trip(serializer.validated_data)
        response_serializer = TripPlanResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
```

The view does three things:

1. **Validates the request** via `TripPlanRequestSerializer`. This checks field types, lengths, ranges, and enforces that pickup and dropoff locations differ (case-insensitive comparison). If validation fails, DRF raises a `ValidationError` that the custom exception handler normalizes into `{errors: [...], status_code: 400}`.
2. **Delegates to `plan_trip()`** with the validated data dictionary.
3. **Serializes the response** through `TripPlanResponseSerializer` to enforce the output contract.

### 2. Orchestrator (`services/trip_planner.py`)

`plan_trip()` is the orchestrator. It calls four services in sequence:

```
plan_trip(data)
  |
  +--> geocode(current_location)  \
  +--> geocode(pickup_location)    |-- Step 1: Geocoding (3 calls)
  +--> geocode(dropoff_location)  /
  |
  +--> get_route(current, pickup, dropoff)  -- Step 2: Route calculation
  |
  +--> calculate_hos(...)                   -- Step 3: HOS simulation
  |
  +--> generate_daily_logs(timeline, ...)   -- Step 4: Daily log generation
  |
  +--> Extract stops from timeline          -- Step 5: Stop extraction
  +--> Build response dict                  -- Step 6: Response assembly
```

The full function:

```python
def plan_trip(data: dict) -> dict:
    start_time = data.get('start_time') or datetime.now(timezone.utc)
    current_cycle_used = data['current_cycle_used']

    current_coords = geocode(data['current_location'])
    pickup_coords = geocode(data['pickup_location'])
    dropoff_coords = geocode(data['dropoff_location'])

    route = get_route(current_coords, pickup_coords, dropoff_coords)

    timeline = calculate_hos(
        to_pickup_segments=route['to_pickup_segments'],
        to_dropoff_segments=route['to_dropoff_segments'],
        current_cycle_used=current_cycle_used,
        start_time=start_time,
        pickup_coords=pickup_coords,
        dropoff_coords=dropoff_coords,
    )

    stops = [
        {
            'type': e['event_type_label'],
            'location': e['location'],
            'arrival_time': e['start_time'].isoformat(),
            'departure_time': e['end_time'].isoformat(),
            'duration_hours': round(e['duration_hours'], 2),
        }
        for e in timeline
        if e.get('is_stop')
    ]

    waypoint_names = {
        'start': _short_name(current_coords['name']),
        'pickup': _short_name(pickup_coords['name']),
        'dropoff': _short_name(dropoff_coords['name']),
    }

    daily_logs = generate_daily_logs(timeline, current_cycle_used, waypoint_names)

    for stop in stops:
        stop['location'] = {**stop['location'], 'name': _short_name(stop['location'].get('name', ''))}

    return {
        'route': {
            'total_distance_miles': route['total_distance_miles'],
            'total_duration_hours': route['total_duration_hours'],
            'polyline': route['polyline'],
        },
        'stops': stops,
        'daily_logs': daily_logs,
    }
```

**Key details:**

- `start_time` defaults to the current UTC time if not provided.
- `_short_name()` extracts a city-and-state label from the Nominatim `display_name` string (e.g., "San Francisco, San Francisco County, California, USA" becomes "San Francisco, California").
- Stops are extracted from the timeline by filtering events where `is_stop` is `True`.
- Location names on stops are shortened after extraction for a cleaner API response.

### 3. Request Validation (`api/serializers.py`)

```python
class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(min_length=2, max_length=500)
    pickup_location = serializers.CharField(min_length=2, max_length=500)
    dropoff_location = serializers.CharField(min_length=2, max_length=500)
    current_cycle_used = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.DateTimeField(required=False)
```

Cross-field validation rejects requests where pickup and dropoff are identical (case-insensitive, whitespace-trimmed):

```python
def validate(self, data):
    if data['pickup_location'].strip().lower() == data['dropoff_location'].strip().lower():
        raise serializers.ValidationError(
            {'dropoff_location': 'Dropoff location must be different from pickup location.'}
        )
    return data
```

### 4. Error Handling (`api/exceptions.py`)

Three custom exception classes map to HTTP status codes:

| Exception | HTTP Status | Trigger |
|-----------|-------------|---------|
| `GeocodingError` | 502 | Nominatim API unreachable or returns an error |
| `RoutingError` | 502 | OSRM API unreachable or returns an error |
| `LocationNotFound` | 400 | Nominatim returns zero results for an address |

All exceptions pass through `custom_exception_handler`, which normalizes DRF's error responses into a consistent shape:

```json
{
  "errors": [
    { "field": "field_name", "message": "Error description" }
  ],
  "status_code": 400
}
```

The handler iterates over `response.data` (which can be a dict of field-to-messages or a flat list) and flattens everything into the `errors` array.

---

## Route Service

### Geocoding (`services/geocoding.py`)

`geocode(address)` resolves a text address to geographic coordinates using the Nominatim API.

**Request:**

```
GET {NOMINATIM_BASE_URL}/search?q={address}&format=json&limit=1&countrycodes=us
```

- `countrycodes=us` restricts results to US addresses.
- `limit=1` returns only the top result.
- A `User-Agent: ELDTripPlanner/1.0` header is sent (required by Nominatim's usage policy).
- Timeout: 10 seconds.

**Return value:**

```python
{
    'lat': float(result['lat']),
    'lng': float(result['lon']),
    'name': result.get('display_name', address),
}
```

If Nominatim returns an empty result set, a `LocationNotFound` exception is raised. If the HTTP request itself fails, a `GeocodingError` is raised.

### Route Calculation (`services/routing.py`)

`get_route(current, pickup, dropoff)` fetches a multi-waypoint driving route from the OSRM API.

**Request:**

```
GET {OSRM_BASE_URL}/route/v1/driving/{lng1},{lat1};{lng2},{lat2};{lng3},{lat3}
    ?overview=full&geometries=polyline&steps=true
```

- Coordinates are formatted as `lng,lat` (OSRM convention -- longitude first).
- `overview=full` returns the complete route geometry (not simplified).
- `geometries=polyline` returns the geometry in Google's encoded polyline format.
- `steps=true` returns turn-by-turn step segments for each leg.
- Timeout: 30 seconds.

**Polyline decoding:**

The `polyline` library decodes the encoded geometry string into a list of `[lat, lng]` coordinate pairs:

```python
geometry = polyline_lib.decode(route['geometry'])
```

This decoded polyline is what the frontend renders on the Leaflet map.

**Segment extraction:**

The OSRM response contains two legs (current-to-pickup and pickup-to-dropoff). Each leg contains step-level segments. For each step:

```python
distance_miles = step['distance'] * METERS_TO_MILES  # 0.000621371
duration_hours = step['duration'] / 3600
```

Steps with distance less than 0.01 miles are discarded (typically zero-length "arrive" maneuvers). Each surviving step becomes a segment dict:

```python
{
    'distance_miles': float,   # Miles for this step
    'duration_hours': float,   # Hours for this step
    'start_coords': {          # Where this step begins
        'lat': float,
        'lng': float,
    },
}
```

**Return value:**

```python
{
    'total_distance_miles': round(total_distance, 1),
    'total_duration_hours': round(total_duration, 2),
    'polyline': geometry,                    # List of [lat, lng] pairs
    'to_pickup_segments': leg_segments[0],   # Segments for leg 1
    'to_dropoff_segments': leg_segments[1],  # Segments for leg 2
}
```

The two segment lists are passed separately to the HOS calculator so it knows where to insert the pickup and dropoff activities between legs.

---

## HOS Calculator

The HOS calculator (`services/hos_calculator.py`) is the core of the application. It simulates a driver traversing the route while enforcing all FMCSA Hours of Service rules for property-carrying vehicles.

### Configuration: `HOSConfig`

```python
@dataclass(frozen=True)
class HOSConfig:
    drive_limit: float = 11.0       # Max driving hours per shift
    window_limit: float = 14.0      # Max on-duty window from shift start
    break_trigger: float = 8.0      # Consecutive driving hours before mandatory break
    cycle_limit: float = 70.0       # Max on-duty hours in 8-day rolling cycle
    fuel_distance: float = 1000.0   # Miles between fuel stops
    rest_duration: float = 10.0     # Hours for mandatory off-duty rest
    restart_duration: float = 34.0  # Hours for full cycle restart
    break_duration: float = 0.5     # Hours for 30-minute break (0.5 hours)
    fuel_duration: float = 0.5      # Hours for fuel stop
```

| Field | FMCSA Rule | Value | Meaning |
|-------|-----------|-------|---------|
| `drive_limit` | 11-hour driving limit | 11.0 | After 11 hours of driving, the driver must take a 10-hour rest |
| `window_limit` | 14-hour duty window | 14.0 | After 14 hours since the shift started (regardless of activity), the driver must take a 10-hour rest |
| `break_trigger` | 30-minute break rule | 8.0 | After 8 consecutive hours of driving, a 30-minute break is required |
| `cycle_limit` | 70-hour/8-day rule | 70.0 | After 70 total on-duty hours over any 8-day period, a 34-hour restart is required |
| `fuel_distance` | Operational | 1000.0 | Commercial trucks refuel approximately every 1,000 miles |
| `rest_duration` | Off-duty rest | 10.0 | Duration of the mandatory off-duty rest period |
| `restart_duration` | Full cycle restart | 34.0 | Duration of the 34-hour restart that resets the 70-hour cycle |
| `break_duration` | Short break | 0.5 | Duration of the 30-minute break |
| `fuel_duration` | Fuel stop | 0.5 | Duration of a fuel stop |

The config is a frozen dataclass -- a singleton instance `HOS = HOSConfig()` is used throughout the module. Values cannot be modified at runtime.

An `EPSILON = 0.001` constant is used for floating-point comparisons to avoid precision issues when checking whether time or distance limits have been reached.

### State Tracking: `DriverState`

```python
@dataclass
class DriverState:
    current_time: datetime                    # Current simulation clock
    drive_time_used: float = 0                # Hours driven this shift (resets after 10-hour rest)
    elapsed_since_shift_start: float = 0      # Hours since shift began (resets after 10-hour rest)
    time_since_last_break: float = 0          # Consecutive driving hours since last 30-min break
    cycle_hours_used: float = 0               # Total on-duty hours in 8-day cycle
    miles_since_last_fuel: float = 0          # Miles driven since last fuel stop
    total_miles_driven: float = 0             # Cumulative miles for the entire trip
    shift_started: bool = False               # Whether the current shift has begun
    timeline: list = field(default_factory=list)  # Ordered list of timeline events
```

| Field | Tracks | Reset Trigger |
|-------|--------|---------------|
| `drive_time_used` | 11-hour driving limit | 10-hour rest or 34-hour restart |
| `elapsed_since_shift_start` | 14-hour duty window | 10-hour rest or 34-hour restart |
| `time_since_last_break` | 8-hour consecutive driving rule | 30-minute break, fuel stop (>= 30 min), or 10-hour rest |
| `cycle_hours_used` | 70-hour/8-day cycle | 34-hour restart only |
| `miles_since_last_fuel` | 1,000-mile fuel interval | Fuel stop |
| `shift_started` | Whether shift clock is running | Set `False` after 10-hour rest or 34-hour restart; set `True` on next activity |

### Entry Point: `calculate_hos()`

```python
def calculate_hos(
    to_pickup_segments: list[dict],
    to_dropoff_segments: list[dict],
    current_cycle_used: float,
    start_time: datetime,
    pickup_coords: dict,
    dropoff_coords: dict,
) -> list[dict]:
    state = DriverState(
        current_time=start_time,
        cycle_hours_used=current_cycle_used,
    )

    for seg in to_pickup_segments:
        _process_driving(state, seg)

    _process_on_duty_activity(state, 1.0, 'Pickup', pickup_coords, 'pickup')

    for seg in to_dropoff_segments:
        _process_driving(state, seg)

    _process_on_duty_activity(state, 1.0, 'Dropoff', dropoff_coords, 'dropoff')

    return state.timeline
```

The execution order is:

1. Initialize `DriverState` with the given `start_time` and `current_cycle_used` (the driver's pre-existing cycle hours).
2. Process all driving segments from current location to pickup.
3. Insert a 1-hour **Pickup** on-duty activity at the pickup coordinates.
4. Process all driving segments from pickup to dropoff.
5. Insert a 1-hour **Dropoff** on-duty activity at the dropoff coordinates.
6. Return the accumulated `timeline` list.

### The Driving Loop: `_process_driving()`

This is the core simulation loop. For each route segment, it determines how far the driver can go before hitting any HOS or operational limit, drives that amount, and handles whatever limit was reached.

```python
def _process_driving(state: DriverState, segment: dict) -> None:
    remaining_miles = segment['distance_miles']
    remaining_hours = segment['duration_hours']

    if remaining_hours < EPSILON:
        return

    avg_speed = remaining_miles / remaining_hours if remaining_hours > 0 else 60.0
    location = segment['start_coords']

    while remaining_hours > EPSILON:
        _ensure_shift_started(state)

        # Calculate time remaining before each limit
        time_to_drive_limit = HOS.drive_limit - state.drive_time_used
        time_to_window = HOS.window_limit - state.elapsed_since_shift_start
        time_to_break = HOS.break_trigger - state.time_since_last_break
        time_to_cycle = HOS.cycle_limit - state.cycle_hours_used
        miles_to_fuel = HOS.fuel_distance - state.miles_since_last_fuel
        time_to_fuel = miles_to_fuel / avg_speed if avg_speed > 0 else float('inf')

        # How much can we drive? The minimum of all limits and remaining time
        max_drivable = min(
            max(time_to_drive_limit, 0),
            max(time_to_window, 0),
            max(time_to_break, 0),
            max(time_to_cycle, 0),
            max(time_to_fuel, 0),
            remaining_hours,
        )

        # If we can't drive at all, handle the limit and retry
        if max_drivable < EPSILON:
            _handle_limit(state, time_to_drive_limit, time_to_window,
                          time_to_break, time_to_cycle, time_to_fuel, location)
            continue

        # Drive the max_drivable amount
        miles_covered = max_drivable * avg_speed
        end_time = state.current_time + timedelta(hours=max_drivable)

        state.timeline.append({
            'status': 'driving',
            'start_time': state.current_time,
            'end_time': end_time,
            'duration_hours': max_drivable,
            'location': location,
            'remark': '',
            'miles': miles_covered,
            'is_stop': False,
            'event_type_label': '',
        })

        # Update all counters
        state.drive_time_used += max_drivable
        state.elapsed_since_shift_start += max_drivable
        state.time_since_last_break += max_drivable
        state.cycle_hours_used += max_drivable
        state.miles_since_last_fuel += miles_covered
        state.total_miles_driven += miles_covered
        state.current_time = end_time

        remaining_hours -= max_drivable
        remaining_miles -= miles_covered
```

**Step-by-step algorithm:**

1. **Skip trivial segments** -- if `remaining_hours < EPSILON` (0.001), the segment is too small to matter.

2. **Compute average speed** for this segment. This is held constant throughout the segment so that `miles = time * avg_speed` remains proportional even when the segment is split across multiple driving chunks. Falls back to 60 mph if duration is zero.

3. **Enter the while loop** -- runs until the entire segment is consumed (`remaining_hours > EPSILON`).

4. **Ensure the shift has started** via `_ensure_shift_started()`. If `shift_started` is `False`, it sets it to `True` and resets `elapsed_since_shift_start` to 0. This marks the beginning of a new duty window.

5. **Calculate headroom for each limit:**
   - `time_to_drive_limit`: How many more hours the driver can drive before hitting the 11-hour limit.
   - `time_to_window`: How many more hours until the 14-hour duty window closes.
   - `time_to_break`: How many more consecutive driving hours before the 8-hour break trigger.
   - `time_to_cycle`: How many more on-duty hours before the 70-hour cycle limit.
   - `time_to_fuel`: How many more hours of driving before the 1,000-mile fuel interval is reached (converted from miles to time using `avg_speed`).

6. **Determine max drivable time** -- the minimum of all five limits (each clamped to >= 0) and the remaining segment time.

7. **If `max_drivable < EPSILON`** -- at least one limit is already exhausted. Call `_handle_limit()` to insert the appropriate rest/break, then `continue` to retry the loop with the now-reset counters.

8. **Otherwise, drive** -- append a `driving` event to the timeline, update all state counters, advance `current_time`, and subtract the driven amount from `remaining_hours` and `remaining_miles`.

9. **Loop back** to step 4 until the segment is fully consumed.

### Limit Handling: `_handle_limit()`

When the driver cannot drive any further, this function determines which limit was hit and applies the correct response:

```python
def _handle_limit(state, time_to_drive, time_to_window, time_to_break,
                  time_to_cycle, time_to_fuel, location):
    if time_to_cycle <= EPSILON:
        _apply_34hr_restart(state, location)
    elif time_to_drive <= EPSILON or time_to_window <= EPSILON:
        _apply_10hr_rest(state, location)
    elif time_to_break <= EPSILON:
        _apply_30min_break(state, location)
    elif time_to_fuel <= EPSILON:
        _apply_fuel_stop(state, location)
```

**Priority order is critical:**

1. **Cycle limit** (70 hours) -- highest priority. Requires a 34-hour restart.
2. **Drive limit** (11 hours) or **Window limit** (14 hours) -- requires a 10-hour rest.
3. **Break trigger** (8 consecutive hours) -- requires a 30-minute break.
4. **Fuel distance** (1,000 miles) -- requires a 30-minute fuel stop.

The cycle limit is checked first because a 34-hour restart is the most disruptive stop. If the cycle limit and the drive limit are both hit simultaneously, the 34-hour restart takes precedence (since it also resets drive time).

### Rest and Break Functions

#### `_apply_34hr_restart()`

Inserts a 34-hour sleeper berth event and resets ALL counters:

```python
def _apply_34hr_restart(state, location):
    end_time = state.current_time + timedelta(hours=HOS.restart_duration)

    state.timeline.append({
        'status': 'sleeper_berth',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': HOS.restart_duration,
        'location': location,
        'remark': '34-hour restart',
        'miles': 0,
        'is_stop': True,
        'event_type_label': 'ten_hr_rest',
    })

    state.drive_time_used = 0
    state.elapsed_since_shift_start = 0
    state.time_since_last_break = 0
    state.cycle_hours_used = 0          # <-- Only 34-hour restart resets cycle
    state.shift_started = False
    state.current_time = end_time
```

Resets: `drive_time_used`, `elapsed_since_shift_start`, `time_since_last_break`, `cycle_hours_used`, `shift_started`.

#### `_apply_10hr_rest()`

Inserts a 10-hour sleeper berth event and resets shift-level counters (but NOT the cycle counter):

```python
def _apply_10hr_rest(state, location):
    end_time = state.current_time + timedelta(hours=HOS.rest_duration)

    state.timeline.append({
        'status': 'sleeper_berth',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': HOS.rest_duration,
        'location': location,
        'remark': '10-hour rest',
        'miles': 0,
        'is_stop': True,
        'event_type_label': 'ten_hr_rest',
    })

    state.drive_time_used = 0
    state.elapsed_since_shift_start = 0
    state.time_since_last_break = 0
    state.shift_started = False
    state.current_time = end_time
```

Resets: `drive_time_used`, `elapsed_since_shift_start`, `time_since_last_break`, `shift_started`.
Does NOT reset: `cycle_hours_used`, `miles_since_last_fuel`.

#### `_apply_30min_break()`

Inserts a 30-minute off-duty break. Resets only the consecutive driving counter:

```python
def _apply_30min_break(state, location):
    end_time = state.current_time + timedelta(hours=HOS.break_duration)

    state.timeline.append({
        'status': 'off_duty',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': HOS.break_duration,
        'location': location,
        'remark': '30-min break',
        'miles': 0,
        'is_stop': True,
        'event_type_label': 'rest_break',
    })

    state.elapsed_since_shift_start += HOS.break_duration
    state.time_since_last_break = 0
    state.current_time = end_time
```

The 30-minute break counts toward the 14-hour duty window (`elapsed_since_shift_start` is incremented) but does NOT count toward driving time or the 70-hour cycle.

#### `_apply_fuel_stop()`

Inserts a 30-minute on-duty fuel stop. Resets the fuel mileage counter:

```python
def _apply_fuel_stop(state, location):
    end_time = state.current_time + timedelta(hours=HOS.fuel_duration)

    state.timeline.append({
        'status': 'on_duty_not_driving',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': HOS.fuel_duration,
        'location': location,
        'remark': 'Fuel stop',
        'miles': 0,
        'is_stop': True,
        'event_type_label': 'fuel',
    })

    state.elapsed_since_shift_start += HOS.fuel_duration
    state.cycle_hours_used += HOS.fuel_duration
    state.miles_since_last_fuel = 0
    state.current_time = end_time

    if HOS.fuel_duration >= HOS.break_duration:
        state.time_since_last_break = 0
```

Fuel stops are `on_duty_not_driving`, so they count toward both the 14-hour window and the 70-hour cycle. Since the default fuel stop duration (0.5 hours) equals the break duration (0.5 hours), the fuel stop also satisfies the 30-minute break requirement, resetting `time_since_last_break`.

### On-Duty Activities: `_process_on_duty_activity()`

Pickup and dropoff are modeled as 1-hour `on_duty_not_driving` events. This function handles them similarly to driving, but only checks the duty window and cycle limits (not the drive limit, break trigger, or fuel distance):

```python
def _process_on_duty_activity(state, duration, remark, location, label):
    remaining = duration

    while remaining > EPSILON:
        _ensure_shift_started(state)

        time_to_window = HOS.window_limit - state.elapsed_since_shift_start
        time_to_cycle = HOS.cycle_limit - state.cycle_hours_used

        doable = min(max(time_to_window, 0), max(time_to_cycle, 0), remaining)

        if doable < EPSILON:
            if time_to_cycle <= EPSILON:
                _apply_34hr_restart(state, location)
            else:
                _apply_10hr_rest(state, location)
            continue

        end_time = state.current_time + timedelta(hours=doable)

        state.timeline.append({
            'status': 'on_duty_not_driving',
            'start_time': state.current_time,
            'end_time': end_time,
            'duration_hours': doable,
            'location': location,
            'remark': remark,
            'miles': 0,
            'is_stop': True,
            'event_type_label': label,
        })

        state.elapsed_since_shift_start += doable
        state.cycle_hours_used += doable
        state.current_time = end_time
        remaining -= doable

        if doable >= HOS.break_duration:
            state.time_since_last_break = 0
```

**Differences from driving:**

- Only the duty window and cycle limits are checked (on-duty activities are not driving, so the 11-hour drive limit and 8-hour break trigger do not apply).
- If the activity duration is >= 0.5 hours (the break duration), it resets the consecutive driving timer -- a 1-hour pickup/dropoff activity satisfies the 30-minute break requirement.
- The activity can be interrupted mid-way if a limit is reached. For example, if only 0.3 hours remain in the duty window when a 1-hour pickup begins, the system inserts 0.3 hours of on-duty activity, then a 10-hour rest, then the remaining 0.7 hours of on-duty activity.

### Shift Start Tracking: `_ensure_shift_started()`

```python
def _ensure_shift_started(state):
    if not state.shift_started:
        state.shift_started = True
        state.elapsed_since_shift_start = 0
```

Called before every driving or on-duty activity. If the shift has not started (either at the trip beginning or after a 10-hour rest / 34-hour restart), it marks the shift as started and resets the duty window clock. This ensures the 14-hour window starts counting from the first activity after a rest, not from the rest's end time.

### Timeline Event Structure

Every event appended to `state.timeline` has this shape:

```python
{
    'status': str,              # 'driving', 'on_duty_not_driving', 'off_duty', 'sleeper_berth'
    'start_time': datetime,     # UTC datetime when this event begins
    'end_time': datetime,       # UTC datetime when this event ends
    'duration_hours': float,    # Duration in hours
    'location': dict,           # {'lat': float, 'lng': float} or {'lat': float, 'lng': float, 'name': str}
    'remark': str,              # '' for driving, or descriptive text ('30-min break', '10-hour rest', etc.)
    'miles': float,             # Miles driven (0 for non-driving events)
    'is_stop': bool,            # True for stops the driver must make (breaks, rests, pickup, dropoff, fuel)
    'event_type_label': str,    # 'pickup', 'dropoff', 'rest_break', 'ten_hr_rest', 'fuel', or ''
}
```

### State Reset Summary

| Reset Event | `drive_time_used` | `elapsed_since_shift_start` | `time_since_last_break` | `cycle_hours_used` | `miles_since_last_fuel` | `shift_started` |
|-------------|------|---------|-------|-------|------|------|
| 10-hour rest | 0 | 0 | 0 | unchanged | unchanged | False |
| 34-hour restart | 0 | 0 | 0 | 0 | unchanged | False |
| 30-min break | unchanged | += 0.5 | 0 | unchanged | unchanged | unchanged |
| Fuel stop | unchanged | += 0.5 | 0 (if duration >= 0.5) | += 0.5 | 0 | unchanged |
| On-duty activity | unchanged | += duration | 0 (if duration >= 0.5) | += duration | unchanged | unchanged |

---

## Stop Generation

Stops are extracted from the timeline in `plan_trip()` after the HOS simulation completes:

```python
stops = [
    {
        'type': e['event_type_label'],
        'location': e['location'],
        'arrival_time': e['start_time'].isoformat(),
        'departure_time': e['end_time'].isoformat(),
        'duration_hours': round(e['duration_hours'], 2),
    }
    for e in timeline
    if e.get('is_stop')
]
```

A timeline event is a stop when `is_stop` is `True`. The following event types produce stops:

| Event Type Label | `is_stop` | Status | Duration | Trigger |
|-----------------|-----------|--------|----------|---------|
| `pickup` | True | `on_duty_not_driving` | 1.0 hour | Between leg 1 and leg 2 |
| `dropoff` | True | `on_duty_not_driving` | 1.0 hour | After leg 2 |
| `rest_break` | True | `off_duty` | 0.5 hours | 8 consecutive driving hours reached |
| `ten_hr_rest` | True | `sleeper_berth` | 10.0 or 34.0 hours | Drive/window limit or cycle limit reached |
| `fuel` | True | `on_duty_not_driving` | 0.5 hours | 1,000 miles since last fuel |

Driving events have `is_stop = False` and are excluded from the stops list.

After extraction, location names are shortened using `_short_name()`:

```python
for stop in stops:
    stop['location'] = {**stop['location'], 'name': _short_name(stop['location'].get('name', ''))}
```

Each stop's `arrival_time` and `departure_time` are ISO 8601 formatted datetime strings. The `location` includes `lat`, `lng`, and `name` fields. The `type` field maps directly from `event_type_label`.

---

## Daily Log Generation

The `generate_daily_logs()` function in `services/log_generator.py` transforms the flat timeline into per-day ELD log sheets. Each log covers one calendar day (midnight UTC to midnight UTC) and contains the segments, totals, and cycle recap that an ELD device would display.

### Input

- `timeline` -- the ordered list of events from `calculate_hos()`.
- `initial_cycle_used` -- the driver's cycle hours at the start of the trip (used for the cumulative recap).
- `waypoint_names` -- a dict with `start`, `pickup`, and `dropoff` keys mapping to short location names.

### Algorithm

#### Step 1: Determine Date Range

```python
first_start = timeline[0]['start_time']
last_end = timeline[-1]['end_time']
current_date = first_start.date()
last_date = last_end.date()
total_days = (last_date - current_date).days + 1
```

The generator iterates from the first event's date through the last event's date, inclusive. A trip starting on January 15 and ending on January 18 produces 4 daily logs.

#### Step 2: Extract Day Segments

For each calendar day, the generator scans the entire timeline and clips overlapping events to the day's boundaries:

```python
day_start = datetime.combine(current_date, time(0, 0), tzinfo=timezone.utc)
day_end = day_start + timedelta(days=1)

for event in timeline:
    if event['end_time'] <= day_start or event['start_time'] >= day_end:
        continue

    seg_start = max(event['start_time'], day_start)
    seg_end = min(event['end_time'], day_end)
    seg_duration = (seg_end - seg_start).total_seconds() / 3600

    if seg_duration < 0.001:
        continue

    start_hour = (seg_start - day_start).total_seconds() / 3600
    end_hour = (seg_end - day_start).total_seconds() / 3600

    segments.append({
        'status': event['status'],
        'start_time': round(start_hour, 4),
        'end_time': round(end_hour, 4),
        'remark': event.get('remark', ''),
    })
```

**Clipping logic:** If a 10-hour rest event runs from 20:00 on January 15 to 06:00 on January 16, it produces two segments:
- Day 1 (Jan 15): `sleeper_berth` from hour 20 to hour 24.
- Day 2 (Jan 16): `sleeper_berth` from hour 0 to hour 6.

Segment times are expressed as decimal hours from midnight (0-24), not absolute datetimes. This makes them directly usable for the SVG grid rendering on the frontend.

**Mileage proportioning:** When a driving event spans two days, its miles are proportioned by time:

```python
if event['status'] == 'driving' and event['miles'] > 0:
    event_duration = (event['end_time'] - event['start_time']).total_seconds() / 3600
    if event_duration > 0:
        proportion = seg_duration / event_duration
        day_miles += event['miles'] * proportion
```

If a 4-hour, 240-mile driving event is clipped to 1 hour for a given day, that day gets `240 * (1/4) = 60` miles.

#### Step 3: Merge Consecutive Segments

```python
def _merge_consecutive(segments):
    merged = [segments[0].copy()]
    for seg in segments[1:]:
        prev = merged[-1]
        if (prev['status'] == seg['status']
                and abs(prev['end_time'] - seg['start_time']) < 0.01
                and not seg.get('remark')):
            prev['end_time'] = seg['end_time']
        else:
            merged.append(seg.copy())
    return merged
```

Two adjacent segments are merged if they have the same status, are time-contiguous (within 0.01 hours = 36 seconds), and the second segment has no remark. Segments with remarks (e.g., "30-min break") are kept separate so their remark text is preserved.

#### Step 4: Fill Gaps with Off-Duty

```python
def _fill_gaps(segments):
    filled = []
    segments.sort(key=lambda s: s['start_time'])

    if segments[0]['start_time'] > 0.01:
        filled.append({'status': 'off_duty', 'start_time': 0,
                        'end_time': segments[0]['start_time'], 'remark': ''})

    for i, seg in enumerate(segments):
        if i > 0:
            prev_end = segments[i - 1]['end_time']
            if seg['start_time'] - prev_end > 0.01:
                filled.append({'status': 'off_duty', 'start_time': prev_end,
                                'end_time': seg['start_time'], 'remark': ''})
        filled.append(seg)

    last_end = segments[-1]['end_time']
    if 24 - last_end > 0.01:
        filled.append({'status': 'off_duty', 'start_time': last_end,
                        'end_time': 24, 'remark': ''})

    return filled
```

This ensures every day has a complete, gapless 0-24 hour timeline:

1. If the first segment does not start at hour 0, an `off_duty` segment fills 0 to the first segment's start.
2. Any gaps between consecutive segments are filled with `off_duty`.
3. If the last segment does not end at hour 24, an `off_duty` segment fills the gap to 24.

If a day has no events at all, it returns a single `off_duty` segment from 0 to 24.

#### Step 5: Compute Totals

```python
def _compute_totals(segments):
    totals = {
        'off_duty': 0,
        'sleeper_berth': 0,
        'driving': 0,
        'on_duty_not_driving': 0,
    }
    for seg in segments:
        duration = seg['end_time'] - seg['start_time']
        totals[seg['status']] = totals.get(seg['status'], 0) + duration
    return totals
```

Sums the duration of all segments by status. The four statuses always sum to exactly 24.0 hours for any given day (thanks to gap filling).

#### Step 6: Compute Cycle Recap

```python
day_on_duty = totals.get('driving', 0) + totals.get('on_duty_not_driving', 0)
cumulative_on_duty += day_on_duty
```

The cycle recap tracks cumulative on-duty hours (driving + on_duty_not_driving) across all days. It starts from `initial_cycle_used` (the driver's pre-existing cycle hours) and adds each day's on-duty total. The recap shows:

- `cycle_hours_used`: Total on-duty hours in the 8-day cycle so far.
- `cycle_hours_available`: `70 - cycle_hours_used`, clamped to >= 0.

Note: This is a simplified calculation. The actual FMCSA rule uses a rolling 8-day window, but since this application plans forward from a known starting point, a running total is sufficient.

#### Step 7: Determine From/To Locations

```python
def _get_day_locations(timeline, day_start, day_end, waypoint_names, day_index, total_days):
    named_locs = []
    for event in timeline:
        if event['end_time'] <= day_start or event['start_time'] >= day_end:
            continue
        remark = event.get('remark', '')
        if 'Pickup' in remark:
            named_locs.append(waypoint_names.get('pickup', 'Pickup'))
        elif 'Dropoff' in remark:
            named_locs.append(waypoint_names.get('dropoff', 'Dropoff'))

    if day_index == 0:
        from_loc = waypoint_names.get('start', 'Start')
    elif named_locs:
        from_loc = named_locs[0]
    else:
        from_loc = 'En route'

    if day_index == total_days - 1:
        to_loc = waypoint_names.get('dropoff', 'Destination')
    elif named_locs:
        to_loc = named_locs[-1]
    else:
        to_loc = 'En route'

    return from_loc, to_loc
```

Location labeling rules:

- **First day**: `from_location` is always the start waypoint name.
- **Last day**: `to_location` is always the dropoff waypoint name.
- **Middle days**: If a pickup or dropoff event overlaps the day, the first named location is used as `from_location` and the last as `to_location`. If neither pickup nor dropoff occurs, both are set to "En route".

#### Step 8: Assemble the Daily Log

```python
logs.append({
    'date': current_date.isoformat(),        # "2026-01-15"
    'day_number': len(logs) + 1,             # Sequential starting at 1
    'from_location': from_loc,
    'to_location': to_loc,
    'total_miles': round(day_miles),          # Integer, rounded
    'segments': segments,                     # Gapless 0-24 hour segments
    'totals': {k: round(v, 2) for k, v in totals.items()},
    'recap': {
        'cycle_hours_used': round(cumulative_on_duty, 2),
        'cycle_hours_available': round(max(70 - cumulative_on_duty, 0), 2),
    },
    'remarks': remarks,                      # List of remark strings with locations
})
```

**Remarks** are collected from events that have non-empty `remark` fields. Each remark is formatted as `"{remark} - {location_name}"` (e.g., "30-min break - Reno, Nevada"). Duplicate remarks within a day are suppressed. Location names are shortened using `_get_location_name()`, which applies the same city-state extraction logic as `_short_name()` in the orchestrator.

---

## Duty Status Segments

The segment data in each daily log directly maps to the four rows of the FMCSA ELD grid:

| Status | Grid Row | Description |
|--------|----------|-------------|
| `off_duty` | Row 1 | Not working, not in the sleeper berth |
| `sleeper_berth` | Row 2 | Resting in the sleeper berth compartment (10-hour rest, 34-hour restart) |
| `driving` | Row 3 | Actively operating the commercial motor vehicle |
| `on_duty_not_driving` | Row 4 | On-duty but not driving (pickup, dropoff, fuel, inspections) |

### Segment Structure

Each segment in the `segments` array represents a continuous period of a single duty status:

```python
{
    'status': 'driving',     # One of the four duty statuses
    'start_time': 8.0,       # Decimal hours from midnight (0-24)
    'end_time': 16.0,        # Decimal hours from midnight (0-24)
    'remark': '',            # Optional annotation
}
```

The `start_time` and `end_time` values are decimal hours, where:
- `0` = midnight (start of day)
- `8.5` = 8:30 AM
- `12.0` = noon
- `16.25` = 4:15 PM
- `24` = midnight (end of day)

### How Status Is Determined

The duty status for each segment comes directly from the HOS calculator's timeline events:

| HOS Event | Duty Status | Remark |
|-----------|-------------|--------|
| Driving a route segment | `driving` | (empty) |
| 30-minute break | `off_duty` | "30-min break" |
| 10-hour rest | `sleeper_berth` | "10-hour rest" |
| 34-hour restart | `sleeper_berth` | "34-hour restart" |
| Pickup activity | `on_duty_not_driving` | "Pickup" |
| Dropoff activity | `on_duty_not_driving` | "Dropoff" |
| Fuel stop | `on_duty_not_driving` | "Fuel stop" |
| Gap fill (no activity) | `off_duty` | (empty) |

### Day Boundary Behavior

Multi-day events are split at midnight boundaries. A single 10-hour rest period from 20:00 to 06:00 produces:

**Day 1 segments:**
```
..., { status: "sleeper_berth", start_time: 20, end_time: 24, remark: "10-hour rest" }
```

**Day 2 segments:**
```
{ status: "sleeper_berth", start_time: 0, end_time: 6, remark: "10-hour rest" }, ...
```

The totals for each day reflect only the portion of the event that falls within that day. Day 1 gets 4 hours of `sleeper_berth` from this event; Day 2 gets 6 hours.

### Completeness Guarantee

After gap filling, every daily log's segments form a contiguous, complete 24-hour timeline with no overlaps and no gaps. The sum of all segment durations for any day is exactly 24 hours. The sum of all status totals (`off_duty + sleeper_berth + driving + on_duty_not_driving`) is also exactly 24 hours. This invariant is critical for the frontend SVG grid rendering, which draws horizontal lines across the full 24-hour width.
