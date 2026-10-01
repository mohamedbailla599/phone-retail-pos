from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.payments.models import Payment
from apps.refunds.models import Refund, RefundPaymentAllocation
from apps.returns.models import Return


def _generate_refund_number():
    year = timezone.now().year

    last_refund = (
        Refund.objects
        .filter(
            refund_number__startswith=f"BP-RF-{year}-"
        )
        .order_by("-id")
        .first()
    )

    if last_refund:
        last_number = int(
            last_refund.refund_number.rsplit("-", 1)[-1]
        )
        next_number = last_number + 1
    else:
        next_number = 1

    return f"BP-RF-{year}-{next_number:06d}"


def _get_return_transaction(return_record):
    """
    Return the original sale transaction associated with a Return.
    """

    transaction_obj = return_record.transaction

    if transaction_obj.transaction_type != transaction_obj.TransactionType.SALE:
        raise ValueError(
            "Refunds for returns must reference a SALE transaction."
        )

    return transaction_obj


def _get_payment_refunded_amount(payment):
    """
    Return how much of a payment has already been allocated
    to completed refunds.
    """

    result = (
        RefundPaymentAllocation.objects
        .filter(
            payment=payment,
            refund__status=Refund.Status.COMPLETED,
        )
        .aggregate(
            total=Sum("amount")
        )
    )

    return result["total"] or Decimal("0.00")


def _get_payment_remaining_refundable_amount(payment):
    """
    Return the amount of this payment that can still be refunded.
    """

    refunded_amount = _get_payment_refunded_amount(payment)

    return max(
        payment.amount - refunded_amount,
        Decimal("0.00"),
    )


def _allocate_refund_to_payments(refund, transaction_obj):
    """
    Allocate a completed refund across confirmed payments.

    Payments are processed in creation order.

    Partial allocation is supported.

    A payment becomes REFUNDED only when its entire
    original amount has been refunded.
    """

    remaining_refund = refund.amount

    payments = (
        Payment.objects
        .select_for_update()
        .filter(
            transaction=transaction_obj,
            status=Payment.Status.CONFIRMED,
        )
        .order_by("created_at", "id")
    )

    for payment in payments:
        if remaining_refund <= Decimal("0.00"):
            break

        remaining_payment = (
            _get_payment_remaining_refundable_amount(payment)
        )

        if remaining_payment <= Decimal("0.00"):
            continue

        allocation_amount = min(
            remaining_refund,
            remaining_payment,
        )

        RefundPaymentAllocation.objects.create(
            refund=refund,
            payment=payment,
            amount=allocation_amount,
        )

        remaining_refund -= allocation_amount

        total_refunded_for_payment = (
            _get_payment_refunded_amount(payment)
            + allocation_amount
        )

        if total_refunded_for_payment >= payment.amount:
            payment.status = Payment.Status.REFUNDED

            payment.save(
                update_fields=["status"]
            )

    if remaining_refund > Decimal("0.00"):
        raise ValueError(
            "Refund amount exceeds the remaining refundable "
            "amount of confirmed payments."
        )


@transaction.atomic
def create_refund(
    *,
    customer,
    source_type,
    source_id,
    amount,
    method,
    reason,
    actor,
    reference=None,
    notes=None,
):
    """
    Create a refund request.

    For RETURN refunds:
        - The Return must exist.
        - The Return must be RESTOCKED.
        - The refund amount cannot exceed the Return total.
        - The refund amount cannot exceed the amount paid.
        - Only one refund can exist for a Return.

    The refund starts as REQUESTED.
    No payment allocation happens yet.
    """

    amount = Decimal(str(amount))

    if amount <= Decimal("0.00"):
        raise ValueError(
            "Refund amount must be greater than zero."
        )

    if source_type == Refund.SourceType.RETURN:
        return_record = (
            Return.objects
            .select_for_update()
            .select_related("transaction")
            .get(pk=source_id)
        )

        if return_record.status != Return.Status.RESTOCKED:
            raise ValueError(
                "A return must be RESTOCKED before "
                "a refund can be created."
            )

        if return_record.customer_id != customer.id:
            raise ValueError(
                "Refund customer does not match "
                "the return customer."
            )

        if amount > return_record.total_amount:
            raise ValueError(
                "Refund amount cannot exceed "
                "the return amount."
            )

        transaction_obj = _get_return_transaction(
            return_record
        )

        confirmed_paid = (
            transaction_obj.payments
            .filter(
                status=Payment.Status.CONFIRMED
            )
            .aggregate(
                total=Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        if amount > confirmed_paid:
            raise ValueError(
                "Refund amount cannot exceed "
                "the confirmed amount paid."
            )

        existing_refund = (
            Refund.objects
            .select_for_update()
            .filter(
                source_type=Refund.SourceType.RETURN,
                source_id=return_record.id,
                status__in=[
                    Refund.Status.REQUESTED,
                    Refund.Status.APPROVED,
                    Refund.Status.COMPLETED,
                ],
            )
            .first()
        )

        if existing_refund is not None:
            raise ValueError(
                "A refund already exists for this return."
            )

    refund = Refund.objects.create(
        refund_number=_generate_refund_number(),
        customer=customer,
        source_type=source_type,
        source_id=source_id,
        amount=amount,
        method=method,
        status=Refund.Status.REQUESTED,
        reference=reference,
        reason=reason,
        notes=notes,
        requested_by=actor,
        requested_at=timezone.now(),
    )

    return refund


@transaction.atomic
def approve_refund(
    *,
    refund_id,
    actor,
):
    """
    Approve a requested refund.
    """

    refund = (
        Refund.objects
        .select_for_update()
        .get(pk=refund_id)
    )

    if refund.status != Refund.Status.REQUESTED:
        raise ValueError(
            "Only REQUESTED refunds can be approved."
        )

    refund.status = Refund.Status.APPROVED
    refund.approved_by = actor
    refund.approved_at = timezone.now()

    refund.save(
        update_fields=[
            "status",
            "approved_by",
            "approved_at",
            "updated_at",
        ]
    )

    return refund


@transaction.atomic
def complete_refund(
    *,
    refund_id,
    actor,
):
    """
    Complete an approved refund.

    For RETURN refunds:

        RESTOCKED
            ↓
        payment allocation
            ↓
        Refund COMPLETED
            ↓
        Return REFUNDED

    Payment allocation and status updates happen
    atomically with the refund.
    """

    refund = (
        Refund.objects
        .select_for_update()
        .get(pk=refund_id)
    )

    if refund.status != Refund.Status.APPROVED:
        raise ValueError(
            "Only APPROVED refunds can be completed."
        )

    if refund.source_type == Refund.SourceType.RETURN:
        return_record = (
            Return.objects
            .select_for_update()
            .select_related("transaction")
            .get(pk=refund.source_id)
        )

        if return_record.status != Return.Status.RESTOCKED:
            raise ValueError(
                "The return must be RESTOCKED before "
                "the refund can be completed."
            )

        if refund.amount > return_record.total_amount:
            raise ValueError(
                "Refund amount exceeds the return amount."
            )

        transaction_obj = _get_return_transaction(
            return_record
        )

        # Allocate the refund against the original
        # confirmed payment(s).
        _allocate_refund_to_payments(
            refund,
            transaction_obj,
        )

        refund.status = Refund.Status.COMPLETED
        refund.completed_by = actor
        refund.completed_at = timezone.now()

        refund.save(
            update_fields=[
                "status",
                "completed_by",
                "completed_at",
                "updated_at",
            ]
        )

        return_record.status = Return.Status.REFUNDED
        return_record.completed_at = timezone.now()

        return_record.save(
            update_fields=[
                "status",
                "completed_at",
            ]
        )

        return refund

    # Future non-return refund sources.
    refund.status = Refund.Status.COMPLETED
    refund.completed_by = actor
    refund.completed_at = timezone.now()

    refund.save(
        update_fields=[
            "status",
            "completed_by",
            "completed_at",
            "updated_at",
        ]
    )

    return refund


@transaction.atomic
def reject_refund(
    *,
    refund_id,
    actor,
    reason=None,
):
    """
    Reject a requested refund.
    """

    refund = (
        Refund.objects
        .select_for_update()
        .get(pk=refund_id)
    )

    if refund.status != Refund.Status.REQUESTED:
        raise ValueError(
            "Only REQUESTED refunds can be rejected."
        )

    refund.status = Refund.Status.REJECTED
    refund.rejected_by = actor
    refund.rejected_at = timezone.now()

    if reason:
        refund.reason = reason

    refund.save(
        update_fields=[
            "status",
            "rejected_by",
            "rejected_at",
            "reason",
            "updated_at",
        ]
    )

    return refund