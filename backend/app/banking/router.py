import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.banking.database import get_db, reset_database
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
from app.banking.repository import BankingRepository, mask_account_number

router = APIRouter(prefix="/api/banking", tags=["banking"])


def get_banking_repo(db: Session = Depends(get_db)) -> BankingRepository:
    return BankingRepository(db)


@router.get("/health")
def banking_health() -> dict[str, str]:
    return {"status": "ok", "service": "banking-demo", "storage": "postgres"}


@router.post("/reset")
def reset_demo_data() -> dict[str, str]:
    """Reset database to seed state (local demos only)."""
    if os.getenv("BANKING_ALLOW_RESET", "true").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=403, detail="Reset disabled")
    reset_database()
    return {"status": "reset"}


@router.get("/demo-profiles")
def list_demo_profiles(
    repo: BankingRepository = Depends(get_banking_repo),
) -> list[dict[str, str]]:
    """Quick picker for frontend: who to impersonate in local dev."""
    profiles: list[dict[str, str]] = []
    for summary in repo.list_customers():
        hint = "No open issues — clean account"
        for acc in repo.list_accounts(summary.customer.id):
            if acc.issues:
                hint = acc.issues[0].customer_visible_hint
                break
        profiles.append(
            {
                "customer_id": summary.customer.id,
                "display_name": summary.customer.preferred_name,
                "scenario": summary.customer.full_legal_name,
                "open_issues": str(summary.open_issue_count),
                "hint": hint,
            }
        )
    return profiles


@router.get("/customers", response_model=list[CustomerSummary])
def list_customers(repo: BankingRepository = Depends(get_banking_repo)) -> list[CustomerSummary]:
    return repo.list_customers()


@router.get("/customers/{customer_id}", response_model=Customer)
def get_customer(
    customer_id: str, repo: BankingRepository = Depends(get_banking_repo)
) -> Customer:
    return repo.get_customer(customer_id)


@router.get("/accounts", response_model=list[BankAccount])
def list_accounts(
    customer_id: str | None = Query(default=None, description="Filter by customer"),
    repo: BankingRepository = Depends(get_banking_repo),
) -> list[BankAccount]:
    return repo.list_accounts(customer_id=customer_id)


@router.get("/accounts/{account_id}", response_model=AccountDetail)
def get_account(
    account_id: str, repo: BankingRepository = Depends(get_banking_repo)
) -> AccountDetail:
    return repo.get_account(account_id)


@router.get("/accounts/by-number/{account_number}", response_model=AccountDetail)
def get_account_by_number(
    account_number: str, repo: BankingRepository = Depends(get_banking_repo)
) -> AccountDetail:
    return repo.get_account_by_number(account_number)


@router.get("/accounts/{account_id}/issues", response_model=IssueSummary)
def get_account_issues(
    account_id: str, repo: BankingRepository = Depends(get_banking_repo)
) -> IssueSummary:
    detail = repo.get_account(account_id)
    return IssueSummary(
        account_id=detail.account.id,
        account_number_masked=mask_account_number(detail.account.account_number),
        issues=detail.account.issues,
    )


@router.get("/issues/open")
def list_open_issues(
    account_id: str | None = Query(default=None),
    repo: BankingRepository = Depends(get_banking_repo),
) -> list[dict[str, BankingIssue | str]]:
    rows = repo.list_open_issues(account_id=account_id)
    return [{"account_id": aid, "issue": issue} for aid, issue in rows]


@router.post("/accounts/{account_id}/issues/{issue_id}/resolve", response_model=BankingIssue)
def resolve_issue(
    account_id: str,
    issue_id: str,
    body: ResolveIssueRequest,
    repo: BankingRepository = Depends(get_banking_repo),
) -> BankingIssue:
    return repo.resolve_issue(
        account_id, issue_id, body.resolution_note, body.mark_resolved
    )


@router.post("/accounts/{account_id}/cards/block", response_model=BankAccount)
def block_card(
    account_id: str,
    body: BlockCardRequest,
    repo: BankingRepository = Depends(get_banking_repo),
) -> BankAccount:
    return repo.block_card(
        account_id=account_id,
        card_id=body.card_id,
        confirm_last_four=body.confirm_last_four,
        reason=body.reason,
    )
