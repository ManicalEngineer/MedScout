"""Exception handlers that turn infrastructure errors into clean API responses."""
import logging

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

DB_BUSY_MESSAGE = "We're very busy right now. Please try again in a few seconds."
DB_BUSY_RETRY_AFTER = 5


def db_pool_timeout_handler(request, exc) -> JSONResponse:
    """SQLAlchemy's QueuePool raises TimeoutError when every connection is in use
    for longer than pool_timeout (10 s). That is overload, not a bug: answer 503
    with Retry-After instead of an unhandled 500."""
    logger.warning("db_pool_timeout path=%s method=%s", request.url.path, request.method)
    return JSONResponse(
        {"detail": DB_BUSY_MESSAGE},
        status_code=503,
        headers={"Retry-After": str(DB_BUSY_RETRY_AFTER)},
    )
