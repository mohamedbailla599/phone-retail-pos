from datetime import timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    add_reservation_payment,
    cancel_reservation,
    complete_reservation,
    create_and_activate_reservation,
)
from apps.users.permissions import HasSelectedPOSOperator
from core.exceptions import ReservationError

from .serializers import (
    AddReservationPaymentSerializer,
    CancelReservationSerializer,
    CompleteReservationSerializer,
    CreateReservationSerializer,
    ReservationSerializer,
)


class ReservationListView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [HasSelectedPOSOperator()]
        return [permissions.IsAuthenticated()]

    def get(self, request):
        qs = (
            Reservation.objects
            .select_related(
                "customer",
                "device",
                "device__product",
                "transaction",
                "cancelled_by",
                "completed_by",
            )
            .prefetch_related("transaction__payments")
            .order_by("-id")
        )

        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            qs = qs.filter(status=status_param)

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(reservation_number__icontains=search)
                | Q(customer__full_name__icontains=search)
                | Q(customer__phone_number__icontains=search)
                | Q(device__imei_1__icontains=search)
                | Q(device__serial_number__icontains=search)
                | Q(device__product__name__icontains=search)
            )

        serializer = ReservationSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateReservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        customer = get_object_or_404(Customer, id=data["customer_id"])
        device = get_object_or_404(DeviceItem, id=data["device_id"])

        expires_at = data.get("expires_at")
        duration_days = data.get("duration_days")
        if duration_days and not expires_at:
            expires_at = timezone.now() + timedelta(days=duration_days)

        try:
            reservation = create_and_activate_reservation(
                actor=request.pos_operator,
                customer=customer,
                device_id=device.id,
                reserved_price=data.get("reserved_price"),
                expires_at=expires_at,
                notes=data.get("notes"),
                deposit_amount=data.get("deposit_amount"),
                deposit_method=data.get("deposit_method", Payment.Method.CASH),
                deposit_reference=data.get("deposit_reference"),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Re-fetch with full related objects for serialization
        reservation = (
            Reservation.objects
            .select_related(
                "customer",
                "device",
                "device__product",
                "transaction",
            )
            .prefetch_related("transaction__payments")
            .get(id=reservation.id)
        )

        return Response(
            ReservationSerializer(reservation).data,
            status=status.HTTP_201_CREATED,
        )


class ReservationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, reservation_id):
        reservation = (
            Reservation.objects
            .select_related(
                "customer",
                "device",
                "device__product",
                "transaction",
                "cancelled_by",
                "completed_by",
            )
            .prefetch_related("transaction__payments")
            .filter(id=reservation_id)
            .first()
        )
        if not reservation:
            return Response({"detail": "Reservation not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(ReservationSerializer(reservation).data)


class ReservationCompleteView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, reservation_id):
        serializer = CompleteReservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            reservation = complete_reservation(
                reservation_id=reservation_id,
                actor=request.pos_operator,
                payment_amount=data.get("payment_amount"),
                payment_method=data.get("payment_method", Payment.Method.CASH),
                payment_reference=data.get("payment_reference"),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        reservation = (
            Reservation.objects
            .select_related(
                "customer",
                "device",
                "device__product",
                "transaction",
                "completed_by",
            )
            .prefetch_related("transaction__payments")
            .get(id=reservation.id)
        )
        return Response(ReservationSerializer(reservation).data)


class ReservationCancelView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, reservation_id):
        serializer = CancelReservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            reservation = cancel_reservation(
                reservation_id=reservation_id,
                actor=request.pos_operator,
                reason=data.get("reason"),
                refund_deposit=data.get("refund_deposit", False),
                refund_method=data.get("refund_method", Payment.Method.CASH),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        reservation = (
            Reservation.objects
            .select_related(
                "customer",
                "device",
                "device__product",
                "transaction",
                "cancelled_by",
            )
            .prefetch_related("transaction__payments")
            .get(id=reservation.id)
        )
        return Response(ReservationSerializer(reservation).data)


class ReservationAddPaymentView(APIView):
    permission_classes = [HasSelectedPOSOperator]

    def post(self, request, reservation_id):
        serializer = AddReservationPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            add_reservation_payment(
                reservation_id=reservation_id,
                amount=data["amount"],
                method=data["method"],
                actor=request.pos_operator,
                reference=data.get("reference"),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        reservation = (
            Reservation.objects
            .select_related(
                "customer",
                "device",
                "device__product",
                "transaction",
            )
            .prefetch_related("transaction__payments")
            .get(id=reservation_id)
        )
        return Response(ReservationSerializer(reservation).data)


class ReservationStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        soon = now + timedelta(days=2)

        active_count = Reservation.objects.filter(status=Reservation.Status.ACTIVE).count()
        expiring_soon_count = Reservation.objects.filter(
            status=Reservation.Status.ACTIVE,
            expires_at__lte=soon,
            expires_at__gt=now,
        ).count()
        completed_count = Reservation.objects.filter(status=Reservation.Status.COMPLETED).count()
        cancelled_count = Reservation.objects.filter(status=Reservation.Status.CANCELLED).count()

        # Total deposits currently held in active reservations
        active_reservations_transactions = Reservation.objects.filter(
            status=Reservation.Status.ACTIVE
        ).values_list("transaction_id", flat=True)

        total_deposits_held = (
            Payment.objects.filter(
                transaction_id__in=active_reservations_transactions,
                status=Payment.Status.CONFIRMED,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        return Response({
            "active_count": active_count,
            "expiring_soon_count": expiring_soon_count,
            "completed_count": completed_count,
            "cancelled_count": cancelled_count,
            "total_deposits_held": str(total_deposits_held),
        })
