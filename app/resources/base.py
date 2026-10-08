from abc import ABC, abstractmethod
from typing import Self

from app.data_layer.alchemy.models import BaseModel
from app.exceptions import ObjectNotFoundError


class BaseEntity[ModelT: BaseModel](ABC):
    def __init__(self, db_object: ModelT) -> None:
        self.db_object = db_object

    @classmethod
    @abstractmethod
    async def find(cls, object_id: int) -> Self:
        """Find an active entity or raise ObjectNotFoundError."""

    @classmethod
    def _create_from_db_object(cls, db_object: ModelT | None) -> Self:
        if db_object is None:
            raise ObjectNotFoundError("Object not found")
        return cls(db_object)
