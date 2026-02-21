import pytest
from datetime import datetime, timezone

from trips.services.hos_calculator import calculate_hos, HOS, HOSConfig


def _make_segments(distance_miles: float, duration_hours: float) -> list[dict]:
    return [{
        'distance_miles': distance_miles,
        'duration_hours': duration_hours,
        'start_coords': {'lat': 32.0, 'lng': -96.0},
    }]


COORDS = {'lat': 32.0, 'lng': -96.0}
START = datetime(2026, 1, 15, 8, 0, tzinfo=timezone.utc)


class TestHOSCalculator:
    def test_short_trip_no_breaks(self):
        to_pickup = _make_segments(100, 2.0)
        to_dropoff = _make_segments(100, 2.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=0,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        stops = [e for e in timeline if e['is_stop']]
        stop_types = [s['event_type_label'] for s in stops]
        assert 'pickup' in stop_types
        assert 'dropoff' in stop_types
        assert 'rest_break' not in stop_types
        assert 'ten_hr_rest' not in stop_types

    def test_break_triggered_after_8_hours(self):
        to_pickup = _make_segments(500, 9.0)
        to_dropoff = _make_segments(50, 1.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=0,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        stop_types = [e['event_type_label'] for e in timeline if e['is_stop']]
        assert 'rest_break' in stop_types

    def test_10hr_rest_after_drive_limit(self):
        to_pickup = _make_segments(700, 12.0)
        to_dropoff = _make_segments(50, 1.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=0,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        stop_types = [e['event_type_label'] for e in timeline if e['is_stop']]
        assert 'ten_hr_rest' in stop_types

    def test_cycle_limit_triggers_restart(self):
        to_pickup = _make_segments(300, 5.0)
        to_dropoff = _make_segments(300, 5.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=62,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        remarks = [e['remark'] for e in timeline if e['is_stop']]
        assert any('34-hour' in r for r in remarks)

    def test_fuel_stop_triggered(self):
        to_pickup = _make_segments(1100, 18.0)
        to_dropoff = _make_segments(50, 1.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=0,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        stop_types = [e['event_type_label'] for e in timeline if e['is_stop']]
        assert 'fuel' in stop_types

    def test_pickup_and_dropoff_always_present(self):
        to_pickup = _make_segments(50, 1.0)
        to_dropoff = _make_segments(50, 1.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=0,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        stop_types = [e['event_type_label'] for e in timeline if e['is_stop']]
        assert stop_types.count('pickup') == 1
        assert stop_types.count('dropoff') == 1

    def test_timeline_chronological(self):
        to_pickup = _make_segments(500, 9.0)
        to_dropoff = _make_segments(500, 9.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=0,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        for i in range(1, len(timeline)):
            assert timeline[i]['start_time'] >= timeline[i - 1]['end_time']

    def test_zero_distance_segment_skipped(self):
        to_pickup = _make_segments(0, 0)
        to_dropoff = _make_segments(50, 1.0)

        timeline = calculate_hos(
            to_pickup_segments=to_pickup,
            to_dropoff_segments=to_dropoff,
            current_cycle_used=0,
            start_time=START,
            pickup_coords=COORDS,
            dropoff_coords=COORDS,
        )

        driving_events = [e for e in timeline if e['status'] == 'driving']
        assert all(e['duration_hours'] > 0 for e in driving_events)


class TestHOSConfig:
    def test_default_values(self):
        assert HOS.drive_limit == 11.0
        assert HOS.window_limit == 14.0
        assert HOS.break_trigger == 8.0
        assert HOS.cycle_limit == 70.0
        assert HOS.fuel_distance == 1000.0

    def test_frozen(self):
        with pytest.raises(AttributeError):
            HOS.drive_limit = 12.0
