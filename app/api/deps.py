from fastapi import Query


class PaginationParams:
    """Reusable pagination dependency for list endpoints."""

    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Number of records to skip"),
        limit: int = Query(50, ge=1, le=200, description="Maximum number of records to return"),
    ):
        self.skip = skip
        self.limit = limit
