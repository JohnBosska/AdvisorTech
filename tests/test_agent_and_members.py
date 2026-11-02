import pytest
from pydantic import ValidationError

from app.data_layer.alchemy.models import OrganizationMember
from app.exceptions import ForbiddenError
from app.resources.member import MEMBER_MANAGER_ROLES, _require_owner
from app.schemas.agent import BatchRequest, FinishRequest
from app.utils.tokens import generate_opaque_token, hash_opaque_token


def test_tokens_are_prefixed_unique_and_hashed() -> None:
    first, first_hash = generate_opaque_token("agt")
    second, _ = generate_opaque_token("agt")
    assert first.startswith("agt_") and first != second
    assert first_hash == hash_opaque_token(first) and first not in first_hash


def test_batch_counters_must_add_up() -> None:
    BatchRequest(
        sequence=1,
        entity="sales",
        records_received=3,
        records_accepted=1,
        records_rejected=1,
        records_quarantined=1,
    )
    with pytest.raises(ValidationError):
        BatchRequest(sequence=1, entity="sales", records_received=3, records_accepted=1)
    with pytest.raises(ValidationError):
        BatchRequest(sequence=0, entity="sales", records_received=0, records_accepted=0)


def test_finish_accepts_only_final_statuses() -> None:
    assert FinishRequest(status="FAILED").status.value == "FAILED"
    with pytest.raises(ValidationError):
        FinishRequest(status="RUNNING")


def test_only_owner_manages_members() -> None:
    assert MEMBER_MANAGER_ROLES == {OrganizationMember.RoleEnum.OWNER}
    for role in OrganizationMember.RoleEnum:
        member = OrganizationMember(organization_id=1, user_id=1, role=role)
        if role == OrganizationMember.RoleEnum.OWNER:
            _require_owner(member)
        else:
            with pytest.raises(ForbiddenError):
                _require_owner(member)
