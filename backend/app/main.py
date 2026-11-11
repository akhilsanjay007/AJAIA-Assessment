import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, settings
from app.routes.auth import router as auth_router
from app.routes.documents import router as documents_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Document Editor", lifespan=lifespan)

def _cors_origins() -> list[str]:
    # CORS_ORIGINS is the deployed frontend origin. Comma-separate more than one.
    # Example: https://your-frontend.up.railway.app
    raw = os.environ.get("CORS_ORIGINS", settings.cors_origins)
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    for part in raw.split(","):
        origin = part.strip().strip("\"'").rstrip("/")
        if origin:
            origins.append(origin)
    return list(dict.fromkeys(origins))


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(documents_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
