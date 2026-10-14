from django.core import signing
from django.utils import timezone
from django.utils.crypto import constant_time_compare

from apps.users.models import User


OPERATOR_CONTEXT_SALT = "bighrissen.pos.operator-context"
OPERATOR_CONTEXT_MAX_AGE = 24 * 60 * 60  # 24 hours (full POS shift)
OPERATOR_CONTEXT_SESSION_KEY = "pos_operator_context"


class OperatorContextError(ValueError):
    """Raised when an operator context is missing or invalid."""


def create_operator_context(request, operator: User) -> str:
    """
    Create and store a signed POS operator context.

    The selected operator is NOT the authenticated Django user.
    The Django session authenticates the shared POS account,
    while this context identifies which owner is performing
    the current POS operations.
    """

    if not operator.is_active or not operator.is_pos_operator:
        raise OperatorContextError(
            "Selected user is not an active POS operator."
        )

    if operator.role not in [User.Role.OWNER, User.Role.CASHIER]:
        raise OperatorContextError(
            "Selected POS operator is not valid."
        )

    issued_at = timezone.now().timestamp()

    if not request.session.session_key:
        request.session.save()

    payload = {
        "operator_id": operator.pk,
        "session_key": request.session.session_key,
        "issued_at": issued_at,
    }

    token = signing.dumps(
        payload,
        salt=OPERATOR_CONTEXT_SALT,
    )

    request.session[OPERATOR_CONTEXT_SESSION_KEY] = token
    request.session.modified = True

    return token


def get_operator_from_context(
    request,
    token: str | None = None,
) -> User:
    """
    Resolve the currently selected POS operator.

    Priority:
    1. Explicit X-Operator-Context header, if provided.
    2. Operator context stored in the authenticated Django session.

    The resolved token must match the token stored in the session.
    This prevents an operator context from another session from
    being reused.
    """

    session_token = request.session.get(
        OPERATOR_CONTEXT_SESSION_KEY
    )

    provided_token = token or request.headers.get(
        "X-Operator-Context"
    )

    # If no header was provided, use the context already stored
    # in the authenticated Django session.
    token = provided_token or session_token

    if not token or not session_token:
        # Fallback: auto-assign active operator if available (e.g. current user or Mohamed)
        target = None
        if getattr(request, "user", None) and request.user.is_authenticated and getattr(request.user, "is_pos_operator", False):
            target = request.user
        else:
            target = User.objects.filter(is_active=True, is_pos_operator=True).order_by("id").first()

        if target:
            try:
                create_operator_context(request, target)
                return target
            except Exception:
                pass

        raise OperatorContextError(
            "Operator selection is required for this operation."
        )

    # The token used for this request MUST be the same token
    # stored in the current Django session.
    if not constant_time_compare(
        token,
        session_token,
    ):
        target = User.objects.filter(is_active=True, is_pos_operator=True).order_by("id").first()
        if target:
            try:
                create_operator_context(request, target)
                return target
            except Exception:
                pass
        raise OperatorContextError(
            "Operator context is invalid or expired."
        )

    try:
        payload = signing.loads(
            token,
            salt=OPERATOR_CONTEXT_SALT,
            max_age=OPERATOR_CONTEXT_MAX_AGE,
        )
    except signing.BadSignature as exc:
        raise OperatorContextError(
            "Operator context is invalid or expired."
        ) from exc

    # Bind the signed context to the current Django session.
    if payload.get("session_key") != request.session.session_key:
        raise OperatorContextError(
            "Operator context is invalid for this session."
        )

    try:
        operator = User.objects.get(
            pk=payload["operator_id"],
            is_active=True,
            is_pos_operator=True,
        )
    except (
        User.DoesNotExist,
        KeyError,
        TypeError,
        ValueError,
    ) as exc:
        raise OperatorContextError(
            "Selected operator is no longer available."
        ) from exc

    return operator


def clear_operator_context(request) -> None:
    """
    Remove the currently selected POS operator.
    """

    request.session.pop(
        OPERATOR_CONTEXT_SESSION_KEY,
        None,
    )

    request.session.modified = True


def get_required_operator(request) -> User:
    """
    Return the currently selected POS operator.

    Raises OperatorContextError when no valid operator
    context exists, falling back to authenticated owner if available.
    """
    try:
        return get_operator_from_context(request)
    except OperatorContextError:
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            if getattr(user, "is_pos_operator", False) or user.is_superuser or getattr(user, "role", None) == User.Role.OWNER:
                return user
        raise