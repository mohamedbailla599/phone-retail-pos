from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.users.permissions import HasSelectedPOSOperator

from apps.returns.models import Return
from apps.returns.services.returns import (
    create_return,
    approve_return,
    process_device_return,
)
from .serializers import (
    ReturnSerializer,
    CreateReturnSerializer,
    ProcessDeviceReturnSerializer,
)


class ReturnListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        returns = (
            Return.objects
            .select_related("transaction", "customer", "created_by", "approved_by")
            .prefetch_related("items")
            .order_by("-id")
        )
        serializer = ReturnSerializer(returns, many=True)
        return Response(serializer.data)


class ReturnDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, return_id):
        return_obj = (
            Return.objects
            .select_related("transaction", "customer", "created_by", "approved_by")
            .prefetch_related("items")
            .filter(id=return_id)
            .first()
        )
        if not return_obj:
            return Response({"detail": "Return not found."}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ReturnSerializer(return_obj)
        return Response(serializer.data)


class ReturnCreateView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request):
        serializer = CreateReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            return_record = create_return(
                transaction_id=serializer.validated_data["transaction_id"],
                transaction_item_id=serializer.validated_data["transaction_item_id"],
                quantity=serializer.validated_data["quantity"],
                actor=request.pos_operator,
                reason=serializer.validated_data.get("reason", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            ReturnSerializer(return_record).data,
            status=status.HTTP_201_CREATED,
        )


class ReturnApproveView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, return_id):
        try:
            return_record = approve_return(
                return_id=return_id,
                actor=request.pos_operator,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Return.DoesNotExist:
            return Response({"detail": "Return not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            ReturnSerializer(return_record).data,
            status=status.HTTP_200_OK,
        )


class ReturnProcessDeviceView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, return_id):
        serializer = ProcessDeviceReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            return_record, device = process_device_return(
                return_id=return_id,
                actor=request.pos_operator,
                reason=serializer.validated_data.get("reason", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Return.DoesNotExist:
            return Response({"detail": "Return not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            ReturnSerializer(return_record).data,
            status=status.HTTP_200_OK,
        )
