import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripPlanRequestSerializer
from .services.trip_planner import plan_trip

NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'


class TripPlanView(APIView):
    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = plan_trip(serializer.validated_data)
        except ValueError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(result, status=status.HTTP_200_OK)


class LocationSearchView(APIView):
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response([], status=status.HTTP_200_OK)

        try:
            resp = requests.get(
                NOMINATIM_SEARCH_URL,
                params={
                    'q': query,
                    'format': 'json',
                    'countrycodes': 'us',
                    'limit': 5,
                },
                headers={'User-Agent': 'ELDTripPlanner/1.0'},
                timeout=10,
            )
            resp.raise_for_status()
        except requests.RequestException:
            return Response(
                {'detail': 'Location search service unavailable'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        results = [
            {
                'name': r.get('display_name', ''),
                'lat': float(r['lat']),
                'lng': float(r['lon']),
            }
            for r in resp.json()
        ]
        return Response(results, status=status.HTTP_200_OK)
