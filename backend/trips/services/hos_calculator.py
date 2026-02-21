from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta


@dataclass(frozen=True)
class HOSConfig:
    drive_limit: float = 11.0
    window_limit: float = 14.0
    break_trigger: float = 8.0
    cycle_limit: float = 70.0
    fuel_distance: float = 1000.0
    rest_duration: float = 10.0
    restart_duration: float = 34.0
    break_duration: float = 0.5
    fuel_duration: float = 0.5


HOS = HOSConfig()
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


def _process_driving(state: DriverState, segment: dict) -> None:
    remaining_miles = segment['distance_miles']
    remaining_hours = segment['duration_hours']

    if remaining_hours < EPSILON:
        return

    avg_speed = remaining_miles / remaining_hours if remaining_hours > 0 else 60.0
    location = segment['start_coords']

    while remaining_hours > EPSILON:
        _ensure_shift_started(state)

        time_to_drive_limit = HOS.drive_limit - state.drive_time_used
        time_to_window = HOS.window_limit - state.elapsed_since_shift_start
        time_to_break = HOS.break_trigger - state.time_since_last_break
        time_to_cycle = HOS.cycle_limit - state.cycle_hours_used
        miles_to_fuel = HOS.fuel_distance - state.miles_since_last_fuel
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


def _handle_limit(
    state: DriverState,
    time_to_drive: float,
    time_to_window: float,
    time_to_break: float,
    time_to_cycle: float,
    time_to_fuel: float,
    location: dict,
) -> None:
    if time_to_cycle <= EPSILON:
        _apply_34hr_restart(state, location)
    elif time_to_drive <= EPSILON or time_to_window <= EPSILON:
        _apply_10hr_rest(state, location)
    elif time_to_break <= EPSILON:
        _apply_30min_break(state, location)
    elif time_to_fuel <= EPSILON:
        _apply_fuel_stop(state, location)


def _process_on_duty_activity(
    state: DriverState,
    duration: float,
    remark: str,
    location: dict,
    label: str,
) -> None:
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


def _ensure_shift_started(state: DriverState) -> None:
    if not state.shift_started:
        state.shift_started = True
        state.elapsed_since_shift_start = 0


def _apply_30min_break(state: DriverState, location: dict) -> None:
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


def _apply_fuel_stop(state: DriverState, location: dict) -> None:
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


def _apply_10hr_rest(state: DriverState, location: dict) -> None:
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


def _apply_34hr_restart(state: DriverState, location: dict) -> None:
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
    state.cycle_hours_used = 0
    state.shift_started = False
    state.current_time = end_time
