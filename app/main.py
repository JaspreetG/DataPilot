import logging
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from graph import app_graph

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("API")

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store for running queries
JOBS: Dict[str, Dict[str, Any]] = {}

class ChatRequest(BaseModel):
    query: str
    session_id: str
    history: Optional[List[str]] = []

async def run_graph_background(job_id: str, inputs: dict):
    """
    Executes the LangGraph and updates the job status in real-time.
    """
    logger.info(f"Starting Job {job_id}")
    JOBS[job_id]["step"] = "initializing"

    # Initialize accumulator for node outputs (preserve SQL, results, errors)
    accumulated_data = {
        "sql_query": None,
        "result": None,
        "error": None
    }

    try:
        async for event in app_graph.astream(inputs):
            for node_name, state_update in event.items():
                logger.info(f"Job {job_id} reached step: {node_name}")
                JOBS[job_id]["step"] = node_name
                
                # Merge node updates into accumulator
                if isinstance(state_update, dict):
                    if "sql_query" in state_update:
                        accumulated_data["sql_query"] = state_update["sql_query"]
                    if "result" in state_update:
                        accumulated_data["result"] = state_update["result"]
                    if "error" in state_update and state_update["error"]:
                        accumulated_data["error"] = state_update["error"]

        # Job Done
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["data"] = {
            "response": accumulated_data["result"],  # Final summary
            "sql_used": accumulated_data["sql_query"] # Preserved SQL
        }
        
        # Handle failures
        if accumulated_data.get("error") and "CRITICAL" in accumulated_data["error"]:
             JOBS[job_id]["status"] = "failed"
             JOBS[job_id]["error"] = accumulated_data["error"]

    except Exception as e:
        logger.error(f"Job {job_id} crashed: {e}")
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)

@app.post("/query")
async def start_query(req: ChatRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "status": "processing", 
        "step": "queued",
        "data": None
    }
    
    inputs = {
        "question": req.query,
        "chat_history": req.history,
        "retry_count": 0,
        "schema": "",
        "sql_query": "",
        "result": "",
        "error": None,
        "intent": ""
    }
    
    background_tasks.add_task(run_graph_background, job_id, inputs)
    return {"job_id": job_id}

@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job