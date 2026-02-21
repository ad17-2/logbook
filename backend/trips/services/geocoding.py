from __future__ import annotations

import logging

import requests
from django.conf import settings

from trips.api.exceptions import GeocodingError, LocationNotFound

logger = logging.getLogger(__name__)


def geocode(address: str) -> dict:
    url = f"{settings.NOMINATIM_BASE_URL}/search"
    logger.info("Geocoding address=%r", address)

    try:
        response = requests.get(
            url,
            params={
                'q': address,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'us',
            },
            headers={'User-Agent': 'ELDTripPlanner/1.0'},
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Geocoding request failed for %r: %s", address, exc)
        raise GeocodingError(f'Geocoding service failed for: {address}') from exc

    results = response.json()

    if not results:
        logger.warning("No geocoding results for %r", address)
        raise LocationNotFound(f'Could not geocode address: {address}')

    result = results[0]
    return {
        'lat': float(result['lat']),
        'lng': float(result['lon']),
        'name': result.get('display_name', address),
    }
