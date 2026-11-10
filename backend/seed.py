"""Create tables and seed the demo users.

Run from the backend directory:

    python seed.py
"""

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import User

USERS = [
    {"email": "alice@example.com", "name": "Alice", "password": "password"},
    {"email": "bob@example.com", "name": "Bob", "password": "password"},
    {"email": "charlie@example.com", "name": "Charlie", "password": "password"},
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for user_data in USERS:
            existing = db.scalar(select(User).where(User.email == user_data["email"]))
            if existing is None:
                db.add(User(**user_data))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Seeded users: alice@example.com, bob@example.com, charlie@example.com")
