import os
import time

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.banking.orm import Base, CustomerRow
from app.banking.seed import seed_banking_data

DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://banking:banking@localhost:5432/banking"
)


def get_database_url() -> str:
    return os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL).strip()


engine = create_engine(
    get_database_url(),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def wait_for_database(max_attempts: int = 30, delay_seconds: float = 1.0) -> None:
    last_error: Exception | None = None
    for _ in range(max_attempts):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as exc:  # noqa: BLE001 — startup retry loop
            last_error = exc
            time.sleep(delay_seconds)
    raise RuntimeError(f"Database not reachable: {last_error}")


def init_database() -> None:
    wait_for_database()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        count = session.scalar(select(func.count()).select_from(CustomerRow)) or 0
        if count == 0:
            seed_banking_data(session)
            session.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def reset_database() -> None:
    from app.banking.orm import AccountRow, CardRow, IssueRow

    with SessionLocal() as session:
        session.query(IssueRow).delete()
        session.query(CardRow).delete()
        session.query(AccountRow).delete()
        session.query(CustomerRow).delete()
        session.commit()
        seed_banking_data(session)
        session.commit()
