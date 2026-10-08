from sqlalchemy.orm import Session

from app.banking.orm import AccountRow, CardRow, CustomerRow, IssueRow
from app.banking.seed_data import ACCOUNTS, CUSTOMERS


def seed_banking_data(session: Session) -> None:
    for customer in CUSTOMERS:
        addr = customer.address
        session.add(
            CustomerRow(
                id=customer.id,
                full_legal_name=customer.full_legal_name,
                preferred_name=customer.preferred_name,
                email=customer.email,
                phone=customer.phone,
                date_of_birth=customer.date_of_birth,
                customer_since=customer.customer_since,
                address_line1=addr.line1,
                address_line2=addr.line2,
                address_city=addr.city,
                address_state=addr.state,
                address_postal_code=addr.postal_code,
                address_country=addr.country,
                address_name_on_mail=addr.name_on_mail,
            )
        )

    for account in ACCOUNTS:
        session.add(
            AccountRow(
                id=account.id,
                account_number=account.account_number,
                customer_id=account.customer_id,
                account_type=account.account_type.value,
                status=account.status.value,
                currency=account.currency,
                available_balance=account.available_balance,
                ledger_balance=account.ledger_balance,
                branch_code=account.branch_code,
            )
        )
        for card in account.cards:
            session.add(
                CardRow(
                    id=card.id,
                    account_id=account.id,
                    last_four=card.last_four,
                    network=card.network,
                    status=card.status.value,
                    expiry_month=card.expiry_month,
                    expiry_year=card.expiry_year,
                    is_primary=card.is_primary,
                )
            )
        for issue in account.issues:
            session.add(
                IssueRow(
                    id=issue.id,
                    account_id=account.id,
                    category=issue.category.value,
                    severity=issue.severity.value,
                    status=issue.status.value,
                    title=issue.title,
                    description=issue.description,
                    customer_visible_hint=issue.customer_visible_hint,
                    suggested_intents=issue.suggested_intents,
                    opened_at=issue.opened_at,
                    metadata_json=issue.metadata,
                )
            )

    session.flush()
