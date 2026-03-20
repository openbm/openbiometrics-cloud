from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db import UsageLog, Tenant, get_db
from config import get_settings
from auth import get_current_tenant

settings = get_settings()

PLAN_MONTHLY_LIMITS = {
    "free": settings.monthly_limit_free,
    "developer": settings.monthly_limit_developer,
    "pro": settings.monthly_limit_pro,
    "enterprise": settings.monthly_limit_enterprise,
}

PLAN_RATE_LIMITS = {
    "free": settings.rate_limit_free,
    "developer": settings.rate_limit_developer,
    "pro": settings.rate_limit_pro,
    "enterprise": settings.rate_limit_enterprise,
}


async def log_usage(
    db: AsyncSession,
    tenant_id: str,
    api_key_id: str | None,
    endpoint: str,
    method: str,
    status_code: int,
    response_time_ms: float,
):
    log = UsageLog(
        tenant_id=tenant_id,
        api_key_id=api_key_id,
        endpoint=endpoint,
        method=method,
        status_code=status_code,
        response_time_ms=response_time_ms,
    )
    db.add(log)
    await db.commit()


async def get_monthly_usage(db: AsyncSession, tenant_id: str) -> int:
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.tenant_id == tenant_id,
            UsageLog.created_at >= start_of_month,
        )
    )
    return result.scalar() or 0


async def check_usage_limit(db: AsyncSession, tenant: Tenant) -> bool:
    """Return True if tenant is within their monthly limit."""
    limit = PLAN_MONTHLY_LIMITS.get(tenant.plan, 100)
    usage = await get_monthly_usage(db, tenant.id)
    return usage < limit


async def get_usage_stats(db: AsyncSession, tenant_id: str, days: int = 30) -> dict:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    # Total calls
    total_result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.tenant_id == tenant_id,
            UsageLog.created_at >= start,
        )
    )
    total_calls = total_result.scalar() or 0

    # Average response time
    avg_result = await db.execute(
        select(func.avg(UsageLog.response_time_ms)).where(
            UsageLog.tenant_id == tenant_id,
            UsageLog.created_at >= start,
        )
    )
    avg_response_time = round(avg_result.scalar() or 0, 2)

    # Calls by endpoint
    endpoint_result = await db.execute(
        select(UsageLog.endpoint, func.count(UsageLog.id))
        .where(UsageLog.tenant_id == tenant_id, UsageLog.created_at >= start)
        .group_by(UsageLog.endpoint)
        .order_by(func.count(UsageLog.id).desc())
    )
    by_endpoint = {row[0]: row[1] for row in endpoint_result.all()}

    # Calls by day
    daily_result = await db.execute(
        select(
            func.date(UsageLog.created_at),
            func.count(UsageLog.id),
        )
        .where(UsageLog.tenant_id == tenant_id, UsageLog.created_at >= start)
        .group_by(func.date(UsageLog.created_at))
        .order_by(func.date(UsageLog.created_at))
    )
    daily = {str(row[0]): row[1] for row in daily_result.all()}

    # Error rate
    error_result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.tenant_id == tenant_id,
            UsageLog.created_at >= start,
            UsageLog.status_code >= 400,
        )
    )
    error_count = error_result.scalar() or 0
    error_rate = round((error_count / total_calls * 100) if total_calls > 0 else 0, 2)

    # Monthly usage & limit
    monthly_usage = await get_monthly_usage(db, tenant_id)
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    plan = tenant.plan if tenant else "free"
    monthly_limit = PLAN_MONTHLY_LIMITS.get(plan, 100)

    return {
        "total_calls": total_calls,
        "avg_response_time_ms": avg_response_time,
        "error_rate_percent": error_rate,
        "by_endpoint": by_endpoint,
        "daily": daily,
        "monthly_usage": monthly_usage,
        "monthly_limit": monthly_limit,
        "plan": plan,
    }


# ---------- Router ----------

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/stats")
async def usage_stats(
    days: int = Query(30, ge=1, le=365),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    return await get_usage_stats(db, tenant.id, days)
