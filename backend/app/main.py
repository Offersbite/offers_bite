import asyncio
from contextlib import suppress
from app.services.offer_lifecycle import archive_expired_offers
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from pymongo.errors import PyMongoError

from app.api.router import api_router
from app.db.indexes import ensure_indexes
from app.db.mongo import client, close_database, connect_database


logger = logging.getLogger(__name__)


async def archive_expiry_loop():
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(archive_expired_offers)
        except PyMongoError:
            logger.exception("Could not archive expired offers; expiry filters remain enforced.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    connect_database()
    ensure_indexes()
    archive_expired_offers()
    archive_task = asyncio.create_task(archive_expiry_loop())
    try:
        yield
    finally:
        archive_task.cancel()
        with suppress(asyncio.CancelledError):
            await archive_task
        close_database()


app = FastAPI(title="OffersBite API", version="1.0.0", lifespan=lifespan)
app.include_router(api_router)


@app.get("/health")
def health_check() -> Response:
    client.admin.command("ping")
    return Response(
        content='{"status":"ok"}',
        status_code=200,
        media_type="application/json",
    )


@app.exception_handler(PyMongoError)
async def database_error_handler(_: Request, exc: PyMongoError) -> Response:
    logger.error(
        "MongoDB operation failed: %s",
        exc,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return Response(
        content='{"error":"Database operation failed"}',
        status_code=500,
        media_type="application/json",
    )
