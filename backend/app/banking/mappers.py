from app.banking.models import (
    AccountStatus,
    AccountType,
    Address,
    BankAccount,
    BankingIssue,
    Card,
    CardStatus,
    Customer,
    IssueCategory,
    IssueSeverity,
    IssueStatus,
)
from app.banking.orm import AccountRow, CardRow, CustomerRow, IssueRow


def customer_from_row(row: CustomerRow) -> Customer:
    return Customer(
        id=row.id,
        full_legal_name=row.full_legal_name,
        preferred_name=row.preferred_name,
        email=row.email,
        phone=row.phone,
        date_of_birth=row.date_of_birth,
        customer_since=row.customer_since,
        address=Address(
            line1=row.address_line1,
            line2=row.address_line2,
            city=row.address_city,
            state=row.address_state,
            postal_code=row.address_postal_code,
            country=row.address_country,
            name_on_mail=row.address_name_on_mail,
        ),
    )


def card_from_row(row: CardRow) -> Card:
    return Card(
        id=row.id,
        last_four=row.last_four,
        network=row.network,
        status=CardStatus(row.status),
        expiry_month=row.expiry_month,
        expiry_year=row.expiry_year,
        is_primary=row.is_primary,
    )


def issue_from_row(row: IssueRow) -> BankingIssue:
    return BankingIssue(
        id=row.id,
        category=IssueCategory(row.category),
        severity=IssueSeverity(row.severity),
        status=IssueStatus(row.status),
        title=row.title,
        description=row.description,
        customer_visible_hint=row.customer_visible_hint,
        suggested_intents=list(row.suggested_intents or []),
        opened_at=row.opened_at,
        metadata=dict(row.metadata_json or {}),
    )


def account_from_row(row: AccountRow, include_issues: bool = True) -> BankAccount:
    cards = [card_from_row(c) for c in sorted(row.cards, key=lambda c: c.id)]
    issues = (
        [issue_from_row(i) for i in sorted(row.issues, key=lambda i: i.opened_at)]
        if include_issues
        else []
    )
    return BankAccount(
        id=row.id,
        account_number=row.account_number,
        customer_id=row.customer_id,
        account_type=AccountType(row.account_type),
        status=AccountStatus(row.status),
        currency=row.currency,
        available_balance=row.available_balance,
        ledger_balance=row.ledger_balance,
        branch_code=row.branch_code,
        cards=cards,
        issues=issues,
    )
