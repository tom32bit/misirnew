"""Domain error types and Result pattern."""
from typing import TypeVar
from result import Result, Ok, Err

T = TypeVar('T')


class DomainError:
    VALIDATION_ERROR = "validation-error"
    INVALID_INPUT = "invalid-input"
    NOT_FOUND = "not-found"
    SPACE_NOT_FOUND = "space-not-found"
    ARTIFACT_NOT_FOUND = "artifact-not-found"
    SUBSPACE_NOT_FOUND = "subspace-not-found"
    GAP_NOT_FOUND = "gap-not-found"
    ALREADY_EXISTS = "already-exists"
    CONFLICT = "conflict"
    BUSINESS_RULE_VIOLATION = "business-rule-violation"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    REPOSITORY_ERROR = "repository-error"
    DATABASE_ERROR = "database-error"
    EMBEDDING_SERVICE_ERROR = "embedding-service-error"
    EXTERNAL_SERVICE_ERROR = "external-service-error"
    CONFIGURATION_ERROR = "configuration-error"


class ErrorDetail:
    def __init__(self, error_type: str, message: str, context: dict = None):
        self.error_type = error_type
        self.message = message
        self.context = context or {}

    def __str__(self) -> str:
        return self.message

    def __repr__(self) -> str:
        return f"ErrorDetail(type='{self.error_type}', message='{self.message}')"


DomainResult = Result[T, ErrorDetail]
RepositoryResult = Result[T, ErrorDetail]
ServiceResult = Result[T, ErrorDetail]


def not_found_error(resource: str, identifier: str | int, **context) -> ErrorDetail:
    return ErrorDetail(
        DomainError.NOT_FOUND,
        f"{resource} '{identifier}' not found",
        {"resource": resource, "id": identifier, **context}
    )


def validation_error(message: str, **context) -> ErrorDetail:
    return ErrorDetail(DomainError.VALIDATION_ERROR, message, context)


def conflict_error(message: str, **context) -> ErrorDetail:
    return ErrorDetail(DomainError.CONFLICT, message, context)


def repository_error(message: str, **context) -> ErrorDetail:
    return ErrorDetail(DomainError.REPOSITORY_ERROR, message, context)


def embedding_service_error(message: str, **context) -> ErrorDetail:
    return ErrorDetail(DomainError.EMBEDDING_SERVICE_ERROR, message, context)


def success(value: T) -> Result[T, ErrorDetail]:
    return Ok(value)


def failure(error: ErrorDetail) -> Result[T, ErrorDetail]:
    return Err(error)
