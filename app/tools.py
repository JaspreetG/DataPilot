import os
import logging
from langchain_community.utilities import SQLDatabase
from sqlalchemy import create_engine, text

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SQLTools")

# Configuration: database connection URL (fallback for local development)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    logger.warning("DATABASE_URL not found, using default local connection.")
    DATABASE_URL = "postgresql://admin:password@db:5432/company_db"

# Database engine with basic connection pooling settings
engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
)

db = SQLDatabase(engine)

def get_schema():
    """Returns the database schema for the LLM to understand."""
    try:
        return db.get_table_info()
    except Exception as e:
        logger.error(f"Failed to fetch schema: {e}")
        return ""

def _is_safe_query(query: str) -> bool:
    """Return True if the query appears read-only and safe to execute.

    This performs a simple keyword-based check to block data-modifying
    statements. It is intentional, lightweight protection for this demo.
    """
    forbidden_keywords = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE", "GRANT", "REVOKE"]
    upper_query = query.upper()

    for keyword in forbidden_keywords:
        # Match as a standalone token or at the start of the statement
        if f" {keyword} " in f" {upper_query} " or upper_query.startswith(keyword):
            return False
    return True

def run_query(query: str):
    """Executes a cleaned, safe SQL query."""
    try:
        # Remove Markdown fences and whitespace
        clean_query = query.replace("```sql", "").replace("```", "").strip()

        # Prevent statement chaining; only execute the first statement
        if ";" in clean_query:
            clean_query = clean_query.split(";")[0]

        # Block non-read-only statements
        if not _is_safe_query(clean_query):
            logger.warning(f"Blocked dangerous query: {clean_query}")
            return "ERROR: Read-only policy: data-modifying statements are not permitted."

        # Execute the sanitized query
        logger.info(f"Executing SQL: {clean_query}")
        result = db.run(clean_query)
        return result

    except Exception as e:
        logger.error(f"SQL Execution Error: {str(e)}")
        return f"ERROR: Database returned: {str(e)}"