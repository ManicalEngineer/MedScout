"""Checks that the isolation layer keeps the load-test server off the internet.

    cd backend && .venv/bin/python -m pytest ../loadtest/test_isolation.py -q
"""
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import isolation  # noqa: E402


class Echo(BaseHTTPRequestHandler):
    def do_GET(self):
        body = f"{self.path}|host={self.headers.get('Host')}".encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_POST = do_GET

    def log_message(self, *a):
        pass


@pytest.fixture
def mock():
    srv = HTTPServer(("127.0.0.1", 0), Echo)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_port}"
    isolation.install(base)
    yield base
    isolation.uninstall()
    srv.shutdown()


def test_google_and_expo_calls_land_on_the_mock(mock):
    r = httpx.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", params={"location": "1,2", "key": "k"})
    assert r.text.startswith("/google/maps/api/place/nearbysearch/json?location=1%2C2&key=k")
    assert f"host=127.0.0.1:{mock.rsplit(':', 1)[1]}" in r.text
    r = httpx.post("https://exp.host/--/api/v2/push/send", json=[{"to": "x"}])
    assert r.text.startswith("/expo/push/send")
    assert isolation.rewritten == {"google": 1, "expo": 1}


@pytest.mark.parametrize("url", [
    "https://app.loops.so/api/v1/events/send", "https://appleid.apple.com/auth/revoke",
    "https://api.fda.gov/drug/shortages.json", "https://www.googleapis.com/oauth2/v3/certs", "https://example.com/",
])
def test_every_other_destination_is_refused(mock, url):
    with pytest.raises(httpx.ConnectError, match="blocked by loadtest isolation"):
        httpx.post(url, json={})
    assert isolation.blocked


def test_without_a_mock_even_google_and_expo_are_refused():
    isolation.install(None)
    try:
        for url in ("https://maps.googleapis.com/maps/api/geocode/json", "https://exp.host/--/api/v2/push/send"):
            with pytest.raises(httpx.ConnectError):
                httpx.get(url)
    finally:
        isolation.uninstall()


def test_socket_guard_blocks_raw_non_loopback_connects_but_not_loopback(mock):
    with pytest.raises(OSError, match="blocked by loadtest isolation"):
        socket.create_connection(("93.184.216.34", 80), timeout=1)
    s = socket.socket()
    assert s.connect_ex(("8.8.8.8", 53)) != 0
    s.close()
    port = int(mock.rsplit(":", 1)[1])
    socket.create_connection(("127.0.0.1", port), timeout=2).close()     # loopback still fine


def test_non_loopback_mock_base_is_refused():
    with pytest.raises(SystemExit, match="loopback"):
        isolation.install("http://10.1.2.3:8002")
    isolation.uninstall()


def test_uninstall_restores_normal_behaviour():
    isolation.install(None)
    isolation.uninstall()
    assert httpx.Client.send.__module__ == "httpx._client"
    assert socket.socket.connect is not None
