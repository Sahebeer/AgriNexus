from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

import logging
logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL

# Check if PostgreSQL driver is available; fallback to SQLite for local dev
try:
    if "postgresql" in db_url:
        import psycopg2
except ImportError:
    logger.warning("psycopg2 not available. Falling back to local SQLite database for development.")
    db_url = "sqlite:///./agrinexus_dev.db"

if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()
