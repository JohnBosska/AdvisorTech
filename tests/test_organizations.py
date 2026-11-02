import pytest
from pydantic import ValidationError

from app.data_layer.alchemy.models import OrganizationMember
from app.exceptions import ForbiddenError
from app.resources.organization import CONNECTION_MANAGER_ROLES, require_role
from app.schemas.integration import SourceConnectionCreateRequest, SourceConnectionResponse
from app.schemas.organization import OrganizationCreateRequest


def test_tax_id_must_be_10_or_12_digits() -> None:
    assert OrganizationCreateRequest(name="ООО Пример", tax_id="7700000000").tax_id
    assert OrganizationCreateRequest(name="ИП Пример", tax_id="770000000000").tax_id
    with pytest.raises(ValidationError):
        OrganizationCreateRequest(name="X", tax_id="123")


def test_only_owner_and_it_admin_manage_connections() -> None:
    for role in OrganizationMember.RoleEnum:
        member = OrganizationMember(organization_id=1, user_id=1, role=role)
        if role in {OrganizationMember.RoleEnum.OWNER, OrganizationMember.RoleEnum.IT_ADMIN}:
            require_role(member, CONNECTION_MANAGER_ROLES)
        else:
            with pytest.raises(ForbiddenError):
                require_role(member, CONNECTION_MANAGER_ROLES)


def test_connection_request_rejects_unknown_transport() -> None:
    with pytest.raises(ValidationError):
        SourceConnectionCreateRequest(
            name="1С",
            configuration="ERP",
            source_dbms="POSTGRESQL",
            transport="DIRECT_SQL",  # direct SQL access to 1C tables is not a supported transport
        )


def test_connection_response_is_always_read_only() -> None:
    assert SourceConnectionResponse.model_fields["read_only"].default is True
