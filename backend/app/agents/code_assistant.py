"""
Code Assistant Agent — specialized for programming tasks.
Uses a code-optimized system prompt with syntax highlighting hints.
"""
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState

logger = get_logger(__name__)

CODE_SYSTEM_PROMPT = """You are an expert software engineer and programming assistant.
You excel at:
- Writing clean, efficient, well-documented code in any language
- Debugging and explaining errors with precise root cause analysis
- Code review and best practices
- Algorithm design and complexity analysis
- System design and architecture

Output format rules:
- ALWAYS wrap code in proper markdown code blocks with language tags: ```python, ```typescript, etc.
- Explain your code with inline comments for non-obvious parts
- Mention time/space complexity when relevant
- Suggest tests when writing functions
- Point out potential edge cases
- Prefer readable code over clever one-liners"""


def build_code_chain():
    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.2,  # Lower temp for deterministic code
        max_tokens=settings.GROQ_MAX_TOKENS,
        streaming=True,
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", CODE_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="messages"),
    ])
    return prompt | llm


_code_chain = None


def get_code_chain():
    global _code_chain
    if _code_chain is None:
        _code_chain = build_code_chain()
    return _code_chain


async def code_assistant_node(state: AgentState) -> AgentState:
    """Code assistant — handles all programming-related requests."""
    try:
        chain = get_code_chain()
        response = await chain.ainvoke({"messages": state["messages"]})

        logger.info("agent.code_assistant.response", thread_id=state.get("thread_id"))

        return {
            **state,
            "messages": [response],
            "final_response": response.content,
            "error": None,
            "metadata": {**(state.get("metadata") or {}), "agent_used": "code_assistant"},
        }

    except Exception as e:
        logger.error("agent.code_assistant.error", error=str(e))
        return {**state, "error": str(e), "route": "general"}
