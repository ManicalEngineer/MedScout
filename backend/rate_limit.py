"""Shared rate limiter — lives in its own module so routers and main.py
can both import it without a circular import."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
