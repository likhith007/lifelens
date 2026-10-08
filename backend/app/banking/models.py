from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class AccountType(str, Enum):
    CHECKING = "checking"
    SAVINGS = "savings"


class AccountStatus(str, Enum):
    ACTIVE = "active"
    RESTRICTED = "restricted"
    FROZEN = "frozen"


class CardStatus(str, Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"
    LOST_REPORTED = "lost_reported"
    EXPIRED = "expired"


class IssueSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IssueStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class IssueCategory(str, Enum):
    CARD = "card"
    ADDRESS = "address"
    IDENTITY = "identity"
    TRANSACTION = "transaction"
    KYC = "kyc"
    SERVICE = "service"


class Address(BaseModel):
    line1: str
    line2: str | None = None
    city: str
    state: str
    postal_code: str
    country: str = "IN"
    name_on_mail: str | None = None


class Card(BaseModel):
    id: str
    last_four: str = Field(pattern=r"^\d{4}$")
    network: Literal["visa", "mastercard", "rupay"] = "visa"
    status: CardStatus
    expiry_month: int = Field(ge=1, le=12)
    expiry_year: int = Field(ge=2020, le=2040)
    is_primary: bool = True


class BankingIssue(BaseModel):
    id: str
    category: IssueCategory
    severity: IssueSeverity
    status: IssueStatus
    title: str
    description: str
    customer_visible_hint: str
    suggested_intents: list[str] = Field(default_factory=list)
    opened_at: datetime
    metadata: dict[str, str | int | bool | None] = Field(default_factory=dict)


class Customer(BaseModel):
    id: str
    full_legal_name: str
    preferred_name: str
    email: str
    phone: str
    date_of_birth: date
    address: Address
    customer_since: date


class BankAccount(BaseModel):
    id: str
    account_number: str
    customer_id: str
    account_type: AccountType
    status: AccountStatus
    currency: str = "INR"
    available_balance: float
    ledger_balance: float
    branch_code: str
    cards: list[Card] = Field(default_factory=list)
    issues: list[BankingIssue] = Field(default_factory=list)


class CustomerSummary(BaseModel):
    customer: Customer
    account_ids: list[str]
    open_issue_count: int


class AccountDetail(BaseModel):
    account: BankAccount
    customer: Customer


class IssueSummary(BaseModel):
    account_id: str
    account_number_masked: str
    issues: list[BankingIssue]


class ResolveIssueRequest(BaseModel):
    resolution_note: str = Field(min_length=1, max_length=2000)
    mark_resolved: bool = True


class BlockCardRequest(BaseModel):
    card_id: str
    reason: Literal["lost", "stolen", "compromised", "customer_request"] = "customer_request"
    confirm_last_four: str = Field(pattern=r"^\d{4}$")
