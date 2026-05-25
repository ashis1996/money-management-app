"""
Response utilities for consistent API responses
"""

from typing import Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """Standard API response model"""

    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None
    errors: Optional[list] = None
    timestamp: str = None

    class Config:
        arbitrary_types_allowed = True

    def __init__(self, **kwargs):
        if "timestamp" not in kwargs:
            kwargs["timestamp"] = datetime.utcnow().isoformat()
        super().__init__(**kwargs)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return self.model_dump(exclude_none=True)


class ErrorResponse(BaseModel):
    """Standard error response model"""

    success: bool = False
    error: str
    message: str
    code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: str = None

    class Config:
        arbitrary_types_allowed = True

    def __init__(self, **kwargs):
        if "timestamp" not in kwargs:
            kwargs["timestamp"] = datetime.utcnow().isoformat()
        super().__init__(**kwargs)


def success_response(data: Any, message: Optional[str] = None) -> Dict[str, Any]:
    """Create a success response"""
    return ApiResponse(
        success=True,
        message=message,
        data=data
    ).to_dict()


def error_response(
    message: str,
    error: str = "Error",
    code: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create an error response"""
    return ErrorResponse(
        error=error,
        message=message,
        code=code,
        details=details
    ).to_dict()
