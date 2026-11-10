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

# Local Vite is always allowed. After the frontend is deployed, uncomment the
# placeholder and replace it with that origin, or set CORS_ORIGINS in the environment.
# Example: "https://your-app.vercel.app"
allow_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # "https://YOUR-FRONTEND-URL",
    *settings.cors_origin_list,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(allow_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(documents_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
