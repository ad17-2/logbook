from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import (
    TripPlanRequestSerializer,
    TripPlanResponseSerializer,
    LocationSearchResultSerializer,
)
from trips.services.trip_planner import plan_trip
from trips.services.location_search import search_locations


class TripPlanView(APIView):
    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = plan_trip(serializer.validated_data)
        response_serializer = TripPlanResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class LocationSearchView(APIView):
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response([], status=status.HTTP_200_OK)

        results = search_locations(query)
        serializer = LocationSearchResultSerializer(results, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
