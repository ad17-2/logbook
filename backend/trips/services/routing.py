import requests
import polyline as polyline_lib

OSRM_URL = 'http://router.project-osrm.org/route/v1/driving'
METERS_TO_MILES = 0.000621371


def get_route(current, pickup, dropoff):
    waypoints = [current, pickup, dropoff]
    coords_str = ';'.join(f"{w['lng']},{w['lat']}" for w in waypoints)

    response = requests.get(
        f"{OSRM_URL}/{coords_str}",
        params={
            'overview': 'full',
            'geometries': 'polyline',
            'steps': 'true',
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    if data.get('code') != 'Ok':
        raise ValueError(f"OSRM routing failed: {data.get('message', 'Unknown error')}")

    route = data['routes'][0]
    geometry = polyline_lib.decode(route['geometry'])

    leg_segments = [[], []]
    for leg_idx, leg in enumerate(route['legs']):
        for step in leg['steps']:
            distance_miles = step['distance'] * METERS_TO_MILES
            duration_hours = step['duration'] / 3600
            if distance_miles < 0.01:
                continue

            start_loc = step['maneuver']['location']
            leg_segments[leg_idx].append({
                'distance_miles': distance_miles,
                'duration_hours': duration_hours,
                'start_coords': {'lat': start_loc[1], 'lng': start_loc[0]},
            })

    all_segments = leg_segments[0] + leg_segments[1]
    total_distance = sum(s['distance_miles'] for s in all_segments)
    total_duration = sum(s['duration_hours'] for s in all_segments)

    return {
        'total_distance_miles': round(total_distance, 1),
        'total_duration_hours': round(total_duration, 2),
        'polyline': geometry,
        'to_pickup_segments': leg_segments[0],
        'to_dropoff_segments': leg_segments[1],
    }
