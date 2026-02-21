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
