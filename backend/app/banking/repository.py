from __future__ import annotations

from copy import deepcopy

from fastapi import HTTPException

from app.banking.models import (
    AccountDetail,
    AccountStatus,
    BankAccount,
    BankingIssue,
    CardStatus,
    Customer,
    CustomerSummary,
    IssueStatus,
)
from app.banking.seed_data import ACCOUNTS, CUSTOMERS


def mask_account_number(account_number: str) -> str:
    if len(account_number) <= 4:
        return "****"
    return f"{'*' * (len(account_number) - 4)}{account_number[-4:]}"


class BankingRepository:
    """In-memory banking store seeded with demo accounts and known issues."""

    def __init__(self) -> None:
        self._customers: dict[str, Customer] = {c.id: deepcopy(c) for c in CUSTOMERS}
        self._accounts: dict[str, BankAccount] = {a.id: deepcopy(a) for a in ACCOUNTS}

    def reset(self) -> None:
        self.__init__()

    def list_customers(self) -> list[CustomerSummary]:
        summaries: list[CustomerSummary] = []
        for customer in self._customers.values():
            account_ids = [
                a.id for a in self._accounts.values() if a.customer_id == customer.id
            ]
            open_issues = sum(
                1
                for aid in account_ids
                for issue in self._accounts[aid].issues
                if issue.status != IssueStatus.RESOLVED
            )
            summaries.append(
                CustomerSummary(
                    customer=customer,
                    account_ids=account_ids,
                    open_issue_count=open_issues,
                )
            )
        return sorted(summaries, key=lambda s: s.customer.preferred_name)

    def get_customer(self, customer_id: str) -> Customer:
        customer = self._customers.get(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer

    def list_accounts(self, customer_id: str | None = None) -> list[BankAccount]:
        accounts = list(self._accounts.values())
        if customer_id:
            accounts = [a for a in accounts if a.customer_id == customer_id]
        return sorted(accounts, key=lambda a: a.account_number)

    def get_account(self, account_id: str) -> AccountDetail:
        account = self._accounts.get(account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        customer = self.get_customer(account.customer_id)
        return AccountDetail(account=account, customer=customer)

    def get_account_by_number(self, account_number: str) -> AccountDetail:
        for account in self._accounts.values():
            if account.account_number == account_number:
                return self.get_account(account.id)
        raise HTTPException(status_code=404, detail="Account not found")

    def list_open_issues(self, account_id: str | None = None) -> list[tuple[str, BankingIssue]]:
        rows: list[tuple[str, BankingIssue]] = []
        for account in self._accounts.values():
            if account_id and account.id != account_id:
                continue
            for issue in account.issues:
                if issue.status != IssueStatus.RESOLVED:
                    rows.append((account.id, issue))
        return rows

    def get_issue(self, account_id: str, issue_id: str) -> BankingIssue:
        account = self._accounts.get(account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        for issue in account.issues:
            if issue.id == issue_id:
                return issue
        raise HTTPException(status_code=404, detail="Issue not found")

    def resolve_issue(
        self, account_id: str, issue_id: str, resolution_note: str, mark_resolved: bool
    ) -> BankingIssue:
        issue = self.get_issue(account_id, issue_id)
        issue.metadata["resolution_note"] = resolution_note
        if mark_resolved:
            issue.status = IssueStatus.RESOLVED
        else:
            issue.status = IssueStatus.IN_PROGRESS
        return issue

    def block_card(
        self,
        account_id: str,
        card_id: str,
        confirm_last_four: str,
        reason: str,
    ) -> BankAccount:
        account = self._accounts.get(account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        if account.status == AccountStatus.FROZEN:
            raise HTTPException(
                status_code=409,
                detail="Account is frozen; card block may require agent review",
            )
        card = next((c for c in account.cards if c.id == card_id), None)
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        if card.last_four != confirm_last_four:
            raise HTTPException(status_code=400, detail="Last four digits do not match")
        if card.status == CardStatus.BLOCKED:
            raise HTTPException(status_code=409, detail="Card is already blocked")
        card.status = CardStatus.BLOCKED
        from datetime import datetime, timezone

        from app.banking.models import IssueCategory, IssueSeverity

        account.issues.append(
            BankingIssue(
                id=f"iss_block_{card_id}",
                category=IssueCategory.CARD,
                severity=IssueSeverity.LOW,
                status=IssueStatus.RESOLVED,
                title="Card blocked per customer request",
                description=f"Card ending {card.last_four} blocked. Reason: {reason}.",
                customer_visible_hint="",
                suggested_intents=[],
                opened_at=datetime.now(timezone.utc),
                metadata={"reason": reason, "card_id": card_id},
            )
        )
        return account


# Singleton for local dev (agents will mutate state during demos)
banking_repo = BankingRepository()
