import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_tenant
from config import get_settings
from db import Tenant, get_db

router = APIRouter(prefix="/billing", tags=["billing"])
settings = get_settings()

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key

PLAN_PRICES = {
    "developer": "price_developer_monthly",  # Replace with real Stripe price IDs
    "pro": "price_pro_monthly",
    "enterprise": "price_enterprise_monthly",
}


class CreateCheckoutRequest(BaseModel):
    plan: str
    success_url: str = "https://app.openbiometrics.dev/billing?success=true"
    cancel_url: str = "https://app.openbiometrics.dev/billing?canceled=true"


class BillingResponse(BaseModel):
    plan: str
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    portal_url: str | None = None


@router.get("/", response_model=BillingResponse)
async def get_billing(
    tenant: Tenant = Depends(get_current_tenant),
):
    portal_url = None
    if tenant.stripe_customer_id and settings.stripe_secret_key:
        try:
            session = stripe.billing_portal.Session.create(
                customer=tenant.stripe_customer_id,
                return_url="https://app.openbiometrics.dev/billing",
            )
            portal_url = session.url
        except Exception:
            pass

    return BillingResponse(
        plan=tenant.plan,
        stripe_customer_id=tenant.stripe_customer_id,
        stripe_subscription_id=tenant.stripe_subscription_id,
        portal_url=portal_url,
    )


@router.post("/checkout")
async def create_checkout(
    req: CreateCheckoutRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured")

    if req.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")

    # Create or reuse Stripe customer
    if not tenant.stripe_customer_id:
        customer = stripe.Customer.create(
            email=tenant.email,
            name=tenant.name or tenant.email,
            metadata={"tenant_id": tenant.id},
        )
        tenant.stripe_customer_id = customer.id
        await db.commit()

    session = stripe.checkout.Session.create(
        customer=tenant.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": PLAN_PRICES[req.plan], "quantity": 1}],
        success_url=req.success_url,
        cancel_url=req.cancel_url,
        metadata={"tenant_id": tenant.id, "plan": req.plan},
    )

    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        tenant_id = session.get("metadata", {}).get("tenant_id")
        plan = session.get("metadata", {}).get("plan")
        subscription_id = session.get("subscription")

        if tenant_id and plan:
            result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            if tenant:
                tenant.plan = plan
                tenant.stripe_subscription_id = subscription_id
                await db.commit()

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        result = await db.execute(
            select(Tenant).where(Tenant.stripe_customer_id == customer_id)
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            tenant.plan = "free"
            tenant.stripe_subscription_id = None
            await db.commit()

    return {"received": True}
