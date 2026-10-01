from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.exchanges.models import Exchange
from apps.inventory.models import DeviceItem, StockMovement
from apps.payments.models import Payment
from apps.refunds.models import Refund
from apps.sales.models import Transaction, TransactionItem

from core.exceptions import (
    ExchangeError,
    ExchangeNotAllowed,
    ExchangeNotFound,
)


# ============================================================
# Helpers
# ============================================================

def _generate_exchange_number():
    """
    Generate a human-readable exchange number.

    Example:
        BP-EX-2026-000001
    """
    year = timezone.now().year

    last_exchange = (
        Exchange.objects
        .filter(exchange_number__startswith=f"BP-EX-{year}-")
        .order_by("-id")
        .first()
    )

    if last_exchange:
        last_number = int(
            last_exchange.exchange_number.rsplit("-", 1)[-1]
        )
        next_number = last_number + 1
    else:
        next_number = 1

    return f"BP-EX-{year}-{next_number:06d}"


def _calculate_financial_direction(old_value, new_price):
    """
    Calculate the financial direction of the exchange.

    new > old:
        CUSTOMER_PAYS

    old > new:
        STORE_REFUNDS

    equal:
        EVEN
    """

    old_value = Decimal(old_value)
    new_price = Decimal(new_price)

    difference = new_price - old_value

    if difference > Decimal("0.00"):
        return (
            difference,
            Exchange.FinancialDirection.CUSTOMER_PAYS,
        )

    if difference < Decimal("0.00"):
        return (
            abs(difference),
            Exchange.FinancialDirection.STORE_REFUNDS,
        )

    return (
        Decimal("0.00"),
        Exchange.FinancialDirection.EVEN,
    )


def _get_exchange_or_raise(exchange_id):
    try:
        return Exchange.objects.get(pk=exchange_id)
    except Exchange.DoesNotExist:
        raise ExchangeNotFound(
            f"Exchange {exchange_id} was not found."
        )


def _validate_original_transaction(
    *,
    transaction_obj,
    customer,
    old_device,
):
    """
    Verify that the old device was actually sold
    to the customer through the original transaction.
    """

    if transaction_obj.transaction_type != Transaction.TransactionType.SALE:
        raise ExchangeNotAllowed(
            "An exchange can only reference a completed SALE."
        )

    if transaction_obj.status != Transaction.Status.COMPLETED:
        raise ExchangeNotAllowed(
            "The original transaction must be COMPLETED."
        )

    if transaction_obj.customer_id != customer.id:
        raise ExchangeNotAllowed(
            "The customer does not belong to the original transaction."
        )

    item_exists = (
        TransactionItem.objects
        .filter(
            transaction=transaction_obj,
            device=old_device,
        )
        .exists()
    )

    if not item_exists:
        raise ExchangeNotAllowed(
            "The old device was not sold in the original transaction."
        )


# ============================================================
# CREATE
# ============================================================

@transaction.atomic
def create_exchange(
    *,
    customer,
    original_transaction,
    old_device,
    new_device,
    old_device_value,
    new_device_price,
    reason=None,
    actor=None,
):
    """
    Create an exchange request.

    IMPORTANT:
        This function does NOT modify inventory.

    Lifecycle:
        REQUESTED
    """

    if customer is None:
        raise ExchangeNotAllowed(
            "A customer is required for an exchange."
        )

    if original_transaction is None:
        raise ExchangeNotAllowed(
            "An original transaction is required."
        )

    if old_device is None or new_device is None:
        raise ExchangeNotAllowed(
            "Both old and new devices are required."
        )

    if old_device.id == new_device.id:
        raise ExchangeNotAllowed(
            "The old and new devices must be different."
        )

    try:
        old_value = Decimal(str(old_device_value))
        new_price = Decimal(str(new_device_price))
    except (
        TypeError,
        ValueError,
        InvalidOperation,
    ):
        raise ExchangeNotAllowed(
            "Device values must be valid numbers."
        )

    if old_value < Decimal("0.00"):
        raise ExchangeNotAllowed(
            "Old device value cannot be negative."
        )

    if new_price < Decimal("0.00"):
        raise ExchangeNotAllowed(
            "New device price cannot be negative."
        )

    # --------------------------------------------------------
    # Lock devices
    # --------------------------------------------------------

    locked_old_device = (
        DeviceItem.objects
        .select_for_update()
        .filter(pk=old_device.id)
        .first()
    )

    if locked_old_device is None:
        raise ExchangeNotAllowed(
            "Old device does not exist."
        )

    locked_new_device = (
        DeviceItem.objects
        .select_for_update()
        .filter(pk=new_device.id)
        .first()
    )

    if locked_new_device is None:
        raise ExchangeNotAllowed(
            "New device does not exist."
        )

    # Old device must currently be SOLD.
    if locked_old_device.status != DeviceItem.Status.SOLD:
        raise ExchangeNotAllowed(
            "The old device must have status SOLD."
        )

    # New device must currently be IN_STOCK.
    if locked_new_device.status != DeviceItem.Status.IN_STOCK:
        raise ExchangeNotAllowed(
            "The new device must be IN_STOCK."
        )

    # --------------------------------------------------------
    # Validate original sale
    # --------------------------------------------------------

    transaction_obj = (
        Transaction.objects
        .select_for_update()
        .filter(pk=original_transaction.id)
        .first()
    )

    if transaction_obj is None:
        raise ExchangeNotAllowed(
            "The original transaction does not exist."
        )

    _validate_original_transaction(
        transaction_obj=transaction_obj,
        customer=customer,
        old_device=locked_old_device,
    )

    # --------------------------------------------------------
    # Prevent the same SOLD device from being exchanged twice
    # --------------------------------------------------------

    already_exchanged = (
        Exchange.objects
        .filter(
            old_device=locked_old_device,
            status=Exchange.Status.COMPLETED,
        )
        .exists()
    )

    if already_exchanged:
        raise ExchangeNotAllowed(
            "This device has already been exchanged."
        )

    # --------------------------------------------------------
    # Calculate financial difference
    # --------------------------------------------------------

    difference_amount, financial_direction = (
        _calculate_financial_direction(
            old_value,
            new_price,
        )
    )

    exchange = Exchange.objects.create(
        exchange_number=_generate_exchange_number(),
        customer=customer,
        original_transaction=transaction_obj,
        old_device=locked_old_device,
        new_device=locked_new_device,
        old_device_value=old_value,
        new_device_price=new_price,
        difference_amount=difference_amount,
        financial_direction=financial_direction,
        status=Exchange.Status.REQUESTED,
        reason=reason,
        requested_at=timezone.now(),
    )

    return exchange


# ============================================================
# SUBMIT FOR REVIEW
# ============================================================

@transaction.atomic
def submit_exchange_for_review(
    *,
    exchange_id,
    actor,
):
    """
    REQUESTED -> UNDER_REVIEW
    """

    exchange = (
        Exchange.objects
        .select_for_update()
        .filter(pk=exchange_id)
        .first()
    )

    if exchange is None:
        raise ExchangeNotFound(
            f"Exchange {exchange_id} was not found."
        )

    if exchange.status != Exchange.Status.REQUESTED:
        raise ExchangeNotAllowed(
            "Only REQUESTED exchanges can be submitted for review."
        )

    exchange.status = Exchange.Status.UNDER_REVIEW
    exchange.reviewed_by = actor
    exchange.reviewed_at = timezone.now()

    exchange.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "updated_at",
        ]
    )

    return exchange


# ============================================================
# APPROVE
# ============================================================

@transaction.atomic
def approve_exchange(
    *,
    exchange_id,
    actor,
    owner_notes=None,
):
    """
    UNDER_REVIEW -> APPROVED

    Inventory is NOT modified here.
    """

    exchange = (
        Exchange.objects
        .select_for_update()
        .filter(pk=exchange_id)
        .first()
    )

    if exchange is None:
        raise ExchangeNotFound(
            f"Exchange {exchange_id} was not found."
        )

    if exchange.status != Exchange.Status.UNDER_REVIEW:
        raise ExchangeNotAllowed(
            "Only UNDER_REVIEW exchanges can be approved."
        )

    exchange.status = Exchange.Status.APPROVED
    exchange.approved_by = actor
    exchange.approved_at = timezone.now()

    if owner_notes is not None:
        exchange.owner_notes = owner_notes

    update_fields = [
        "status",
        "approved_by",
        "approved_at",
        "updated_at",
    ]

    if owner_notes is not None:
        update_fields.append("owner_notes")

    exchange.save(update_fields=update_fields)

    return exchange


# ============================================================
# REJECT
# ============================================================

@transaction.atomic
def reject_exchange(
    *,
    exchange_id,
    actor,
    reason=None,
):
    """
    REQUESTED / UNDER_REVIEW -> REJECTED
    """

    exchange = (
        Exchange.objects
        .select_for_update()
        .filter(pk=exchange_id)
        .first()
    )

    if exchange is None:
        raise ExchangeNotFound(
            f"Exchange {exchange_id} was not found."
        )

    if exchange.status not in (
        Exchange.Status.REQUESTED,
        Exchange.Status.UNDER_REVIEW,
    ):
        raise ExchangeNotAllowed(
            "Only REQUESTED or UNDER_REVIEW exchanges "
            "can be rejected."
        )

    exchange.status = Exchange.Status.REJECTED

    if reason:
        exchange.reason = reason

    update_fields = [
        "status",
        "updated_at",
    ]

    if reason:
        update_fields.append("reason")

    exchange.save(update_fields=update_fields)

    return exchange


# ============================================================
# COMPLETE
# ============================================================


def _validate_financial_settlement(exchange):
    """
    Verify that the financial side of the exchange is settled
    before inventory is modified.

    CUSTOMER_PAYS:
        Requires a linked EXCHANGE transaction whose
        confirmed payments fully cover the difference.

    STORE_REFUNDS:
        Requires a linked EXCHANGE refund with COMPLETED status.

    EVEN:
        No financial settlement is required.
    """

    # ========================================================
    # EVEN
    # ========================================================

    if (
        exchange.financial_direction
        == Exchange.FinancialDirection.EVEN
    ):
        return

    # ========================================================
    # CUSTOMER PAYS
    # ========================================================

    if (
        exchange.financial_direction
        == Exchange.FinancialDirection.CUSTOMER_PAYS
    ):
        financial_transaction = (
            Transaction.objects
            .select_for_update()
            .filter(
                exchange=exchange,
                transaction_type=Transaction.TransactionType.EXCHANGE,
            )
            .first()
        )

        if financial_transaction is None:
            raise ExchangeNotAllowed(
                "The customer payment has not been created."
            )

        confirmed_amount = (
            financial_transaction.payments
            .filter(
                status=Payment.Status.CONFIRMED,
            )
            .aggregate(
                total=Sum("amount"),
            )["total"]
            or Decimal("0.00")
        )

        if confirmed_amount < exchange.difference_amount:
            raise ExchangeNotAllowed(
                "The exchange cannot be completed because "
                "the required customer payment is not fully confirmed."
            )

        return

    # ========================================================
    # STORE REFUNDS
    # ========================================================

    if (
        exchange.financial_direction
        == Exchange.FinancialDirection.STORE_REFUNDS
    ):
        refund = (
            Refund.objects
            .select_for_update()
            .filter(
                source_type=Refund.SourceType.EXCHANGE,
                source_id=exchange.id,
                status=Refund.Status.COMPLETED,
            )
            .first()
        )

        if refund is None:
            raise ExchangeNotAllowed(
                "The required exchange refund has not been completed."
            )

        if refund.amount < exchange.difference_amount:
            raise ExchangeNotAllowed(
                "The completed refund amount is insufficient "
                "for this exchange."
            )

        return

    raise ExchangeNotAllowed(
        "Unknown exchange financial direction."
    )

@transaction.atomic
def complete_exchange(
    *,
    exchange_id,
    actor,
):
    """
    Complete an approved device-to-device exchange.

    Atomic operation:

        OLD DEVICE:
            SOLD -> IN_STOCK

        NEW DEVICE:
            IN_STOCK -> SOLD

        EXCHANGE:
            APPROVED -> COMPLETED

    Two immutable StockMovement records are created.

    Financial difference is calculated when the exchange is
    created and remains locked on the exchange.
    """

    exchange = (
        Exchange.objects
        .select_for_update()
        .select_related(
            "customer",
            "original_transaction",
        )
        .filter(pk=exchange_id)
        .first()
    )

    if exchange is None:
        raise ExchangeNotFound(
            f"Exchange {exchange_id} was not found."
        )

    if exchange.status != Exchange.Status.APPROVED:
        raise ExchangeNotAllowed(
            "Only APPROVED exchanges can be completed."
        )

        # --------------------------------------------------------
    # FINANCIAL SETTLEMENT
    # --------------------------------------------------------

    _validate_financial_settlement(exchange)

    # --------------------------------------------------------
    # Lock both devices in deterministic order
    # --------------------------------------------------------

    device_ids = sorted([
        exchange.old_device_id,
        exchange.new_device_id,
    ])

    devices = (
        DeviceItem.objects
        .select_for_update()
        .filter(id__in=device_ids)
        .order_by("id")
    )

    device_map = {
        device.id: device
        for device in devices
    }

    old_device = device_map.get(exchange.old_device_id)
    new_device = device_map.get(exchange.new_device_id)

    if old_device is None:
        raise ExchangeNotAllowed(
            "Old device no longer exists."
        )

    if new_device is None:
        raise ExchangeNotAllowed(
            "New device no longer exists."
        )

    # --------------------------------------------------------
    # Re-check inventory at completion time.
    #
    # This is important because approval may happen hours
    # before completion.
    # --------------------------------------------------------

    if old_device.status != DeviceItem.Status.SOLD:
        raise ExchangeNotAllowed(
            "Old device is no longer SOLD. "
            "The exchange cannot be completed."
        )

    if new_device.status != DeviceItem.Status.IN_STOCK:
        raise ExchangeNotAllowed(
            "New device is no longer IN_STOCK. "
            "The exchange cannot be completed."
        )

    # --------------------------------------------------------
    # Re-check that old device belongs to original sale
    # --------------------------------------------------------

    original_transaction = (
        Transaction.objects
        .select_for_update()
        .filter(pk=exchange.original_transaction_id)
        .first()
    )

    if original_transaction is None:
        raise ExchangeNotAllowed(
            "The original transaction no longer exists."
        )

    if original_transaction.status != Transaction.Status.COMPLETED:
        raise ExchangeNotAllowed(
            "The original transaction must remain COMPLETED."
        )

    old_item_exists = (
        TransactionItem.objects
        .filter(
            transaction=original_transaction,
            device=old_device,
        )
        .exists()
    )

    if not old_item_exists:
        raise ExchangeNotAllowed(
            "The old device is not part of the original sale."
        )

    # --------------------------------------------------------
    # OLD DEVICE: SOLD -> IN_STOCK
    # --------------------------------------------------------

    old_previous_status = old_device.status

    old_device.status = DeviceItem.Status.IN_STOCK

    old_device.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    StockMovement.objects.create(
        device=old_device,
        movement_type=StockMovement.MovementType.EXCHANGE_OUT,
        quantity=1,
        from_status=old_previous_status,
        to_status=DeviceItem.Status.IN_STOCK,
        reference_type="Exchange",
        reference_id=exchange.id,
        reason=(
            f"Exchange {exchange.exchange_number}: "
            f"old device returned to stock."
        ),
        created_by=actor,
    )

    # --------------------------------------------------------
    # NEW DEVICE: IN_STOCK -> SOLD
    # --------------------------------------------------------

    new_previous_status = new_device.status

    new_device.status = DeviceItem.Status.SOLD

    new_device.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    StockMovement.objects.create(
        device=new_device,
        movement_type=StockMovement.MovementType.EXCHANGE_IN,
        quantity=1,
        from_status=new_previous_status,
        to_status=DeviceItem.Status.SOLD,
        reference_type="Exchange",
        reference_id=exchange.id,
        reason=(
            f"Exchange {exchange.exchange_number}: "
            f"new device delivered to customer."
        ),
        created_by=actor,
    )

    # --------------------------------------------------------
    # COMPLETE EXCHANGE
    # --------------------------------------------------------

    exchange.status = Exchange.Status.COMPLETED
    exchange.completed_by = actor
    exchange.completed_at = timezone.now()

    exchange.save(
        update_fields=[
            "status",
            "completed_by",
            "completed_at",
            "updated_at",
        ]
    )

    return exchange