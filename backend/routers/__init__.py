from fastapi import APIRouter

from .auth import router as auth_router
from .users import router as users_router
from .pharmacies import router as pharmacies_router
from .calls import router as calls_router
from .availability import router as availability_router
from .scripts import router as scripts_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(pharmacies_router, prefix="/pharmacies", tags=["pharmacies"])
api_router.include_router(calls_router, prefix="/calls", tags=["calls"])
api_router.include_router(availability_router, prefix="/availability", tags=["availability"])
api_router.include_router(scripts_router, prefix="/scripts", tags=["scripts"])
