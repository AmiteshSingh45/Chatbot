"""
Code Assistant Agent — specialized for all programming tasks.
Uses deepseek-r1 reasoning model for complex problems when available.
"""
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

CODE_SYSTEM = """You are an expert software engineer and AI/ML specialist.
You excel at:
- Writing clean, efficient, well-documented code in any language
- Debugging errors with precise root cause analysis
- Code review and architectural guidance
- Algorithm design, complexity analysis (Big O)
- LangChain, LangGraph, FastAPI, Next.js, React, Python, TypeScript
- ML/AI: PyTorch, TensorFlow, scikit-learn, transformers, FAISS, ChromaDB

Output rules:
- ALWAYS use proper markdown code blocks with language tags (```python, ```typescript)
- Add clear inline comments for non-obvious logic
- Mention time/space complexity for algorithms
- Suggest unit tests for functions you write
- Point out edge cases and potential bugs
- Prefer readable, maintainable code over clever one-liners

{memory_section}
{reflection_section}"""


async def code_assistant_node(state: AgentState) -> dict[str, Any]:
    """
    Code assistant — handles all programming-related requests.
    Detects complexity to choose between fast/deep model.
    """
    t0 = time.time()
    messages = state["messages"]

    # Detect if this is a complex reasoning problem → use reasoning model
    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    query = latest_human.content if latest_human else ""
    if not isinstance(query, str):
        query = str(query)

    complexity_keywords = {"algorithm", "optimize", "complexity", "architecture", "design", "implement"}
    is_complex = any(kw in query.lower() for kw in complexity_keywords) and len(query) > 100

    # Build system prompt
    memory = state.get("memory_context", "")
    mem_section = f"\nKnown about user:\n{memory}" if memory else ""
    feedback = state.get("reflection_feedback", "")
    refl_section = (
        f"\n**Improvement needed:** {feedback}"
        if feedback and state.get("retry_count", 0) > 0 else ""
    )

    model = (
        settings.GROQ_MODEL_REASONING
        if is_complex
        else settings.GROQ_MODEL
    )

    llm = ChatGroq(
        model=model,
        api_key=settings.GROQ_API_KEY,
        temperature=0.1,
        max_tokens=settings.GROQ_MAX_TOKENS,
        streaming=True,
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=CODE_SYSTEM.format(
                memory_section=mem_section,
                reflection_section=refl_section,
            )),
            *messages,
        ])

        duration_ms = (time.time() - t0) * 1000
        logger.info(
            "agent.code_assistant.response",
            model=model,
            is_complex=is_complex,
            thread_id=state.get("thread_id"),
            duration_ms=round(duration_ms, 1),
        )

        step: AgentStep = {
            "step": "code_assistant",
            "label": "Writing code...",
            "status": "done",
            "detail": f"{'Reasoning' if is_complex else 'Fast'} model ({model.split('-')[0]})",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)

        return {
            **state,
            "messages": [response],
            "final_response": response.content,
            "error": None,
            "agent_steps": existing_steps,
            "metadata": {
                **(state.get("metadata") or {}),
                "agent_used": "code_assistant",
                "model_used": model,
                "complexity": "high" if is_complex else "standard",
            },
        }

    except Exception as e:
        logger.error("agent.code_assistant.error", error=str(e))
        return {**state, "error": str(e), "retry_count": state.get("retry_count", 0) + 1}
