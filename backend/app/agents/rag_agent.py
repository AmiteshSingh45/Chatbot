"""
RAG Agent — retrieves relevant document chunks from local FAISS indexes.
No external vector DB required. Per-file FAISS indexes stored on disk.
"""
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

RAG_SYSTEM = """You are a document analysis assistant. Answer questions using ONLY the provided document context.

Rules:
- Base your answer strictly on the retrieved context below
- Use [Doc N, Page X] citation format when referencing specific parts
- If context is insufficient, say: "The uploaded documents don't contain enough information about this."
- Format your response in clear markdown with headers where appropriate
- List citations at the end under a ## Sources section

{memory_section}"""


async def rag_agent_node(state: AgentState) -> dict[str, Any]:
    """RAG agent — retrieves from local FAISS indexes and generates cited answers."""
    t0 = time.time()
    messages = state["messages"]
    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    if not latest_human:
        return {**state, "route": "general"}

    query = latest_human.content if isinstance(latest_human.content, str) else str(latest_human.content)
    file_ids = state.get("uploaded_file_ids") or []
    user_id = state.get("user_id", "")

    try:
        from app.services.rag_service import get_rag_service
        rag_service = get_rag_service()

        chunks, citations = await rag_service.retrieve(
            query=query,
            user_id=user_id,
            file_ids=file_ids,
            top_k=5,
        )

        if not chunks:
            logger.info("rag_agent.no_context", thread_id=state.get("thread_id"))
            # Fall back to general chat
            return {**state, "route": "general"}

        context = "\n\n---\n\n".join([
            f"[Doc {i+1}] {chunk}" for i, chunk in enumerate(chunks)
        ])

        memory = state.get("memory_context", "")
        mem_section = f"\nUser context:\n{memory}" if memory else ""

        llm = ChatGroq(
            model=settings.GROQ_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0.2,
            max_tokens=settings.GROQ_MAX_TOKENS,
        )

        response = await llm.ainvoke([
            SystemMessage(content=RAG_SYSTEM.format(memory_section=mem_section)),
            *messages,
            SystemMessage(content=f"RETRIEVED DOCUMENT CONTEXT:\n{context}"),
        ])

        duration_ms = (time.time() - t0) * 1000
        logger.info(
            "rag_agent.response",
            chunks=len(chunks),
            duration_ms=round(duration_ms, 1),
        )

        step: AgentStep = {
            "step": "rag_agent",
            "label": "Reading documents...",
            "status": "done",
            "detail": f"{len(chunks)} chunks retrieved, {len(citations)} citations",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)

        return {
            **state,
            "messages": [response],
            "final_response": response.content,
            "context": context,
            "retrieved_docs": chunks,
            "citations": citations,
            "error": None,
            "agent_steps": existing_steps,
            "metadata": {
                **(state.get("metadata") or {}),
                "agent_used": "rag_agent",
                "chunks_retrieved": len(chunks),
            },
        }

    except Exception as e:
        logger.error("rag_agent.error", error=str(e))
        return {**state, "route": "general", "error": str(e)}
