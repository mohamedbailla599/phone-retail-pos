from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.users.permissions import HasSelectedPOSOperator
from apps.customers.models import Customer

from apps.refunds.models import Refund
from apps.refunds.services.refunds import (
    create_refund,
    approve_refund,
    complete_refund,
    reject_refund,
)
from .serializers import (
    RefundSerializer,
    CreateRefundSerializer,
    RejectRefundSerializer,
)


class RefundListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        refunds = (
            Refund.objects
            .select_related(
                "customer",
                "requested_by",
                "approved_by",
                "completed_by",
                "rejected_by",
            )
            .prefetch_related("allocations")
            .order_by("-id")
        )
        serializer = RefundSerializer(refunds, many=True)
        return Response(serializer.data)


class RefundDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, refund_id):
        refund_obj = (
            Refund.objects
            .select_related(
                "customer",
                "requested_by",
                "approved_by",
                "completed_by",
                "rejected_by",
            )
            .prefetch_related("allocations")
            .filter(id=refund_id)
            .first()
        )
        if not refund_obj:
            return Response({"detail": "Refund not found."}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = RefundSerializer(refund_obj)
        return Response(serializer.data)


class RefundCreateView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request):
        serializer = CreateRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            customer = Customer.objects.get(id=serializer.validated_data["customer_id"])
        except Customer.DoesNotExist:
            return Response({"detail": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            refund_record = create_refund(
                customer=customer,
                source_type=serializer.validated_data["source_type"],
                source_id=serializer.validated_data["source_id"],
                amount=serializer.validated_data["amount"],
                method=serializer.validated_data["method"],
                reason=serializer.validated_data.get("reason", ""),
                reference=serializer.validated_data.get("reference", ""),
                notes=serializer.validated_data.get("notes", ""),
                actor=request.pos_operator,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            RefundSerializer(refund_record).data,
            status=status.HTTP_201_CREATED,
        )


class RefundApproveView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, refund_id):
        try:
            refund_record = approve_refund(
                refund_id=refund_id,
                actor=request.pos_operator,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Refund.DoesNotExist:
            return Response({"detail": "Refund not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            RefundSerializer(refund_record).data,
            status=status.HTTP_200_OK,
        )


class RefundCompleteView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, refund_id):
        try:
            refund_record = complete_refund(
                refund_id=refund_id,
                actor=request.pos_operator,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Refund.DoesNotExist:
            return Response({"detail": "Refund not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            RefundSerializer(refund_record).data,
            status=status.HTTP_200_OK,
        )


class RefundRejectView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, refund_id):
        serializer = RejectRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            refund_record = reject_refund(
                refund_id=refund_id,
                actor=request.pos_operator,
                reason=serializer.validated_data.get("reason", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Refund.DoesNotExist:
            return Response({"detail": "Refund not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            RefundSerializer(refund_record).data,
            status=status.HTTP_200_OK,
        )
