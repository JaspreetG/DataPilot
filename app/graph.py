"""Graph workflow for SQL generation and execution.

Defines nodes to fetch the DB schema, generate SQL via the LLM, execute
queries against the database, and summarize results for the end user.
"""

import os
import logging
import time
from typing import TypedDict, List, Optional, Literal, Dict, Any
from langgraph.graph import StateGraph, END
from langchain_community.chat_models import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from tools import get_schema, run_query

# Configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("GraphLogic")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
MODEL_NAME = os.getenv("LLM_MODEL", "qwen2.5-coder:1.5b")
MAX_RETRIES = int(os.getenv("MAX_RETRIES", 3))
RETRY_DELAY_SECONDS = 2

# Graph state definition
class GraphState(TypedDict):
    question: str
    chat_history: List[str]
    schema: str
    sql_query: str
    result: str
    error: Optional[str]
    retry_count: int

# LLM client
llm = ChatOllama(
    model=MODEL_NAME,
    base_url=OLLAMA_BASE_URL,
    temperature=0,
    keep_alive="5m"
)

# Node implementations

def fetch_schema_node(state: GraphState) -> Dict[str, Any]:
    logger.info("--- [STEP 1] FETCHING SCHEMA ---")
    retries = 0
    while retries < MAX_RETRIES:
        try:
            schema = get_schema()
            if schema:
                return {"schema": schema, "retry_count": 0, "error": None}
            raise ValueError("Empty Schema")
        except Exception as e:
            retries += 1
            time.sleep(RETRY_DELAY_SECONDS)
    return {"schema": "", "error": "CRITICAL_DB_CONNECTION_ERROR"}

def generate_sql_node(state: GraphState) -> Dict[str, Any]:
    if state.get("error") == "CRITICAL_DB_CONNECTION_ERROR": return {"sql_query": "SKIP"}
    logger.info("--- [STEP 2] GENERATING SQL ---")
    
    # Build conversation context (most recent messages)
    history_context = "\n".join(state["chat_history"][-4:]) if state.get("chat_history") else "None"

    # Prompt tailored for a single-table schema
    system_instruction = f"""You are a PostgreSQL expert.
    
    [DATABASE SCHEMA]
    {state['schema']}
    
    [KEY RULES]
    1. **Single Table Strategy:** All data is in the 'employees' table.
    2. **No Joins:** Do not use JOIN. Do not look for 'departments' or 'projects' tables.
    3. **Columns:** - Use 'manager_name' to find managers (e.g. WHERE manager_name = 'Alice Wright').
       - Use 'location' for city/remote queries.
       - Use 'performance_score' (1-10) for performance.
    4. **Output:** Return ONLY raw SQL. No Markdown.
    """

    user_prompt = f"""
    [HISTORY]
    {history_context}
    
    [QUESTION]
    {state['question']}
    """

    if state.get("error") and state["retry_count"] > 0:
        user_prompt += f"\n\n[PREVIOUS ERROR] {state['error']}\nFix the SQL."

    response = llm.invoke([SystemMessage(content=system_instruction), HumanMessage(content=user_prompt)])
    sql = response.content.replace("```sql", "").replace("```", "").strip()
    return {"sql_query": sql}

def execute_sql_node(state: GraphState) -> Dict[str, Any]:
    if state.get("sql_query") == "SKIP": return {"error": state.get("error"), "retry_count": MAX_RETRIES}
    logger.info("--- [STEP 3] EXECUTING SQL ---")
    
    result = run_query(state['sql_query'])
    if isinstance(result, str) and result.strip().startswith("ERROR:"):
        return {"error": result, "retry_count": state["retry_count"] + 1}
    return {"result": str(result), "error": None}

def summarize_node(state: GraphState) -> Dict[str, Any]:
    if state.get("error") == "CRITICAL_DB_CONNECTION_ERROR": return {"result": "System Error: Database unreachable."}
    logger.info("--- [STEP 4] SUMMARIZING ---")
    
    result = state.get('result', '')
    if not result or result == "[]": return {"result": "No data found."}

    prompt = f"""
    User Query: "{state['question']}"
    SQL Result: {result}
    
    Task: Answer the user briefly based on the result.
    """
    response = llm.invoke([HumanMessage(content=prompt)])
    return {"result": response.content}

def should_continue(state: GraphState) -> Literal["retry", "success", "end"]:
    if state.get("error"):
        if state["error"] == "CRITICAL_DB_CONNECTION_ERROR": return "end"
        if state["retry_count"] < MAX_RETRIES: return "retry"
        return "end"
    return "success"

# Workflow assembly
workflow = StateGraph(GraphState)
workflow.add_node("get_schema", fetch_schema_node)
workflow.add_node("generate_sql", generate_sql_node)
workflow.add_node("execute_sql", execute_sql_node)
workflow.add_node("summarize", summarize_node)

workflow.set_entry_point("get_schema")
workflow.add_edge("get_schema", "generate_sql")
workflow.add_edge("generate_sql", "execute_sql")
workflow.add_conditional_edges("execute_sql", should_continue, {"retry": "generate_sql", "success": "summarize", "end": "summarize"})
workflow.add_edge("summarize", END)

app_graph = workflow.compile()