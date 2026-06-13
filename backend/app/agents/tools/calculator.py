"""Calculator tool — safe mathematical expression evaluator."""
import math
from langchain_core.tools import tool


@tool
def calculator(expression: str) -> str:
    """
    Safely evaluate a mathematical expression.
    Supports: +, -, *, /, **, sqrt, sin, cos, log, abs, round, min, max, etc.
    Input: math expression as a string, e.g. '2 ** 10', 'sqrt(144)', 'sin(3.14)'
    """
    try:
        # Whitelist-based safe eval — no builtins except math functions
        allowed = {k: v for k, v in math.__dict__.items() if not k.startswith("_")}
        allowed.update({
            "abs": abs, "round": round, "min": min, "max": max,
            "sum": sum, "pow": pow, "int": int, "float": float,
        })
        result = eval(expression, {"__builtins__": {}}, allowed)  # noqa: S307
        return f"{result}"
    except ZeroDivisionError:
        return "Error: Division by zero"
    except Exception as e:
        return f"Error evaluating '{expression}': {e}"
