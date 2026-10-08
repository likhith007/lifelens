from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class CustomerRow(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    full_legal_name: Mapped[str] = mapped_column(String(200))
    preferred_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(32))
    date_of_birth: Mapped[date] = mapped_column(Date)
    customer_since: Mapped[date] = mapped_column(Date)
    address_line1: Mapped[str] = mapped_column(String(200))
    address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_city: Mapped[str] = mapped_column(String(100))
    address_state: Mapped[str] = mapped_column(String(64))
    address_postal_code: Mapped[str] = mapped_column(String(20))
    address_country: Mapped[str] = mapped_column(String(8), default="IN")
    address_name_on_mail: Mapped[str | None] = mapped_column(String(200), nullable=True)

    accounts: Mapped[list["AccountRow"]] = relationship(back_populates="customer")


class AccountRow(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"))
    account_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32))
    currency: Mapped[str] = mapped_column(String(8), default="INR")
    available_balance: Mapped[float] = mapped_column(Float)
    ledger_balance: Mapped[float] = mapped_column(Float)
    branch_code: Mapped[str] = mapped_column(String(32))

    customer: Mapped[CustomerRow] = relationship(back_populates="accounts")
    cards: Mapped[list["CardRow"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    issues: Mapped[list["IssueRow"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class CardRow(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    last_four: Mapped[str] = mapped_column(String(4))
    network: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32))
    expiry_month: Mapped[int] = mapped_column()
    expiry_year: Mapped[int] = mapped_column()
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)

    account: Mapped[AccountRow] = relationship(back_populates="cards")


class IssueRow(Base):
    __tablename__ = "issues"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    customer_visible_hint: Mapped[str] = mapped_column(Text, default="")
    suggested_intents: Mapped[list] = mapped_column(JSONB, default=list)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped[AccountRow] = relationship(back_populates="issues")
