from apps.audit.models import AuditLog
from apps.users.models import User


def record_audit(
    *,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: int,
    old_values=None,
    new_values=None,
    reason=None,
) -> AuditLog:
    """Create an immutable audit entry using the actual selected operator."""
    if not actor.is_active or not actor.is_pos_operator or actor.role != User.Role.OWNER:
        raise ValueError("Audit actor must be an active POS owner operator.")

    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        reason=reason,
    )
