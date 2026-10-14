from rest_framework.permissions import BasePermission

from apps.users.services.operator_context import (
    OperatorContextError,
    get_required_operator,
)


class HasSelectedPOSOperator(BasePermission):
    """
    Require an authenticated POS session with a valid
    selected Hassan/Mohamed operator context.
    """

    message = (
        "A POS operator must be selected before performing "
        "this operation."
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            operator = get_required_operator(request)
        except OperatorContextError:
            return False

        request.pos_operator = operator
        return True