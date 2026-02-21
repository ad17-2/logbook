from __future__ import annotations

import logging

import requests
import polyline as polyline_lib
from django.conf import settings

from trips.api.exceptions import RoutingError

logger = logging.getLogger(__name__)

METERS_TO_MILES = 0.000621371


def get_route(current: dict, pickup: dict, dropoff: dict) -> dict:
    waypoints = [current, pickup, dropoff]
    coords_str = ';'.join(f"{w['lng']},{w['lat']}" for w in waypoints)
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{coords_str}"

    logger.info("Requesting route for %d waypoints", len(waypoints))

    try:
        response = requests.get(
            url,
            params={
                'overview': 'full',
                'geometries': 'polyline',
                'steps': 'true',
            },
            timeout=30,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("OSRM request failed: %s", exc)
        raise RoutingError('Routing service unavailable.') from exc

    data = response.json()

    if data.get('code') != 'Ok':
        msg = data.get('message', 'Unknown error')
        logger.error("OSRM routing failed: %s", msg)
        raise RoutingError(f'OSRM routing failed: {msg}')

    route = data['routes'][0]
    geometry = polyline_lib.decode(route['geometry'])

    leg_segments: list[list[dict]] = [[], []]
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
