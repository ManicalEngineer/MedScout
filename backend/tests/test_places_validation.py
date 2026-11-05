"""/pharmacies/nearby: input validation and the loader's no-raise promise."""
from unittest.mock import MagicMock, patch

import pytest

import routers.pharmacies as ph
from test_places_cache import get, places_response

URL = "/api/v1/pharmacies/nearby"


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")


@pytest.mark.parametrize("lat,lng", [
    (91, 0), (-90.0001, 0), (0, 181), (0, -180.5), (1000, 1000),
    ("nan", 0), (0, "nan"), ("inf", 0), (0, "-inf"), ("abc", 0),
])
@patch("routers.pharmacies.httpx.get")
def test_out_of_range_or_non_finite_coordinates_are_422_and_never_reach_google(mock_get, lat, lng, client, auth):
    r = client.get(URL, headers=auth, params={"lat": lat, "lng": lng})
    assert r.status_code == 422
    assert mock_get.call_count == 0


@pytest.mark.parametrize("lat,lng", [(90, 180), (-90, -180), (0, 0), (34.09, -118.41)])
@patch("routers.pharmacies.httpx.get")
def test_boundary_coordinates_are_accepted(mock_get, lat, lng, client, auth):
    mock_get.return_value = places_response()
    assert get(client, auth, lat=lat, lng=lng).status_code == 200


@patch("routers.pharmacies.httpx.get")
def test_radius_is_clamped_not_rejected(mock_get, client, auth):
    mock_get.return_value = places_response()
    for asked, sent in [(100, 500), (200_000, 50_000), (8000, 8000)]:
        assert get(client, auth, radius_meters=asked).status_code == 200
        assert mock_get.call_args.kwargs["params"]["radius"] == sent
    assert "clamped" in ph.nearby_pharmacies.__doc__


@pytest.mark.parametrize("boom", ["runtime", "type", "attribute", "key"])
@patch("routers.pharmacies.httpx.get")
def test_any_exception_in_the_loader_is_a_503_not_a_500(mock_get, boom, client, auth):
    if boom == "runtime":
        mock_get.side_effect = RuntimeError("anything")
    elif boom == "type":
        mock_get.side_effect = TypeError("anything")
    elif boom == "attribute":
        m = MagicMock(status_code=200)
        m.json.return_value = ["not", "a", "dict"]            # .get on a list
        mock_get.return_value = m
    else:
        m = MagicMock(status_code=200)
        m.json.return_value = {"status": "OK", "results": [{"name": "no place_id"}]}
        mock_get.return_value = m
    r = get(client, auth)
    assert r.status_code == 503
    assert r.json()["detail"] == ph.PLACES_UNAVAILABLE
    assert r.headers.get("content-type", "").startswith("application/json")
