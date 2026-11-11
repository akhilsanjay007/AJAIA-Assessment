import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import ASGIApp, Receive, Scope, Send

from app.database import Base, engine, settings
from app.routes.auth import router as auth_router
from app.routes.documents import router as documents_router

# The image copies the Vite build to backend/static. Local uvicorn has no
# build there, so the API stays headless and `npm run dev` keeps the proxy.
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
INDEX_FILE = STATIC_DIR / "index.html"
# Browser navigations send text/html. These paths stay on the API even then.
_SPA_SKIP_EXACT = {"/health", "/openapi.json"}
_SPA_SKIP_PREFIXES = ("/docs", "/redoc")


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


def _header(scope: Scope, name: str) -> str:
    target = name.lower().encode("latin-1")
    for key, value in scope.get("headers", []):
        if key.lower() == target:
            return value.decode("latin-1")
    return ""


class SpaFallback:
    """Serve index.html for browser navigations that are not API or asset URLs.

    React and the API both use /documents. fetch() asks for JSON, so those
    requests still reach the routers. A refresh of /documents asks for HTML
    and gets the shell instead of a 401.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not INDEX_FILE.is_file():
            await self.app(scope, receive, send)
            return
        if scope["method"] not in ("GET", "HEAD"):
            await self.app(scope, receive, send)
            return

        path = scope.get("path") or "/"
        if path in _SPA_SKIP_EXACT or path.startswith(_SPA_SKIP_PREFIXES):
            await self.app(scope, receive, send)
            return

        filename = path.rsplit("/", 1)[-1]
        if "." in filename:
            # /assets/* is the Vite mount. Other built files (a favicon, for
            # example) are read from the static directory here.
            if path.startswith("/assets/"):
                await self.app(scope, receive, send)
                return
            built = _built_file(path)
            if built is not None:
                await FileResponse(built)(scope, receive, send)
                return
            await self.app(scope, receive, send)
            return

        wants_html = "text/html" in _header(scope, "accept").lower()
        if path == "/" or wants_html:
            await FileResponse(INDEX_FILE)(scope, receive, send)
            return

        await self.app(scope, receive, send)


def _built_file(url_path: str) -> Path | None:
    relative = url_path.lstrip("/")
    if not relative or ".." in Path(relative).parts:
        return None
    root = STATIC_DIR.resolve()
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


_assets = STATIC_DIR / "assets"
if _assets.is_dir():
    # After the routers, so /documents still reaches the API unless the
    # browser asked for HTML and the fallback above handled it.
    app.mount("/assets", StaticFiles(directory=_assets), name="frontend")

app.add_middleware(SpaFallback)
