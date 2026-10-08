from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.banking.mappers import account_from_row, customer_from_row, issue_from_row
from app.banking.models import (
    AccountDetail,
    AccountStatus,
    BankAccount,
    BankingIssue,
    CardStatus,
    Customer,
    CustomerSummary,
    IssueCategory,
    IssueSeverity,
    IssueStatus,
)
from app.banking.orm import AccountRow, CardRow, CustomerRow, IssueRow


def mask_account_number(account_number: str) -> str:
    if len(account_number) <= 4:
        return "****"
    return f"{'*' * (len(account_number) - 4)}{account_number[-4:]}"


class BankingRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _account_query(self):
        return select(AccountRow).options(
            selectinload(AccountRow.cards),
            selectinload(AccountRow.issues),
        )

    def list_customers(self) -> list[CustomerSummary]:
        customers = self._session.scalars(
            select(CustomerRow).order_by(CustomerRow.preferred_name)
        ).all()
        summaries: list[CustomerSummary] = []
        for customer in customers:
            accounts = self._session.scalars(
                select(AccountRow).where(AccountRow.customer_id == customer.id)
            ).all()
            account_ids = [a.id for a in accounts]
            open_issues = 0
            if account_ids:
                open_issues = (
                    self._session.scalar(
                        select(func.count())
                        .select_from(IssueRow)
                        .where(
                            IssueRow.account_id.in_(account_ids),
                            IssueRow.status != IssueStatus.RESOLVED.value,
                        )
                    )
                    or 0
                )
            summaries.append(
                CustomerSummary(
                    customer=customer_from_row(customer),
                    account_ids=account_ids,
                    open_issue_count=open_issues,
                )
            )
        return summaries

    def get_customer(self, customer_id: str) -> Customer:
        row = self._session.get(CustomerRow, customer_id)
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer_from_row(row)

    def list_accounts(self, customer_id: str | None = None) -> list[BankAccount]:
        stmt = self._account_query().order_by(AccountRow.account_number)
        if customer_id:
            stmt = stmt.where(AccountRow.customer_id == customer_id)
        rows = self._session.scalars(stmt).all()
        return [account_from_row(r) for r in rows]

    def get_account(self, account_id: str) -> AccountDetail:
        row = self._session.scalar(
            self._account_query().where(AccountRow.id == account_id)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Account not found")
        customer = self.get_customer(row.customer_id)
        return AccountDetail(account=account_from_row(row), customer=customer)

    def get_account_by_number(self, account_number: str) -> AccountDetail:
        row = self._session.scalar(
            self._account_query().where(AccountRow.account_number == account_number)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Account not found")
        return self.get_account(row.id)

    def list_open_issues(self, account_id: str | None = None) -> list[tuple[str, BankingIssue]]:
        stmt = select(IssueRow).where(IssueRow.status != IssueStatus.RESOLVED.value)
        if account_id:
            stmt = stmt.where(IssueRow.account_id == account_id)
        rows = self._session.scalars(stmt.order_by(IssueRow.opened_at)).all()
        return [(row.account_id, issue_from_row(row)) for row in rows]

    def get_issue(self, account_id: str, issue_id: str) -> IssueRow:
        row = self._session.scalar(
            select(IssueRow).where(
                IssueRow.account_id == account_id,
                IssueRow.id == issue_id,
            )
        )
        if not row:
            raise HTTPException(status_code=404, detail="Issue not found")
        return row

    def resolve_issue(
        self, account_id: str, issue_id: str, resolution_note: str, mark_resolved: bool
    ) -> BankingIssue:
        row = self.get_issue(account_id, issue_id)
        meta = dict(row.metadata_json or {})
        meta["resolution_note"] = resolution_note
        row.metadata_json = meta
        row.status = (
            IssueStatus.RESOLVED.value
            if mark_resolved
            else IssueStatus.IN_PROGRESS.value
        )
        self._session.commit()
        self._session.refresh(row)
        return issue_from_row(row)

    def block_card(
        self,
        account_id: str,
        card_id: str,
        confirm_last_four: str,
        reason: str,
    ) -> BankAccount:
        account = self._session.scalar(
            self._account_query().where(AccountRow.id == account_id)
        )
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        if account.status == AccountStatus.FROZEN.value:
            raise HTTPException(
                status_code=409,
                detail="Account is frozen; card block may require agent review",
            )
        card = next((c for c in account.cards if c.id == card_id), None)
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        if card.last_four != confirm_last_four:
            raise HTTPException(status_code=400, detail="Last four digits do not match")
        if card.status == CardStatus.BLOCKED.value:
            raise HTTPException(status_code=409, detail="Card is already blocked")
        card.status = CardStatus.BLOCKED.value
        self._session.add(
            IssueRow(
                id=f"iss_block_{card_id}",
                account_id=account_id,
                category=IssueCategory.CARD.value,
                severity=IssueSeverity.LOW.value,
                status=IssueStatus.RESOLVED.value,
                title="Card blocked per customer request",
                description=f"Card ending {card.last_four} blocked. Reason: {reason}.",
                customer_visible_hint="",
                suggested_intents=[],
                opened_at=datetime.now(timezone.utc),
                metadata_json={"reason": reason, "card_id": card_id},
            )
        )
        self._session.commit()
        self._session.refresh(account)
        refreshed = self._session.scalar(
            self._account_query().where(AccountRow.id == account_id)
        )
        assert refreshed is not None
        return account_from_row(refreshed)
