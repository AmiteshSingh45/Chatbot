"""
Centralized exception hierarchy.
All domain exceptions map to specific HTTP status codes for clean API responses.
"""
from fastapi import HTTPException, status


class NexusAIException(Exception):
    """Base exception for all NexusAI errors."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


# --- Auth Exceptions ---
class AuthenticationError(NexusAIException):
    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(message, "AUTH_ERROR")


class TokenExpiredError(AuthenticationError):
    def __init__(self) -> None:
        super().__init__("Token has expired")


class InvalidTokenError(AuthenticationError):
    def __init__(self) -> None:
        super().__init__("Invalid token")


class PermissionDeniedError(NexusAIException):
    def __init__(self, message: str = "Permission denied") -> None:
        super().__init__(message, "PERMISSION_DENIED")


# --- Resource Exceptions ---
class NotFoundError(NexusAIException):
    def __init__(self, resource: str, identifier: str | int) -> None:
        super().__init__(f"{resource} '{identifier}' not found", "NOT_FOUND")
        self.resource = resource
        self.identifier = identifier


class ConflictError(NexusAIException):
    def __init__(self, message: str) -> None:
        super().__init__(message, "CONFLICT")


class ValidationError(NexusAIException):
    def __init__(self, message: str) -> None:
        super().__init__(message, "VALIDATION_ERROR")


# --- Rate Limiting ---
class RateLimitExceededError(NexusAIException):
    def __init__(self) -> None:
        super().__init__("Rate limit exceeded. Please try again later.", "RATE_LIMIT_EXCEEDED")


# --- AI / Agent Exceptions ---
class AgentError(NexusAIException):
    def __init__(self, message: str = "Agent execution failed") -> None:
        super().__init__(message, "AGENT_ERROR")


class LLMError(NexusAIException):
    def __init__(self, message: str = "LLM call failed") -> None:
        super().__init__(message, "LLM_ERROR")


class StreamingError(NexusAIException):
    def __init__(self, message: str = "Streaming failed") -> None:
        super().__init__(message, "STREAMING_ERROR")


# --- File Exceptions ---
class FileUploadError(NexusAIException):
    def __init__(self, message: str) -> None:
        super().__init__(message, "FILE_UPLOAD_ERROR")


class UnsupportedFileTypeError(FileUploadError):
    def __init__(self, file_type: str) -> None:
        super().__init__(f"Unsupported file type: {file_type}")


# --- HTTP Exception Factories ---
def http_exception_from_domain(exc: NexusAIException) -> HTTPException:
    """Convert domain exceptions to FastAPI HTTP exceptions."""
    status_map: dict[str, int] = {
        "AUTH_ERROR": status.HTTP_401_UNAUTHORIZED,
        "PERMISSION_DENIED": status.HTTP_403_FORBIDDEN,
        "NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "CONFLICT": status.HTTP_409_CONFLICT,
        "VALIDATION_ERROR": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "RATE_LIMIT_EXCEEDED": status.HTTP_429_TOO_MANY_REQUESTS,
        "AGENT_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "LLM_ERROR": status.HTTP_502_BAD_GATEWAY,
        "FILE_UPLOAD_ERROR": status.HTTP_400_BAD_REQUEST,
        "INTERNAL_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
    }
    status_code = status_map.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    return HTTPException(
        status_code=status_code,
        detail={"message": exc.message, "code": exc.code},
    )
