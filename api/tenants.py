from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import (
    create_access_token,
    generate_api_key,
    get_current_tenant,
    hash_api_key,
    hash_password,
    verify_password,
)
from db import ApiKey, Tenant, get_db

router = APIRouter(prefix="/tenants", tags=["tenants"])


# ---------- Schemas ----------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    company: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_id: str


class TenantResponse(BaseModel):
    id: str
    email: str
    name: str | None
    company: str | None
    plan: str
    is_active: bool
    created_at: str


class UpdateTenantRequest(BaseModel):
    name: str | None = None
    company: str | None = None


class ApiKeyCreate(BaseModel):
    name: str = "Default"
    environment: str = "test"


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    environment: str
    is_active: bool
    last_used_at: str | None
    created_at: str
    raw_key: str | None = None  # Only returned on creation


class ApiKeyListResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    environment: str
    is_active: bool
    last_used_at: str | None
    created_at: str


# ---------- Auth Routes ----------

@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Tenant).where(Tenant.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    tenant = Tenant(
        email=req.email,
        password_hash=hash_password(req.password),
        name=req.name,
        company=req.company,
    )
    db.add(tenant)
    await db.commit()

    token = create_access_token(tenant.id)
    return AuthResponse(access_token=token, tenant_id=tenant.id)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.email == req.email))
    tenant = result.scalar_one_or_none()
    if not tenant or not verify_password(req.password, tenant.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not tenant.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(tenant.id)
    return AuthResponse(access_token=token, tenant_id=tenant.id)


# ---------- Tenant Profile ----------

@router.get("/me", response_model=TenantResponse)
async def get_profile(tenant: Tenant = Depends(get_current_tenant)):
    return TenantResponse(
        id=tenant.id,
        email=tenant.email,
        name=tenant.name,
        company=tenant.company,
        plan=tenant.plan,
        is_active=tenant.is_active,
        created_at=tenant.created_at.isoformat(),
    )


@router.patch("/me", response_model=TenantResponse)
async def update_profile(
    req: UpdateTenantRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if req.name is not None:
        tenant.name = req.name
    if req.company is not None:
        tenant.company = req.company
    await db.commit()
    await db.refresh(tenant)
    return TenantResponse(
        id=tenant.id,
        email=tenant.email,
        name=tenant.name,
        company=tenant.company,
        plan=tenant.plan,
        is_active=tenant.is_active,
        created_at=tenant.created_at.isoformat(),
    )


# ---------- API Key Management ----------

@router.post("/api-keys", response_model=ApiKeyResponse)
async def create_api_key(
    req: ApiKeyCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if req.environment not in ("live", "test"):
        raise HTTPException(status_code=400, detail="Environment must be 'live' or 'test'")

    raw_key = generate_api_key(req.environment)
    api_key = ApiKey(
        tenant_id=tenant.id,
        key_hash=hash_api_key(raw_key),
        key_prefix=raw_key[:12],
        name=req.name,
        environment=req.environment,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return ApiKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        environment=api_key.environment,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at.isoformat() if api_key.last_used_at else None,
        created_at=api_key.created_at.isoformat(),
        raw_key=raw_key,  # Only time we return the full key
    )


@router.get("/api-keys", response_model=list[ApiKeyListResponse])
async def list_api_keys(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.tenant_id == tenant.id).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        ApiKeyListResponse(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            environment=k.environment,
            is_active=k.is_active,
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            created_at=k.created_at.isoformat(),
        )
        for k in keys
    ]


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.tenant_id == tenant.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.is_active = False
    await db.commit()
    return {"detail": "API key revoked"}
