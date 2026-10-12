"""Loops.so lifecycle email trigger — fires once when a user transitions from
never-contributed to contributed. Never sees report content: only email,
event name, and the hasContributed flag cross this boundary, keeping
AvailabilityReport anonymity intact.
"""
import logging
import os
import threading

import httpx

logger = logging.getLogger(__name__)

LOOPS_EVENTS_URL = "https://app.loops.so/api/v1/events/send"
LOOPS_CONTACTS_URL = "https://app.loops.so/api/v1/contacts/update"
LOOPS_TIMEOUT = 5
FIRST_REPORT_EVENT = "first_report_submitted"
CONTRIBUTOR_MILESTONE_EVENT = "contributor_milestone"
USER_ONBOARDED_EVENT = "user_onboarded"
PHARMACY_SEARCH_EVENT = "pharmacy_search_completed"
CONTRIBUTOR_MILESTONE_THRESHOLD = int(os.getenv("CONTRIBUTOR_MILESTONE_THRESHOLD", "3"))


def _post_with_retry(url: str, payload: dict, headers: dict) -> None:
    for attempt in range(2):
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=LOOPS_TIMEOUT)
            resp.raise_for_status()
            return
        except Exception:
            if attempt == 1:
                logger.exception("Loops request to %s failed after retry", url)


def _send_event(email: str, event_name: str, event_properties: dict | None = None) -> None:
    api_key = os.getenv("LOOPS_API_KEY", "")
    if not api_key:
        return
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {"email": email, "eventName": event_name}
    if event_properties:
        payload["eventProperties"] = event_properties
    _post_with_retry(LOOPS_EVENTS_URL, payload, headers)


def _send_first_report_event(email: str) -> None:
    api_key = os.getenv("LOOPS_API_KEY", "")
    if not api_key:
        return
    _send_event(email, FIRST_REPORT_EVENT)
    _post_with_retry(
        LOOPS_CONTACTS_URL,
        {"email": email, "hasContributed": True},
        {"Authorization": f"Bearer {api_key}"},
    )


def _fire_and_forget(target, *args) -> None:
    """Runs on a daemon thread so a Loops outage or slow response can never
    add latency to, or fail, the request that triggered it."""
    threading.Thread(target=target, args=args, daemon=True).start()


def send_first_report_event(email: str) -> None:
    _fire_and_forget(_send_first_report_event, email)


def send_contributor_milestone_event(email: str, report_count: int) -> None:
    """Call only when report_count has just reached CONTRIBUTOR_MILESTONE_THRESHOLD
    (callers check this — kept here as the single source of truth for the threshold
    value, which also comes from this module)."""
    _fire_and_forget(_send_event, email, CONTRIBUTOR_MILESTONE_EVENT, {"reportCount": report_count})


def send_user_onboarded_event(email: str, platform: str | None) -> None:
    _fire_and_forget(_send_event, email, USER_ONBOARDED_EVENT, {"platform": platform} if platform else {})


def send_pharmacy_search_event(email: str, results_count: int) -> None:
    _fire_and_forget(_send_event, email, PHARMACY_SEARCH_EVENT, {"resultsCount": results_count})


def send_client_event(email: str, event_name: str, event_properties: dict | None = None) -> None:
    """For the one event the mobile client reports directly (app_opened_no_action)
    — see routers/analytics.py. Every other event fires from the server-side
    code path that already knows it happened."""
    _fire_and_forget(_send_event, email, event_name, event_properties)
