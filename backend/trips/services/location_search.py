from __future__ import annotations

import logging

import requests
from django.conf import settings

from trips.api.exceptions import GeocodingError

logger = logging.getLogger(__name__)


def search_locations(query: str, limit: int = 5) -> list[dict]:
    url = f"{settings.NOMINATIM_BASE_URL}/search"
    logger.info("Searching locations for query=%r limit=%d", query, limit)

    try:
        resp = requests.get(
            url,
            params={
                'q': query,
                'format': 'json',
                'countrycodes': 'us',
                'limit': limit,
            },
            headers={'User-Agent': 'ELDTripPlanner/1.0'},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Location search failed: %s", exc)
        raise GeocodingError('Location search service unavailable.') from exc

    return [
        {
            'name': r.get('display_name', ''),
            'lat': float(r['lat']),
            'lng': float(r['lon']),
        }
        for r in resp.json()
    ]
