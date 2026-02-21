from unittest.mock import patch

import pytest
from django.test import override_settings
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


MOCK_GEOCODE_RESULT = {
    'lat': 32.7767,
    'lng': -96.7970,
    'name': 'Dallas, Dallas County, Texas',
}

MOCK_ROUTE = {
    'total_distance_miles': 200.0,
    'total_duration_hours': 3.5,
    'polyline': [[32.0, -96.0], [30.0, -97.0]],
    'to_pickup_segments': [{
        'distance_miles': 100,
        'duration_hours': 1.5,
        'start_coords': {'lat': 32.0, 'lng': -96.0},
    }],
    'to_dropoff_segments': [{
        'distance_miles': 100,
        'duration_hours': 2.0,
        'start_coords': {'lat': 30.0, 'lng': -97.0},
    }],
}

MOCK_SEARCH_RESULTS = [
    {'name': 'San Antonio, TX', 'lat': 29.42, 'lng': -98.49},
    {'name': 'San Francisco, CA', 'lat': 37.77, 'lng': -122.41},
]


@pytest.mark.django_db
class TestTripPlanView:
    @patch('trips.services.trip_planner.get_route', return_value=MOCK_ROUTE)
    @patch('trips.services.trip_planner.geocode', return_value=MOCK_GEOCODE_RESULT)
    def test_success(self, mock_geocode, mock_route, api_client):
        resp = api_client.post('/api/trip/plan/', {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': 10,
        }, format='json')

        assert resp.status_code == 200
        data = resp.json()
        assert 'route' in data
        assert 'stops' in data
        assert 'daily_logs' in data
        assert 'total_distance_miles' in data['route']
        assert 'polyline' in data['route']

    def test_missing_fields_returns_error(self, api_client):
        resp = api_client.post('/api/trip/plan/', {}, format='json')
        assert resp.status_code == 400
        data = resp.json()
        assert 'errors' in data
        assert 'status_code' in data

    def test_same_pickup_dropoff_returns_error(self, api_client):
        resp = api_client.post('/api/trip/plan/', {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Austin, TX',
            'current_cycle_used': 10,
        }, format='json')
        assert resp.status_code == 400

    @patch('trips.services.trip_planner.geocode')
    def test_geocoding_failure_returns_error(self, mock_geocode, api_client):
        from trips.api.exceptions import LocationNotFound
        mock_geocode.side_effect = LocationNotFound('Could not geocode address: Nowhere')

        resp = api_client.post('/api/trip/plan/', {
            'current_location': 'Nowhere',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': 10,
        }, format='json')

        assert resp.status_code == 400
        data = resp.json()
        assert 'errors' in data


@pytest.mark.django_db
class TestLocationSearchView:
    @patch('trips.services.location_search.requests.get')
    def test_success(self, mock_get, api_client):
        mock_get.return_value.status_code = 200
        mock_get.return_value.raise_for_status = lambda: None
        mock_get.return_value.json.return_value = [
            {'display_name': 'San Antonio, TX', 'lat': '29.42', 'lon': '-98.49'},
            {'display_name': 'San Francisco, CA', 'lat': '37.77', 'lon': '-122.41'},
        ]

        resp = api_client.get('/api/locations/search/', {'q': 'San'})

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]['name'] == 'San Antonio, TX'
        assert 'lat' in data[0]
        assert 'lng' in data[0]

    def test_short_query_returns_empty(self, api_client):
        resp = api_client.get('/api/locations/search/', {'q': 'S'})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_empty_query_returns_empty(self, api_client):
        resp = api_client.get('/api/locations/search/')
        assert resp.status_code == 200
        assert resp.json() == []

    @patch('trips.services.location_search.requests.get')
    def test_service_failure_returns_502(self, mock_get, api_client):
        import requests as req_lib
        mock_get.side_effect = req_lib.ConnectionError('Service down')

        resp = api_client.get('/api/locations/search/', {'q': 'Dallas'})
        assert resp.status_code == 502
