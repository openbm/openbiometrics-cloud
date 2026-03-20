from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse

from config import get_settings
from db import init_db
from tenants import router as tenants_router
from billing import router as billing_router
from proxy import router as proxy_router
from usage import router as usage_router

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="OpenBiometrics Cloud",
    description="SaaS API for OpenBiometrics — face recognition, liveness detection, document processing, and more.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please slow down or upgrade your plan."},
    )


# Mount routers
app.include_router(tenants_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(proxy_router, prefix="/api")
app.include_router(usage_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "OpenBiometrics Cloud",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "operational",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
