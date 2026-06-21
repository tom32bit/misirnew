"""FastAPI error handlers (RFC 9457 Problem Details)."""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from core.error_types import ErrorDetail, DomainError
from core.logging_config import get_logger

logger = get_logger(__name__)

ERROR_TYPE_TO_STATUS = {
    DomainError.VALIDATION_ERROR: status.HTTP_400_BAD_REQUEST,
    DomainError.INVALID_INPUT: status.HTTP_400_BAD_REQUEST,
    DomainError.NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.SPACE_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.ARTIFACT_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.SUBSPACE_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.GAP_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.ALREADY_EXISTS: status.HTTP_409_CONFLICT,
    DomainError.CONFLICT: status.HTTP_409_CONFLICT,
    DomainError.BUSINESS_RULE_VIOLATION: status.HTTP_422_UNPROCESSABLE_ENTITY,
    DomainError.UNAUTHORIZED: status.HTTP_401_UNAUTHORIZED,
    DomainError.FORBIDDEN: status.HTTP_403_FORBIDDEN,
    DomainError.REPOSITORY_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DomainError.DATABASE_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DomainError.EMBEDDING_SERVICE_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DomainError.EXTERNAL_SERVICE_ERROR: status.HTTP_502_BAD_GATEWAY,
    DomainError.CONFIGURATION_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
}

_STATUS_TITLES = {
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 409: "Conflict", 422: "Unprocessable Entity",
    500: "Internal Server Error", 502: "Bad Gateway",
}


def get_status_code(error_type: str) -> int:
    return ERROR_TYPE_TO_STATUS.get(error_type, status.HTTP_500_INTERNAL_SERVER_ERROR)


def create_problem_response(error: ErrorDetail, request_path: str = None) -> JSONResponse:
    status_code = get_status_code(error.error_type)
    if status_code >= 500:
        logger.error("Server error", error_type=error.error_type, message=error.message, path=request_path)
    else:
        logger.warning("Client error", error_type=error.error_type, message=error.message, path=request_path)
    content = {
        "status": status_code,
        "title": _STATUS_TITLES.get(status_code, "Error"),
        "detail": error.message,
        "type": error.error_type,
    }
    if error.context:
        content.update(error.context)
    return JSONResponse(status_code=status_code, content=content, media_type="application/problem+json")


async def pydantic_validation_error_handler(request: Request, exc: ValidationError):
    errors = [f"{' -> '.join(str(l) for l in e['loc'])}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"status": 422, "title": "Validation Error", "detail": "Request validation failed.", "type": "validation-error", "errors": errors},
        media_type="application/problem+json",
    )


async def request_validation_error_handler(request: Request, exc):
    """FastAPI body/query validation (RequestValidationError). Logs the exact
    failing fields server-side — the default handler returns them to the client
    but logs nothing, leaving 422s opaque in the server log."""
    errors = [f"{' -> '.join(str(l) for l in e['loc'])}: {e['msg']}" for e in exc.errors()]
    logger.warning("Request validation failed", path=str(request.url.path), errors=errors)
    return JSONResponse(
        status_code=422,
        content={"status": 422, "title": "Validation Error", "detail": "Request validation failed.", "type": "validation-error", "errors": errors},
        media_type="application/problem+json",
    )


async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"status": 400, "title": "Bad Request", "detail": str(exc), "type": "value-error"},
        media_type="application/problem+json",
    )


async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception", exception_type=type(exc).__name__, path=str(request.url.path), exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"status": 500, "title": "Internal Server Error", "detail": "An unexpected error occurred.", "type": "internal-error"},
        media_type="application/problem+json",
    )
