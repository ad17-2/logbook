from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional


DRIVE_LIMIT = 11.0
WINDOW_LIMIT = 14.0
BREAK_TRIGGER = 8.0
CYCLE_LIMIT = 70.0
FUEL_DISTANCE = 1000.0
REST_DURATION = 10.0
RESTART_DURATION = 34.0
BREAK_DURATION = 0.5
FUEL_DURATION = 0.5

EPSILON = 0.001


@dataclass
class DriverState:
    current_time: datetime
    drive_time_used: float = 0
    elapsed_since_shift_start: float = 0
    time_since_last_break: float = 0
    cycle_hours_used: float = 0
    miles_since_last_fuel: float = 0
    total_miles_driven: float = 0
    shift_started: bool = False
    timeline: list = field(default_factory=list)


def calculate_hos(to_pickup_segments, to_dropoff_segments,
                  current_cycle_used, start_time,
                  pickup_coords, dropoff_coords):
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


def _process_driving(state, segment):
    remaining_miles = segment['distance_miles']
    remaining_hours = segment['duration_hours']

    if remaining_hours < EPSILON:
        return

    avg_speed = remaining_miles / remaining_hours if remaining_hours > 0 else 60.0
    location = segment['start_coords']

    while remaining_hours > EPSILON:
        _ensure_shift_started(state)

        time_to_drive_limit = DRIVE_LIMIT - state.drive_time_used
        time_to_window = WINDOW_LIMIT - state.elapsed_since_shift_start
        time_to_break = BREAK_TRIGGER - state.time_since_last_break
        time_to_cycle = CYCLE_LIMIT - state.cycle_hours_used
        miles_to_fuel = FUEL_DISTANCE - state.miles_since_last_fuel
        time_to_fuel = miles_to_fuel / avg_speed if avg_speed > 0 else float('inf')

        max_drivable = min(
            max(time_to_drive_limit, 0),
            max(time_to_window, 0),
            max(time_to_break, 0),
            max(time_to_cycle, 0),
            max(time_to_fuel, 0),
            remaining_hours,
        )

        if max_drivable < EPSILON:
            _handle_limit(state, time_to_drive_limit, time_to_window,
                          time_to_break, time_to_cycle, time_to_fuel, location)
            continue

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

        state.drive_time_used += max_drivable
        state.elapsed_since_shift_start += max_drivable
        state.time_since_last_break += max_drivable
        state.cycle_hours_used += max_drivable
        state.miles_since_last_fuel += miles_covered
        state.total_miles_driven += miles_covered
        state.current_time = end_time

        remaining_hours -= max_drivable
        remaining_miles -= miles_covered


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


def _process_on_duty_activity(state, duration, remark, location, label):
    remaining = duration

    while remaining > EPSILON:
        _ensure_shift_started(state)

        time_to_window = WINDOW_LIMIT - state.elapsed_since_shift_start
        time_to_cycle = CYCLE_LIMIT - state.cycle_hours_used

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

        if doable >= BREAK_DURATION:
            state.time_since_last_break = 0


def _ensure_shift_started(state):
    if not state.shift_started:
        state.shift_started = True
        state.elapsed_since_shift_start = 0


def _apply_30min_break(state, location):
    end_time = state.current_time + timedelta(hours=BREAK_DURATION)

    state.timeline.append({
        'status': 'off_duty',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': BREAK_DURATION,
        'location': location,
        'remark': '30-min break',
        'miles': 0,
        'is_stop': True,
        'event_type_label': 'rest_break',
    })

    state.elapsed_since_shift_start += BREAK_DURATION
    state.time_since_last_break = 0
    state.current_time = end_time


def _apply_fuel_stop(state, location):
    end_time = state.current_time + timedelta(hours=FUEL_DURATION)

    state.timeline.append({
        'status': 'on_duty_not_driving',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': FUEL_DURATION,
        'location': location,
        'remark': 'Fuel stop',
        'miles': 0,
        'is_stop': True,
        'event_type_label': 'fuel',
    })

    state.elapsed_since_shift_start += FUEL_DURATION
    state.cycle_hours_used += FUEL_DURATION
    state.miles_since_last_fuel = 0
    state.current_time = end_time

    if FUEL_DURATION >= BREAK_DURATION:
        state.time_since_last_break = 0


def _apply_10hr_rest(state, location):
    end_time = state.current_time + timedelta(hours=REST_DURATION)

    state.timeline.append({
        'status': 'sleeper_berth',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': REST_DURATION,
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


def _apply_34hr_restart(state, location):
    end_time = state.current_time + timedelta(hours=RESTART_DURATION)

    state.timeline.append({
        'status': 'sleeper_berth',
        'start_time': state.current_time,
        'end_time': end_time,
        'duration_hours': RESTART_DURATION,
        'location': location,
        'remark': '34-hour restart',
        'miles': 0,
        'is_stop': True,
        'event_type_label': 'ten_hr_rest',
    })

    state.drive_time_used = 0
    state.elapsed_since_shift_start = 0
    state.time_since_last_break = 0
    state.cycle_hours_used = 0
    state.shift_started = False
    state.current_time = end_time
