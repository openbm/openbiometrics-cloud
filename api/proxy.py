"""Proxy routes that forward requests to the OpenBiometrics engine with auth, rate limiting, and usage tracking."""

import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from auth import authenticate_api_key
from config import get_settings
from db import ApiKey, Tenant, get_db
from usage import check_usage_limit, log_usage, PLAN_RATE_LIMITS

router = APIRouter(prefix="/v1", tags=["biometrics"])
settings = get_settings()


async def _proxy_request(
    request: Request,
    engine_path: str,
    tenant: Tenant,
    api_key: ApiKey,
    db: AsyncSession,
    files: dict | None = None,
    data: dict | None = None,
):
    """Forward a request to the engine and track usage."""
    # Check monthly limit
    if not await check_usage_limit(db, tenant):
        raise HTTPException(
            status_code=429,
            detail=f"Monthly usage limit exceeded for {tenant.plan} plan. Upgrade at https://app.openbiometrics.dev/billing",
        )

    start = time.monotonic()
    engine_url = f"{settings.engine_url}/api/v1{engine_path}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            if files:
                response = await client.post(engine_url, files=files, data=data or {})
            elif request.method == "GET":
                response = await client.get(engine_url, params=dict(request.query_params))
            else:
                body = await request.body()
                response = await client.request(
                    method=request.method,
                    url=engine_url,
                    content=body,
                    headers={"Content-Type": request.headers.get("Content-Type", "application/json")},
                )
    except httpx.ConnectError:
        elapsed = (time.monotonic() - start) * 1000
        await log_usage(db, tenant.id, api_key.id, engine_path, request.method, 502, elapsed)
        raise HTTPException(status_code=502, detail="Biometric engine is unavailable")
    except httpx.TimeoutException:
        elapsed = (time.monotonic() - start) * 1000
        await log_usage(db, tenant.id, api_key.id, engine_path, request.method, 504, elapsed)
        raise HTTPException(status_code=504, detail="Engine request timed out")

    elapsed = (time.monotonic() - start) * 1000
    await log_usage(db, tenant.id, api_key.id, engine_path, request.method, response.status_code, elapsed)

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type", "application/json"),
    )


# ---------- Face endpoints ----------

@router.post("/detect")
async def detect_faces(
    request: Request,
    image: UploadFile = File(...),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    image_bytes = await image.read()
    return await _proxy_request(
        request, "/detect", tenant, api_key, db,
        files={"image": (image.filename, image_bytes, image.content_type)},
    )


@router.post("/verify")
async def verify_faces(
    request: Request,
    image1: UploadFile = File(...),
    image2: UploadFile = File(...),
    threshold: float = Form(0.4),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    img1_bytes = await image1.read()
    img2_bytes = await image2.read()
    return await _proxy_request(
        request, "/verify", tenant, api_key, db,
        files={
            "image1": (image1.filename, img1_bytes, image1.content_type),
            "image2": (image2.filename, img2_bytes, image2.content_type),
        },
        data={"threshold": str(threshold)},
    )


@router.post("/identify")
async def identify_face(
    request: Request,
    image: UploadFile = File(...),
    watchlist_name: str = Form("default"),
    top_k: int = Form(5),
    threshold: float = Form(0.4),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    image_bytes = await image.read()
    return await _proxy_request(
        request, "/identify", tenant, api_key, db,
        files={"image": (image.filename, image_bytes, image.content_type)},
        data={
            "watchlist_name": watchlist_name,
            "top_k": str(top_k),
            "threshold": str(threshold),
        },
    )


# ---------- Document endpoints ----------

@router.post("/documents/scan")
async def scan_document(
    request: Request,
    image: UploadFile = File(...),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    image_bytes = await image.read()
    return await _proxy_request(
        request, "/documents/scan", tenant, api_key, db,
        files={"image": (image.filename, image_bytes, image.content_type)},
    )


@router.post("/documents/ocr")
async def document_ocr(
    request: Request,
    image: UploadFile = File(...),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    image_bytes = await image.read()
    return await _proxy_request(
        request, "/documents/ocr", tenant, api_key, db,
        files={"image": (image.filename, image_bytes, image.content_type)},
    )


@router.post("/documents/mrz")
async def document_mrz(
    request: Request,
    image: UploadFile = File(...),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    image_bytes = await image.read()
    return await _proxy_request(
        request, "/documents/mrz", tenant, api_key, db,
        files={"image": (image.filename, image_bytes, image.content_type)},
    )


# ---------- Liveness endpoints ----------

@router.post("/liveness/sessions")
async def create_liveness_session(
    request: Request,
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    return await _proxy_request(request, "/liveness/sessions", tenant, api_key, db)


@router.get("/liveness/sessions/{session_id}")
async def get_liveness_session(
    request: Request,
    session_id: str,
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    return await _proxy_request(request, f"/liveness/sessions/{session_id}", tenant, api_key, db)


@router.post("/liveness/sessions/{session_id}/frames")
async def submit_liveness_frame(
    request: Request,
    session_id: str,
    frame: UploadFile = File(...),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    frame_bytes = await frame.read()
    return await _proxy_request(
        request, f"/liveness/sessions/{session_id}/frames", tenant, api_key, db,
        files={"frame": (frame.filename, frame_bytes, frame.content_type)},
    )


# ---------- Watchlist endpoints ----------

@router.post("/watchlists/{name}/enroll")
async def enroll_face(
    request: Request,
    name: str,
    image: UploadFile = File(...),
    label: str = Form(...),
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    image_bytes = await image.read()
    return await _proxy_request(
        request, f"/watchlists/{name}/enroll", tenant, api_key, db,
        files={"image": (image.filename, image_bytes, image.content_type)},
        data={"label": label},
    )


@router.get("/watchlists")
async def list_watchlists(
    request: Request,
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    return await _proxy_request(request, "/watchlists", tenant, api_key, db)


@router.delete("/watchlists/{name}/{identity_id}")
async def remove_from_watchlist(
    request: Request,
    name: str,
    identity_id: str,
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    return await _proxy_request(request, f"/watchlists/{name}/{identity_id}", tenant, api_key, db)


# ---------- Health ----------

@router.get("/health")
async def health(
    request: Request,
    auth: tuple[Tenant, ApiKey] = Depends(authenticate_api_key),
    db: AsyncSession = Depends(get_db),
):
    tenant, api_key = auth
    return await _proxy_request(request, "/health", tenant, api_key, db)
