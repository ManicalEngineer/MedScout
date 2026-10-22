from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from models import User
from rate_limit import limiter
from routers.auth import get_current_user
from loops import send_client_event

router = APIRouter()

# Every other Loops event is fired server-side from the business-logic point
# that already knows it happened (report submission, registration, search).
# app_opened_no_action is the one exception — it's a pure client-side
# inactivity timer with no server-observable trigger — so this is the only
# event the client can report directly, and only this one by name.
ClientEventName = Literal["app_opened_no_action"]


class TrackEventRequest(BaseModel):
    event_name: ClientEventName
    event_properties: dict = {}


@router.post("/track", status_code=204)
@limiter.limit("60/hour")
def track_event(
    request: Request,
    body: TrackEventRequest,
    current_user: User = Depends(get_current_user),
):
    # Email comes from the authenticated session, not the request body, so a
    # client can't attribute events to another user's address. LOOPS_API_KEY
    # lives server-side only (see loops.py) — never sent to the mobile app.
    send_client_event(current_user.email, body.event_name, body.event_properties)
