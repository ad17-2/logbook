from datetime import datetime, timezone

from .geocoding import geocode
from .routing import get_route
from .hos_calculator import calculate_hos
from .log_generator import generate_daily_logs


def _short_name(display_name):
    if not display_name:
        return ''
    parts = [p.strip() for p in display_name.split(',')]
    if len(parts) >= 3:
        return f"{parts[0]}, {parts[2]}"
    return parts[0]


def plan_trip(data):
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
