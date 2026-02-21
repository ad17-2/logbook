import pytest
from trips.api.serializers import TripPlanRequestSerializer


class TestTripPlanRequestSerializer:
    def test_valid_data(self):
        data = {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': 10.0,
        }
        s = TripPlanRequestSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_current_location_too_short(self):
        data = {
            'current_location': 'A',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': 10.0,
        }
        s = TripPlanRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'current_location' in s.errors

    def test_cycle_used_negative(self):
        data = {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': -1,
        }
        s = TripPlanRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'current_cycle_used' in s.errors

    def test_cycle_used_exceeds_max(self):
        data = {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': 71,
        }
        s = TripPlanRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'current_cycle_used' in s.errors

    def test_same_pickup_and_dropoff(self):
        data = {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Austin, TX',
            'current_cycle_used': 10.0,
        }
        s = TripPlanRequestSerializer(data=data)
        assert not s.is_valid()
        assert 'dropoff_location' in s.errors

    def test_start_time_optional(self):
        data = {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': 0,
        }
        s = TripPlanRequestSerializer(data=data)
        assert s.is_valid(), s.errors
        assert 'start_time' not in s.validated_data

    def test_start_time_provided(self):
        data = {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Austin, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_used': 0,
            'start_time': '2026-01-15T08:00:00Z',
        }
        s = TripPlanRequestSerializer(data=data)
        assert s.is_valid(), s.errors
        assert s.validated_data['start_time'] is not None

    def test_missing_required_fields(self):
        s = TripPlanRequestSerializer(data={})
        assert not s.is_valid()
        assert 'current_location' in s.errors
        assert 'pickup_location' in s.errors
        assert 'dropoff_location' in s.errors
        assert 'current_cycle_used' in s.errors
