from django.contrib.auth import authenticate, login, logout
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from apps.users.serializers import (
    LoginSerializer,
    POSUserSerializer,
    SelectOperatorSerializer,
)
from apps.users.services.operator_context import (
    OperatorContextError,
    clear_operator_context,
    create_operator_context,
    get_operator_from_context,
)


class POSLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request=request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )

        if user is None or not user.is_active or not user.is_pos_account:
            return Response(
                {"detail": "Invalid POS credentials."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user)
        clear_operator_context(request)

        return Response(
            {
                "authenticated": True,
                "user": POSUserSerializer(user).data,
                "operator": None,
            },
            status=status.HTTP_200_OK,
        )


class POSLogoutView(APIView):
    def post(self, request):
        clear_operator_context(request)
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class POSMeView(APIView):
    def get(self, request):
        operator = None
        token = request.session.get("pos_operator_context")
        if token:
            try:
                operator = get_operator_from_context(request, token)
            except OperatorContextError:
                clear_operator_context(request)

        return Response(
            {
                "authenticated": True,
                "user": POSUserSerializer(request.user).data,
                "operator": POSUserSerializer(operator).data if operator else None,
            }
        )


class POSOperatorListView(APIView):
    def get(self, request):
        operators = User.objects.filter(
            is_active=True,
            is_pos_operator=True,
            role=User.Role.OWNER,
        ).order_by("first_name", "last_name", "id")
        return Response(POSUserSerializer(operators, many=True).data)


class POSOperatorSelectView(APIView):
    def post(self, request):
        serializer = SelectOperatorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            operator = User.objects.get(
                id=serializer.validated_data["operator_id"],
                is_active=True,
                is_pos_operator=True,
                role=User.Role.OWNER,
            )
        except User.DoesNotExist:
            return Response(
                {"detail": "POS operator not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            token = create_operator_context(request, operator)
        except OperatorContextError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "operator": POSUserSerializer(operator).data,
                "operator_context": token,
                "expires_in": 15 * 60,
            },
            status=status.HTTP_200_OK,
        )


class POSOperatorClearView(APIView):
    def post(self, request):
        clear_operator_context(request)
        return Response({"operator": None}, status=status.HTTP_200_OK)
