"""Keeps the load-test server away from the real internet.

Installed by local_server.py before the app is imported. Two layers:

1. httpx: the app's Google Places / Geocoding / Place Details calls and Expo push
   call are rewritten to the local mock (MOCK_UPSTREAM_BASE). Any other httpx
   request (Loops, Apple, openFDA, Google JWKS...) fails with an httpx.ConnectError,
   which the app already handles as an ordinary network failure.
2. sockets: a process-wide guard refuses any TCP connect() to a non-loopback
   address, so even code that bypasses httpx cannot reach a real service.

The app itself is not modified; it still contains its real URLs.
"""
import ipaddress
import socket
import sys
from urllib.parse import urlsplit

import httpx

GOOGLE_HOST = "maps.googleapis.com"
EXPO_URL_PREFIX = "https://exp.host/--/api/v2/push/send"

blocked: dict = {}     # host -> number of refused attempts
rewritten: dict = {}   # "google"/"expo" -> count
_orig = {}
_mock_base = None


def _is_loopback_host(host: str) -> bool:
    if host in ("localhost", ""):
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def is_loopback_url(url: str) -> bool:
    return _is_loopback_host(urlsplit(url).hostname or "")


def rewrite(url: str):
    """The URL to really request, or None if this destination must be refused."""
    parts = urlsplit(url)
    if _mock_base:
        if parts.hostname == GOOGLE_HOST:
            rewritten["google"] = rewritten.get("google", 0) + 1
            return f"{_mock_base}/google{parts.path}" + (f"?{parts.query}" if parts.query else "")
        if url.startswith(EXPO_URL_PREFIX):
            rewritten["expo"] = rewritten.get("expo", 0) + 1
            return f"{_mock_base}/expo/push/send"
    if _is_loopback_host(parts.hostname or ""):
        return url      # the mock itself (or the app talking to itself)
    return None


def _note_blocked(host: str):
    if host not in blocked:
        print(f"[loadtest isolation] refusing outbound request to {host}", file=sys.stderr, flush=True)
    blocked[host] = blocked.get(host, 0) + 1


def _patched_send(orig):
    def send(self, request, **kw):
        url = str(request.url)
        new = rewrite(url)
        if new is None:
            host = request.url.host
            _note_blocked(host)
            raise httpx.ConnectError(f"blocked by loadtest isolation: {host}", request=request)
        if new != url:
            request.url = httpx.URL(new)
            request.headers["Host"] = request.url.netloc.decode()
        return orig(self, request, **kw)
    return send


def _patched_async_send(orig):
    async def send(self, request, **kw):
        url = str(request.url)
        new = rewrite(url)
        if new is None:
            _note_blocked(request.url.host)
            raise httpx.ConnectError(f"blocked by loadtest isolation: {request.url.host}", request=request)
        if new != url:
            request.url = httpx.URL(new)
            request.headers["Host"] = request.url.netloc.decode()
        return await orig(self, request, **kw)
    return send


def _guard_connect(orig):
    def connect(self, address):
        if self.family in (socket.AF_INET, socket.AF_INET6) and isinstance(address, tuple):
            host = address[0]
            if not _is_loopback_host(host):
                _note_blocked(str(host))
                raise OSError(f"blocked by loadtest isolation: non-loopback connect to {host}")
        return orig(self, address)
    return connect


def install(mock_base: str | None) -> None:
    global _mock_base
    if _orig:
        uninstall()
    if mock_base:
        mock_base = mock_base.rstrip("/")
        if not is_loopback_url(mock_base):
            raise SystemExit(f"refusing to run: MOCK_UPSTREAM_BASE must be a loopback URL (got {mock_base!r})")
    _mock_base = mock_base
    _orig.update(
        send=httpx.Client.send, async_send=httpx.AsyncClient.send,
        connect=socket.socket.connect, connect_ex=socket.socket.connect_ex,
    )
    httpx.Client.send = _patched_send(_orig["send"])
    httpx.AsyncClient.send = _patched_async_send(_orig["async_send"])
    socket.socket.connect = _guard_connect(_orig["connect"])

    def connect_ex(self, address):
        try:
            return _guard_connect(_orig["connect_ex"])(self, address)
        except OSError as e:
            return e.errno or 101
    socket.socket.connect_ex = connect_ex


def uninstall() -> None:
    global _mock_base
    if not _orig:
        return
    httpx.Client.send = _orig["send"]
    httpx.AsyncClient.send = _orig["async_send"]
    socket.socket.connect = _orig["connect"]
    socket.socket.connect_ex = _orig["connect_ex"]
    _orig.clear()
    blocked.clear()
    rewritten.clear()
    _mock_base = None
