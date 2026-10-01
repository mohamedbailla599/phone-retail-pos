from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.sales.models import Transaction

from apps.exchanges.models import Exchange
from apps.exchanges.services.exchanges import (
    approve_exchange,
    complete_exchange,
    create_exchange,
    reject_exchange,
    submit_exchange_for_review,
)
from apps.exchanges.services.settlement import (
    complete_exchange_refund,
    create_exchange_payment,
    create_exchange_refund,
    get_exchange_payment_status,
)

from .serializers import (
    CompleteExchangeRefundResponseSerializer,
    CreateExchangePaymentSerializer,
    CreateExchangeRefundSerializer,
    CreateExchangeSerializer,
    ExchangePaymentResponseSerializer,
    ExchangePaymentStatusSerializer,
    ExchangeRefundResponseSerializer,
    ExchangeSerializer,
)

class ExchangeDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exchange_id):
        exchange = (
            Exchange.objects
            .select_related(
                "customer",
                "original_transaction",
                "old_device",
                "new_device",
                "reviewed_by",
                "approved_by",
                "completed_by",
            )
            .filter(id=exchange_id)
            .first()
        )

        if exchange is None:
            return Response(
                {"detail": "Exchange not found."},
                status=404,
            )

        serializer = ExchangeSerializer(exchange)
        return Response(serializer.data)


class ExchangeCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreateExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            customer = Customer.objects.get(
                id=serializer.validated_data["customer_id"]
            )

            original_transaction = Transaction.objects.get(
                id=serializer.validated_data["original_transaction_id"]
            )

            old_device = DeviceItem.objects.get(
                id=serializer.validated_data["old_device_id"]
            )

            new_device = DeviceItem.objects.get(
                id=serializer.validated_data["new_device_id"]
            )

        except Customer.DoesNotExist:
            return Response(
                {"detail": "Customer not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        except Transaction.DoesNotExist:
            return Response(
                {"detail": "Original transaction not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        except DeviceItem.DoesNotExist:
            return Response(
                {"detail": "Device not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        exchange = create_exchange(
            customer=customer,
            original_transaction=original_transaction,
            old_device=old_device,
            new_device=new_device,
            old_device_value=serializer.validated_data[
                "old_device_value"
            ],
            new_device_price=serializer.validated_data[
                "new_device_price"
            ],
            reason=serializer.validated_data.get("reason"),
            actor=request.user,
        )

        return Response(
            ExchangeSerializer(exchange).data,
            status=status.HTTP_201_CREATED,
        )

class ExchangeSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        exchange = submit_exchange_for_review(
            exchange_id=exchange_id,
            actor=request.user,
        )

        return Response(
            ExchangeSerializer(exchange).data,
            status=status.HTTP_200_OK,
        )


class ExchangeApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        owner_notes = request.data.get("owner_notes")

        exchange = approve_exchange(
            exchange_id=exchange_id,
            actor=request.user,
            owner_notes=owner_notes,
        )

        return Response(
            ExchangeSerializer(exchange).data,
            status=status.HTTP_200_OK,
        )


class ExchangeRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        reason = request.data.get("reason")

        exchange = reject_exchange(
            exchange_id=exchange_id,
            actor=request.user,
            reason=reason,
        )

        return Response(
            ExchangeSerializer(exchange).data,
            status=status.HTTP_200_OK,
        )


class ExchangeCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        exchange = complete_exchange(
            exchange_id=exchange_id,
            actor=request.user,
        )

        return Response(
            {
                "exchange": ExchangeSerializer(exchange).data,
            },
            status=status.HTTP_200_OK,
        )


class ExchangePaymentCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        serializer = CreateExchangePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction_obj, payment = create_exchange_payment(
            exchange_id=exchange_id,
            amount=serializer.validated_data["amount"],
            method=serializer.validated_data["method"],
            actor=request.user,
            reference=serializer.validated_data.get("reference"),
        )

        response_data = {
            "exchange_id": exchange_id,
            "payment": payment,
            "transaction": transaction_obj,
        }

        return Response(
            ExchangePaymentResponseSerializer(response_data).data,
            status=status.HTTP_201_CREATED,
        )


class ExchangePaymentStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exchange_id):
        result = get_exchange_payment_status(
            exchange_id=exchange_id,
        )

        response_data = {
            "exchange_id": exchange_id,
            "transaction": result["transaction"],
            "confirmed_amount": result["confirmed_amount"],
            "fully_paid": result["fully_paid"],
        }

        return Response(
            ExchangePaymentStatusSerializer(response_data).data,
            status=status.HTTP_200_OK,
        )


class ExchangeRefundCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        serializer = CreateExchangeRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refund = create_exchange_refund(
            exchange_id=exchange_id,
            method=serializer.validated_data["method"],
            actor=request.user,
            reference=serializer.validated_data.get("reference"),
            reason=serializer.validated_data.get("reason"),
            notes=serializer.validated_data.get("notes"),
        )

        response_data = {
            "exchange_id": exchange_id,
            "refund": refund,
        }

        return Response(
            ExchangeRefundResponseSerializer(response_data).data,
            status=status.HTTP_201_CREATED,
        )


class ExchangeRefundCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, refund_id):
        refund = complete_exchange_refund(
            refund_id=refund_id,
            actor=request.user,
        )

        return Response(
            CompleteExchangeRefundResponseSerializer(
                {"refund": refund}
            ).data,
            status=status.HTTP_200_OK,
        )

class ExchangeCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        exchange = complete_exchange(
            exchange_id=exchange_id,
            actor=request.user,
        )

        return Response(
            {
                "exchange": ExchangeSerializer(exchange).data,
            },
            status=status.HTTP_200_OK,
        )


class ExchangePaymentCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        serializer = CreateExchangePaymentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        transaction_obj, payment = create_exchange_payment(
            exchange_id=exchange_id,
            amount=serializer.validated_data["amount"],
            method=serializer.validated_data["method"],
            actor=request.user,
            reference=serializer.validated_data.get("reference"),
        )

        response_data = {
            "exchange_id": exchange_id,
            "payment": payment,
            "transaction": transaction_obj,
        }

        return Response(
            ExchangePaymentResponseSerializer(response_data).data,
            status=status.HTTP_201_CREATED,
        )


class ExchangePaymentStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exchange_id):
        result = get_exchange_payment_status(
            exchange_id=exchange_id,
        )

        response_data = {
            "exchange_id": exchange_id,
            "transaction": result["transaction"],
            "confirmed_amount": result["confirmed_amount"],
            "fully_paid": result["fully_paid"],
        }

        return Response(
            ExchangePaymentStatusSerializer(response_data).data,
            status=status.HTTP_200_OK,
        )


class ExchangeRefundCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exchange_id):
        serializer = CreateExchangeRefundSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        refund = create_exchange_refund(
            exchange_id=exchange_id,
            method=serializer.validated_data["method"],
            actor=request.user,
            reference=serializer.validated_data.get("reference"),
            reason=serializer.validated_data.get("reason"),
            notes=serializer.validated_data.get("notes"),
        )

        response_data = {
            "exchange_id": exchange_id,
            "refund": refund,
        }

        return Response(
            ExchangeRefundResponseSerializer(response_data).data,
            status=status.HTTP_201_CREATED,
        )


class ExchangeRefundCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, refund_id):
        refund = complete_exchange_refund(
            refund_id=refund_id,
            actor=request.user,
        )

        return Response(
            CompleteExchangeRefundResponseSerializer(
                {"refund": refund}
            ).data,
            status=status.HTTP_200_OK,
        )
    