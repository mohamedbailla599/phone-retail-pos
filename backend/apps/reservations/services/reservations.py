from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem, StockMovement
from apps.inventory.services.inventory import (
    release_reserved_device,
    reserve_device,
)
from apps.reservations.models import Reservation
from apps.sales.models import Transaction, TransactionItem
from apps.store_settings.models import StoreSettings

from core.exceptions import (
    DeviceNotAvailable,
    DeviceNotFound,
    InsufficientPayment,
    InvalidSale,
    PriceBelowMinimum,
    ReservationAlreadyExists,
    ReservationBalanceRemaining,
    ReservationError,
    ReservationExpired,
    ReservationNotActive,
    ReservationNotFound,
)


def _get_store_settings():
    settings = StoreSettings.objects.order_by("id").first()
    if settings is None:
        raise ReservationError("Store settings have not been configured.")
    return settings


def _add_calendar_months(value, months):
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1

    import calendar

    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def _get_reservation(reservation_id, *, lock=False):
    qs = Reservation.objects
    if lock:
        qs = qs.select_for_update()

    reservation = qs.filter(id=reservation_id).first()
    if reservation is None:
        raise ReservationNotFound("Reservation does not exist.")
    return reservation


def _get_confirmed_paid_amount(transaction_obj):
    return (
        transaction_obj.payments
        .filter(status="CONFIRMED")
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )


@transaction.atomic
def create_reservation(
    *,
    actor,
    customer,
    device_id,
    reserved_price=None,
    notes=None,
):
    """
    Create a DRAFT reservation and its RESERVATION transaction.

    No inventory is changed until activate_reservation() is called.
    """
    if customer is None:
        raise ReservationError("A customer is required for a reservation.")

    # Lock the customer first, then the device. This gives concurrent
    # reservation attempts a deterministic lock order and protects the
    # active-reservation checks below from racing.
    customer = (
        Customer.objects
        .select_for_update()
        .filter(pk=customer.pk)
        .first()
    )
    if customer is None:
        raise ReservationError("Customer does not exist.")

    device = (
        DeviceItem.objects
        .select_for_update()
        .select_related("product")
        .filter(id=device_id)
        .first()
    )

    if device is None:
        raise DeviceNotFound("Device does not exist.")

    if device.status != DeviceItem.Status.IN_STOCK:
        raise DeviceNotAvailable("Device is not available for reservation.")

    if Reservation.objects.filter(
        customer=customer,
        status=Reservation.Status.ACTIVE,
    ).exists():
        raise ReservationAlreadyExists(
            "This customer already has an active reservation."
        )

    if Reservation.objects.filter(
        device=device,
        status=Reservation.Status.ACTIVE,
    ).exists():
        raise ReservationAlreadyExists(
            "This device already has an active reservation."
        )

    if reserved_price is None:
        final_price = device.default_selling_price
    else:
        try:
            final_price = Decimal(str(reserved_price))
        except (TypeError, ValueError, InvalidOperation):
            raise ReservationError("Reserved price must be a valid number.")

    if final_price < device.minimum_selling_price:
        raise PriceBelowMinimum(
            "Reservation price is below the device minimum selling price."
        )

    if final_price < 0:
        raise ReservationError("Reserved price cannot be negative.")

    settings = _get_store_settings()
    now = timezone.now()
    expires_at = _add_calendar_months(
        now,
        settings.default_reservation_months,
    )

    transaction_obj = Transaction.objects.create(
        receipt_id="PENDING",
        customer=customer,
        transaction_type=Transaction.TransactionType.RESERVATION,
        status=Transaction.Status.DRAFT,
        subtotal=final_price,
        discount_amount=Decimal("0.00"),
        total_amount=final_price,
        notes=notes,
        created_by=actor,
    )

    year = timezone.localtime().year
    transaction_obj.receipt_id = (
        f"{settings.receipt_prefix}-{year}-{transaction_obj.id:06d}"
    )
    transaction_obj.save(update_fields=["receipt_id"])

    item = TransactionItem.objects.create(
        transaction=transaction_obj,
        device=device,
        accessory_stock=None,
        product_name_snapshot=device.product.name,
        sku_snapshot=device.product.sku,
        quantity=1,
        unit_price=device.default_selling_price,
        price_sold=final_price,
        line_total=final_price,
        cost_price_at_sale=device.cost_price,
        is_complimentary=False,
    )

    reservation = Reservation.objects.create(
        reservation_number=(
            f"{settings.receipt_prefix}-R-{year}-{transaction_obj.id:06d}"
        ),
        customer=customer,
        device=device,
        transaction=transaction_obj,
        reserved_price=final_price,
        reserved_at=now,
        expires_at=expires_at,
        status=Reservation.Status.DRAFT,
        notes=notes,
    )

    AuditLog.objects.create(
        actor=actor,
        action=AuditLog.Action.RESERVATION_CREATED,
        entity_type="Reservation",
        entity_id=reservation.id,
        old_values=None,
        new_values={
            "status": reservation.status,
            "reserved_price": str(reservation.reserved_price),
            "device_id": reservation.device_id,
            "customer_id": reservation.customer_id,
            "expires_at": reservation.expires_at.isoformat(),
        },
        reason="Reservation created.",
    )

    return reservation


@transaction.atomic
def activate_reservation(*, reservation_id, actor):
    """Atomically activate a DRAFT reservation and reserve its device."""
    reservation = _get_reservation(reservation_id, lock=True)

    if reservation.status != Reservation.Status.DRAFT:
        raise ReservationError("Only DRAFT reservations can be activated.")

    transaction_obj = (
        Transaction.objects
        .select_for_update()
        .get(pk=reservation.transaction_id)
    )

    if transaction_obj.transaction_type != Transaction.TransactionType.RESERVATION:
        raise ReservationError("Reservation transaction type is invalid.")

    if transaction_obj.status != Transaction.Status.DRAFT:
        raise ReservationError("Reservation transaction must be DRAFT.")

    if reservation.expires_at <= timezone.now():
        raise ReservationExpired("The reservation has already expired.")

    # Inventory service performs the row lock and status validation.
    reserve_device(
        device_id=reservation.device_id,
        actor=actor,
        reference_type="Reservation",
        reference_id=reservation.id,
        reason="Reservation activated.",
    )

    now = timezone.now()
    reservation.status = Reservation.Status.ACTIVE
    reservation.reserved_at = now
    reservation.save(update_fields=["status", "reserved_at", "updated_at"])

    transaction_obj.status = Transaction.Status.PENDING_PAYMENT
    transaction_obj.save(update_fields=["status", "updated_at"])

    return reservation


@transaction.atomic
def cancel_reservation(*, reservation_id, actor, reason=None):
    """Cancel an ACTIVE reservation and release its device."""
    reservation = _get_reservation(reservation_id, lock=True)

    if reservation.status != Reservation.Status.ACTIVE:
        raise ReservationNotActive("Only ACTIVE reservations can be cancelled.")

    release_reserved_device(
        device_id=reservation.device_id,
        actor=actor,
        reference_type="Reservation",
        reference_id=reservation.id,
        reason=reason or "Reservation cancelled.",
    )

    now = timezone.now()
    old_status = reservation.status
    reservation.status = Reservation.Status.CANCELLED
    reservation.cancelled_at = now
    reservation.cancelled_by = actor
    reservation.save(
        update_fields=[
            "status",
            "cancelled_at",
            "cancelled_by",
            "updated_at",
        ]
    )

    transaction_obj = Transaction.objects.select_for_update().get(
        pk=reservation.transaction_id
    )
    transaction_obj.status = Transaction.Status.CANCELLED
    transaction_obj.save(update_fields=["status", "updated_at"])

    AuditLog.objects.create(
        actor=actor,
        action=AuditLog.Action.RESERVATION_CANCELLED,
        entity_type="Reservation",
        entity_id=reservation.id,
        old_values={"status": old_status},
        new_values={"status": reservation.status},
        reason=reason or "Reservation cancelled.",
    )

    return reservation


@transaction.atomic
def expire_reservation(*, reservation_id, actor):
    """Expire an ACTIVE reservation whose expiry time has been reached."""
    reservation = _get_reservation(reservation_id, lock=True)

    if reservation.status != Reservation.Status.ACTIVE:
        raise ReservationNotActive("Only ACTIVE reservations can expire.")

    if reservation.expires_at > timezone.now():
        raise ReservationError("The reservation has not expired yet.")

    release_reserved_device(
        device_id=reservation.device_id,
        actor=actor,
        reference_type="Reservation",
        reference_id=reservation.id,
        reason="Reservation expired.",
    )

    transaction_obj = Transaction.objects.select_for_update().get(
        pk=reservation.transaction_id
    )
    transaction_obj.status = Transaction.Status.CANCELLED
    transaction_obj.save(update_fields=["status", "updated_at"])

    old_status = reservation.status
    reservation.status = Reservation.Status.EXPIRED
    reservation.save(update_fields=["status", "updated_at"])

    AuditLog.objects.create(
        actor=actor,
        action=AuditLog.Action.RESERVATION_EXPIRED,
        entity_type="Reservation",
        entity_id=reservation.id,
        old_values={"status": old_status},
        new_values={"status": reservation.status},
        reason="Reservation expired.",
    )

    return reservation


@transaction.atomic
def complete_reservation(*, reservation_id, actor):
    """Complete an ACTIVE reservation after full confirmed payment."""
    reservation = _get_reservation(reservation_id, lock=True)

    if reservation.status != Reservation.Status.ACTIVE:
        raise ReservationNotActive("Only ACTIVE reservations can be completed.")

    if reservation.expires_at <= timezone.now():
        raise ReservationExpired("The reservation has expired.")

    transaction_obj = (
        Transaction.objects
        .select_for_update()
        .get(pk=reservation.transaction_id)
    )

    if transaction_obj.transaction_type != Transaction.TransactionType.RESERVATION:
        raise ReservationError("Reservation transaction type is invalid.")

    if transaction_obj.status != Transaction.Status.PENDING_PAYMENT:
        raise ReservationError("Reservation transaction must be PENDING_PAYMENT.")

    confirmed_paid = _get_confirmed_paid_amount(transaction_obj)
    if confirmed_paid < transaction_obj.total_amount:
        raise ReservationBalanceRemaining(
            f"Reservation balance remaining: "
            f"{transaction_obj.total_amount - confirmed_paid:.2f}."
        )

    device = (
        DeviceItem.objects
        .select_for_update()
        .filter(pk=reservation.device_id)
        .first()
    )
    if device is None:
        raise DeviceNotFound("Reservation device does not exist.")

    if device.status != DeviceItem.Status.RESERVED:
        raise DeviceNotAvailable(
            "Reserved device is no longer in RESERVED status."
        )

    item = (
        TransactionItem.objects
        .select_for_update()
        .filter(
            transaction=transaction_obj,
            device=device,
        )
        .first()
    )
    if item is None:
        raise ReservationError("Reservation transaction item does not exist.")

    settings = _get_store_settings()
    warranty_date = timezone.localdate()
    completed_at = timezone.now()

    old_status = device.status
    device.status = DeviceItem.Status.SOLD
    device.save(update_fields=["status", "updated_at"])

    StockMovement.objects.create(
        device=device,
        movement_type=StockMovement.MovementType.SOLD,
        quantity=1,
        from_status=old_status,
        to_status=device.status,
        reference_type="Reservation",
        reference_id=reservation.id,
        reason="Reservation completed.",
        created_by=actor,
    )

    warranty_months = settings.default_device_warranty_months
    if warranty_months > 0:
        item.warranty_start = warranty_date
        item.warranty_end = _add_calendar_months(
            warranty_date,
            warranty_months,
        )
    else:
        item.warranty_start = None
        item.warranty_end = None
    item.save(update_fields=["warranty_start", "warranty_end"])

    customer = (
        Customer.objects
        .select_for_update()
        .get(pk=reservation.customer_id)
    )
    customer.total_spent += transaction_obj.total_amount
    customer.save(update_fields=["total_spent", "updated_at"])

    transaction_obj.status = Transaction.Status.COMPLETED
    transaction_obj.completed_at = completed_at
    transaction_obj.save(
        update_fields=["status", "completed_at", "updated_at"]
    )

    reservation.status = Reservation.Status.COMPLETED
    reservation.completed_at = completed_at
    reservation.completed_by = actor
    reservation.save(
        update_fields=["status", "completed_at", "completed_by", "updated_at"]
    )

    return reservation
