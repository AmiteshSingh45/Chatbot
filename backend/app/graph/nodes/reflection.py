"""
Reflection Node — self-evaluation of response quality.
After the main agent generates a response, this node evaluates it for:
- Factual accuracy (did it hallucinate?)
- Completeness (did it address all aspects?)
- Relevance (did it answer what was asked?)
- Quality (is it well-formatted and clear?)

If score < threshold AND retry_count < max_retries, the graph routes back
to re-run the appropriate agent with feedback.

This demonstrates the "critic-actor" pattern in LLM agent design.
"""
import json
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

REFLECTION_SYSTEM = """You are a quality evaluation expert for AI responses.
Score the following AI response on these criteria (each 0.0-1.0):
1. relevance: Does it directly answer what was asked?
2. accuracy: Is the information factually sound (no obvious hallucinations)?
3. completeness: Does it address all aspects of the question?
4. quality: Is it well-structured and clear?

Respond ONLY with a valid JSON object:
{{
  "relevance": 0.0-1.0,
  "accuracy": 0.0-1.0,
  "completeness": 0.0-1.0,
  "quality": 0.0-1.0,
  "overall": 0.0-1.0,
  "feedback": "One sentence on what could be improved, or 'Looks good' if excellent"
}}"""


async def reflection_node(state: AgentState) -> dict[str, Any]:
    """
    Self-evaluation node. Uses fast model to score the current response.
    Routes back to agent if score is below threshold (and retries remain).
    """
    t0 = time.time()

    # Skip if already reflected or too many retries
    if state.get("reflection_done") or state.get("retry_count", 0) >= settings.REFLECTION_MAX_RETRIES:
        duration_ms = (time.time() - t0) * 1000
        step: AgentStep = {
            "step": "reflection",
            "label": "Reflection skipped",
            "status": "done",
            "detail": "Max retries or already reflected",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)
        return {**state, "reflection_done": True, "agent_steps": existing_steps}

    final_response = state.get("final_response", "")
    messages = state.get("messages", [])
    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    user_query = latest_human.content if latest_human else ""
    if not isinstance(user_query, str):
        user_query = str(user_query)

    # Default: pass with good score if no response to evaluate
    if not final_response or not user_query:
        score = 0.8
        feedback = "No response to evaluate"
    else:
        score = 0.8
        feedback = "Looks good"

        try:
            llm = ChatGroq(
                model=settings.GROQ_MODEL_FAST,  # Fast model for reflection
                api_key=settings.GROQ_API_KEY,
                temperature=0.0,
                max_tokens=200,
            )

            eval_prompt = (
                f"User asked: {user_query[:300]}\n\n"
                f"AI responded: {final_response[:500]}"
            )

            response = await llm.ainvoke([
                SystemMessage(content=REFLECTION_SYSTEM),
                HumanMessage(content=eval_prompt),
            ])

            content = response.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            eval_data = json.loads(content)
            score = float(eval_data.get("overall", 0.8))
            feedback = eval_data.get("feedback", "Looks good")

            logger.info(
                "reflection.evaluated",
                score=score,
                feedback=feedback[:100],
                thread_id=state.get("thread_id"),
                route=state.get("route"),
            )

        except Exception as e:
            logger.warning("reflection.error", error=str(e))
            score = 0.8  # Default pass on error

    duration_ms = (time.time() - t0) * 1000
    step: AgentStep = {
        "step": "reflection",
        "label": "Reflecting on quality...",
        "status": "done",
        "detail": f"Score: {score:.2f} | {feedback[:60]}",
        "duration_ms": round(duration_ms, 1),
    }
    existing_steps = list(state.get("agent_steps") or [])
    existing_steps.append(step)

    return {
        **state,
        "reflection_score": score,
        "reflection_feedback": feedback,
        "reflection_done": True,
        "agent_steps": existing_steps,
    }


def reflection_route(state: AgentState) -> str:
    """
    LangGraph conditional edge: retry agent if quality is poor, else continue.
    """
    score = state.get("reflection_score", 0.8)
    retry_count = state.get("retry_count", 0)
    done = state.get("reflection_done", True)

    if (
        score < settings.REFLECTION_SCORE_THRESHOLD
        and retry_count < settings.REFLECTION_MAX_RETRIES
        and not done
    ):
        logger.info(
            "reflection.retry",
            score=score,
            retry_count=retry_count,
            route=state.get("route"),
        )
        return "retry"

    return "memory_update"
