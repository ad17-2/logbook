import requests

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'


def geocode(address):
    response = requests.get(
        NOMINATIM_URL,
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
    results = response.json()

    if not results:
        raise ValueError(f"Could not geocode address: {address}")

    result = results[0]
    return {
        'lat': float(result['lat']),
        'lng': float(result['lon']),
        'name': result.get('display_name', address),
    }
