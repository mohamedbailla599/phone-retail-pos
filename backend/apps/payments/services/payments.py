from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.payments.models import Payment
from apps.sales.models import Transaction

from core.exceptions import (
    InvalidPayment,
    PaymentAlreadyProcessed,
    PaymentNotFound,
)


def _get_confirmed_paid_amount(transaction_obj):
    """
    Return the total amount already CONFIRMED as paid.

    PENDING, REJECTED and REFUNDED payments do not count
    as paid.
    """

    result = (
        transaction_obj.payments
        .filter(
            status=Payment.Status.CONFIRMED,
        )
        .aggregate(
            total=Sum("amount")
        )
    )

    return result["total"] or Decimal("0.00")


def _get_pending_payment_amount(transaction_obj):
    """
    Return the total amount currently waiting for confirmation.

    Pending bank transfers are not considered paid, but they
    still reserve part of the amount that can be submitted.
    """

    result = (
        transaction_obj.payments
        .filter(
            status=Payment.Status.PENDING,
        )
        .aggregate(
            total=Sum("amount")
        )
    )

    return result["total"] or Decimal("0.00")


def _get_available_payment_amount(transaction_obj):
    """
    Return the amount that can still be submitted as a new payment.

    Confirmed payments are already paid.
    Pending payments are already allocated.
    """

    confirmed = _get_confirmed_paid_amount(transaction_obj)
    pending = _get_pending_payment_amount(transaction_obj)

    available = (
        transaction_obj.total_amount
        - confirmed
        - pending
    )

    return max(
        available,
        Decimal("0.00"),
    )


@transaction.atomic
def create_payment(
    *,
    sale_id,
    amount,
    method,
    actor,
    reference=None,
):
    """
    Create a payment for a PENDING_PAYMENT transaction.

    Supported transaction types:
        - SALE
        - RESERVATION
        - EXCHANGE

    CASH:
        Automatically CONFIRMED.

    BANK_TRANSFER:
        Starts as PENDING and must be confirmed by an owner.

    Inventory is NOT changed.
    Transaction status is NOT changed.
    """

    transaction_obj = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type__in=[
                Transaction.TransactionType.SALE,
                Transaction.TransactionType.RESERVATION,
                Transaction.TransactionType.EXCHANGE,
            ],
        )
        .first()
    )

    if transaction_obj is None:
        raise InvalidPayment(
            "Transaction does not exist."
        )

    if transaction_obj.status != Transaction.Status.PENDING_PAYMENT:
        raise InvalidPayment(
            "Payments can only be created for "
            "PENDING_PAYMENT transactions."
        )

    try:
        amount = Decimal(str(amount))
    except (
        TypeError,
        ValueError,
        InvalidOperation,
    ):
        raise InvalidPayment(
            "Payment amount must be a valid number."
        )

    if amount <= 0:
        raise InvalidPayment(
            "Payment amount must be greater than zero."
        )

    if method not in (
        Payment.Method.CASH,
        Payment.Method.BANK_TRANSFER,
    ):
        raise InvalidPayment(
            "Unsupported payment method."
        )

    available_amount = _get_available_payment_amount(
        transaction_obj
    )

    if available_amount <= 0:
        raise InvalidPayment(
            "No additional payment can be added "
            "to this transaction."
        )

    if amount > available_amount:
        raise InvalidPayment(
            "Payment amount exceeds the remaining "
            "payable amount."
        )

    if method == Payment.Method.CASH:
        status = Payment.Status.CONFIRMED
        confirmed_by = actor
        confirmed_at = timezone.now()

    else:
        status = Payment.Status.PENDING
        confirmed_by = None
        confirmed_at = None

    payment = Payment.objects.create(
        transaction=transaction_obj,
        amount=amount,
        method=method,
        status=status,
        reference=reference,
        created_by=actor,
        confirmed_by=confirmed_by,
        confirmed_at=confirmed_at,
    )

    return payment


@transaction.atomic
def confirm_bank_transfer(
    *,
    payment_id,
    actor,
):
    """
    Confirm a pending bank-transfer payment.

    Only owners can confirm bank transfers.

    Confirmation represents verification of the actual
    bank account, not merely a customer-provided screenshot.
    """

    if actor is None or actor.role != actor.Role.OWNER:
        raise InvalidPayment(
            "Only owners can confirm bank transfers."
        )

    payment = (
        Payment.objects
        .select_for_update()
        .select_related("transaction")
        .filter(id=payment_id)
        .first()
    )

    if payment is None:
        raise PaymentNotFound(
            "Payment does not exist."
        )

    if payment.status != Payment.Status.PENDING:
        raise PaymentAlreadyProcessed(
            "This payment has already been processed."
        )

    if payment.method != Payment.Method.BANK_TRANSFER:
        raise InvalidPayment(
            "Only bank-transfer payments can be confirmed manually."
        )

    payment.status = Payment.Status.CONFIRMED
    payment.confirmed_by = actor
    payment.confirmed_at = timezone.now()

    payment.save(
        update_fields=[
            "status",
            "confirmed_by",
            "confirmed_at",
        ]
    )

    return payment


@transaction.atomic
def reject_bank_transfer(
    *,
    payment_id,
    actor,
):
    """
    Reject a pending bank-transfer payment.

    Only owners can reject bank transfers.
    """

    if actor is None or actor.role != actor.Role.OWNER:
        raise InvalidPayment(
            "Only owners can reject bank transfers."
        )

    payment = (
        Payment.objects
        .select_for_update()
        .filter(id=payment_id)
        .first()
    )

    if payment is None:
        raise PaymentNotFound(
            "Payment does not exist."
        )

    if payment.status != Payment.Status.PENDING:
        raise PaymentAlreadyProcessed(
            "This payment has already been processed."
        )

    if payment.method != Payment.Method.BANK_TRANSFER:
        raise InvalidPayment(
            "Only bank-transfer payments can be rejected manually."
        )

    payment.status = Payment.Status.REJECTED
    payment.rejected_at = timezone.now()

    payment.save(
        update_fields=[
            "status",
            "rejected_at",
        ]
    )

    return payment