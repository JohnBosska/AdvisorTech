from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import AgentCredential
from app.exceptions import UnauthorizedError
from app.utils.tokens import hash_opaque_token

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AgentContext:
    """Identity of a Connector Agent: one credential = one connection of one organization."""

    credential_id: int
    organization_id: int
    connection_id: int


async def get_agent(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AgentContext:
    if credentials is None:
        raise UnauthorizedError("Invalid or missing agent token")
    async with SessionFactory() as session:
        credential = await AgentCredential.get_active_by_hash(
            session, hash_opaque_token(credentials.credentials)
        )
    if credential is None:
        raise UnauthorizedError("Invalid or missing agent token")
    return AgentContext(credential.id, credential.organization_id, credential.connection_id)
