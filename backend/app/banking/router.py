import os

from fastapi import APIRouter, Header, HTTPException, Query

from app.banking.models import (
    AccountDetail,
    BankAccount,
    BankingIssue,
    BlockCardRequest,
    Customer,
    CustomerSummary,
    IssueSummary,
    ResolveIssueRequest,
)
from app.banking.repository import banking_repo, mask_account_number

router = APIRouter(prefix="/api/banking", tags=["banking"])


def _optional_banking_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")):
    expected = os.getenv("BANKING_API_KEY", "").strip()
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


@router.get("/health")
def banking_health() -> dict[str, str]:
    return {"status": "ok", "service": "banking-demo"}


@router.post("/reset")
def reset_demo_data() -> dict[str, str]:
    """Reset in-memory data to seed state (local demos only)."""
    if os.getenv("BANKING_ALLOW_RESET", "true").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=403, detail="Reset disabled")
    banking_repo.reset()
    return {"status": "reset"}


@router.get("/demo-profiles")
def list_demo_profiles() -> list[dict[str, str]]:
    """Quick picker for frontend: who to impersonate in local dev."""
    return [
        {
            "customer_id": s.customer.id,
            "display_name": s.customer.preferred_name,
            "scenario": s.customer.full_legal_name,
            "open_issues": str(s.open_issue_count),
            "hint": next(
                (
                    acc.issues[0].customer_visible_hint
                    for acc in banking_repo.list_accounts(s.customer.id)
                    if acc.issues
                ),
                "No open issues — clean account",
            ),
        }
        for s in banking_repo.list_customers()
    ]


@router.get("/customers", response_model=list[CustomerSummary])
def list_customers() -> list[CustomerSummary]:
    return banking_repo.list_customers()


@router.get("/customers/{customer_id}", response_model=Customer)
def get_customer(customer_id: str) -> Customer:
    return banking_repo.get_customer(customer_id)


@router.get("/accounts", response_model=list[BankAccount])
def list_accounts(
    customer_id: str | None = Query(default=None, description="Filter by customer"),
) -> list[BankAccount]:
    return banking_repo.list_accounts(customer_id=customer_id)


@router.get("/accounts/{account_id}", response_model=AccountDetail)
def get_account(account_id: str) -> AccountDetail:
    return banking_repo.get_account(account_id)


@router.get("/accounts/by-number/{account_number}", response_model=AccountDetail)
def get_account_by_number(account_number: str) -> AccountDetail:
    return banking_repo.get_account_by_number(account_number)


@router.get("/accounts/{account_id}/issues", response_model=IssueSummary)
def get_account_issues(account_id: str) -> IssueSummary:
    detail = banking_repo.get_account(account_id)
    return IssueSummary(
        account_id=detail.account.id,
        account_number_masked=mask_account_number(detail.account.account_number),
        issues=detail.account.issues,
    )


@router.get("/issues/open")
def list_open_issues(
    account_id: str | None = Query(default=None),
) -> list[dict[str, BankingIssue | str]]:
    rows = banking_repo.list_open_issues(account_id=account_id)
    return [
        {
            "account_id": aid,
            "issue": issue,
        }
        for aid, issue in rows
    ]


@router.post("/accounts/{account_id}/issues/{issue_id}/resolve", response_model=BankingIssue)
def resolve_issue(
    account_id: str,
    issue_id: str,
    body: ResolveIssueRequest,
) -> BankingIssue:
    return banking_repo.resolve_issue(
        account_id, issue_id, body.resolution_note, body.mark_resolved
    )


@router.post("/accounts/{account_id}/cards/block", response_model=BankAccount)
def block_card(account_id: str, body: BlockCardRequest) -> BankAccount:
    return banking_repo.block_card(
        account_id=account_id,
        card_id=body.card_id,
        confirm_last_four=body.confirm_last_four,
        reason=body.reason,
    )
