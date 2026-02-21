from rest_framework import serializers


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(min_length=2, max_length=500)
    pickup_location = serializers.CharField(min_length=2, max_length=500)
    dropoff_location = serializers.CharField(min_length=2, max_length=500)
    current_cycle_used = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.DateTimeField(required=False)

    def validate(self, data):
        if data['pickup_location'].strip().lower() == data['dropoff_location'].strip().lower():
            raise serializers.ValidationError(
                {'dropoff_location': 'Dropoff location must be different from pickup location.'}
            )
        return data


class LocationSearchResultSerializer(serializers.Serializer):
    name = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class RouteSerializer(serializers.Serializer):
    total_distance_miles = serializers.FloatField()
    total_duration_hours = serializers.FloatField()
    polyline = serializers.ListField(child=serializers.ListField(child=serializers.FloatField()))


class LocationSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    name = serializers.CharField(required=False, default='')


class StopSerializer(serializers.Serializer):
    type = serializers.CharField()
    location = LocationSerializer()
    arrival_time = serializers.CharField()
    departure_time = serializers.CharField()
    duration_hours = serializers.FloatField()


class SegmentSerializer(serializers.Serializer):
    status = serializers.CharField()
    start_time = serializers.FloatField()
    end_time = serializers.FloatField()
    remark = serializers.CharField(allow_blank=True)


class RecapSerializer(serializers.Serializer):
    cycle_hours_used = serializers.FloatField()
    cycle_hours_available = serializers.FloatField()


class TotalsSerializer(serializers.Serializer):
    off_duty = serializers.FloatField()
    sleeper_berth = serializers.FloatField()
    driving = serializers.FloatField()
    on_duty_not_driving = serializers.FloatField()


class DailyLogSerializer(serializers.Serializer):
    date = serializers.CharField()
    day_number = serializers.IntegerField()
    from_location = serializers.CharField()
    to_location = serializers.CharField()
    total_miles = serializers.IntegerField()
    segments = SegmentSerializer(many=True)
    totals = TotalsSerializer()
    recap = RecapSerializer()
    remarks = serializers.ListField(child=serializers.CharField())


class TripPlanResponseSerializer(serializers.Serializer):
    route = RouteSerializer()
    stops = StopSerializer(many=True)
    daily_logs = DailyLogSerializer(many=True)
