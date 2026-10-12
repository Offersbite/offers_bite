from fastapi import APIRouter

from app.api.routes import admin, auth, cards, offers, profile, wallet


api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(cards.router)
api_router.include_router(wallet.router)
api_router.include_router(offers.router)
api_router.include_router(admin.router)
