from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum

from apps.exchanges.models import Exchange
from apps.payments.models import Payment
from apps.payments.services.payments import create_payment
from apps.refunds.models import Refund
from apps.refunds.services.refunds import (
    approve_refund,
    complete_refund,
    create_refund,
)
from apps.sales.models import Transaction


# ============================================================
# Helpers
# ============================================================


def _get_exchange_or_raise(exchange_id):
    try:
        return (
            Exchange.objects
            .select_for_update()
            .select_related(
                "customer",
                "original_transaction",
            )
            .get(pk=exchange_id)
        )
    except Exchange.DoesNotExist:
        raise ValueError(
            f"Exchange {exchange_id} was not found."
        )


def _get_exchange_financial_transaction(exchange):
    return (
        Transaction.objects
        .select_for_update()
        .filter(
            exchange=exchange,
            transaction_type=Transaction.TransactionType.EXCHANGE,
        )
        .first()
    )


def _get_confirmed_paid_amount(transaction_obj):
    result = (
        transaction_obj.payments
        .filter(status=Payment.Status.CONFIRMED)
        .aggregate(total=Sum("amount"))
    )

    return result["total"] or Decimal("0.00")


# ============================================================
# CUSTOMER PAYS
# ============================================================


@transaction.atomic
def create_exchange_payment(
    *,
    exchange_id,
    amount,
    method,
    actor,
    reference=None,
):
    """
    Create the financial transaction/payment for an exchange
    where the CUSTOMER must pay the difference.

    Example:
        old device = 3500 DH
        new device = 5000 DH
        customer pays = 1500 DH
    """

    exchange = _get_exchange_or_raise(exchange_id)

    if exchange.status != Exchange.Status.APPROVED:
        raise ValueError(
            "Payments can only be created for APPROVED exchanges."
        )

    if (
        exchange.financial_direction
        != Exchange.FinancialDirection.CUSTOMER_PAYS
    ):
        raise ValueError(
            "This exchange does not require a customer payment."
        )

    try:
        amount = Decimal(str(amount))
    except (TypeError, ValueError, InvalidOperation):
        raise ValueError(
            "Payment amount must be a valid number."
        )

    if amount <= Decimal("0.00"):
        raise ValueError(
            "Payment amount must be greater than zero."
        )

    if amount != exchange.difference_amount:
        raise ValueError(
            "Payment amount must exactly match the exchange difference."
        )

    existing_transaction = _get_exchange_financial_transaction(exchange)

    if existing_transaction is not None:
        raise ValueError(
            "A financial transaction already exists for this exchange."
        )

    financial_transaction = Transaction.objects.create(
        receipt_id=f"BP-EX-{exchange.id:06d}",
        customer=exchange.customer,
        exchange=exchange,
        transaction_type=Transaction.TransactionType.EXCHANGE,
        status=Transaction.Status.PENDING_PAYMENT,
        subtotal=amount,
        discount_amount=Decimal("0.00"),
        total_amount=amount,
        notes=(
            f"Financial transaction for exchange "
            f"{exchange.exchange_number}"
        ),
        created_by=actor,
    )

    payment = create_payment(
        sale_id=financial_transaction.id,
        amount=amount,
        method=method,
        actor=actor,
        reference=reference,
    )

    return financial_transaction, payment


# ============================================================
# CUSTOMER PAYMENT STATUS
# ============================================================


@transaction.atomic
def get_exchange_payment_status(
    *,
    exchange_id,
):
    """
    Return the financial transaction and payment status
    associated with a CUSTOMER_PAYS exchange.
    """

    exchange = _get_exchange_or_raise(exchange_id)

    financial_transaction = _get_exchange_financial_transaction(
        exchange
    )

    if financial_transaction is None:
        return {
            "exchange": exchange,
            "transaction": None,
            "confirmed_amount": Decimal("0.00"),
            "fully_paid": False,
        }

    confirmed_amount = _get_confirmed_paid_amount(
        financial_transaction
    )

    return {
        "exchange": exchange,
        "transaction": financial_transaction,
        "confirmed_amount": confirmed_amount,
        "fully_paid": (
            confirmed_amount
            >= financial_transaction.total_amount
        ),
    }


# ============================================================
# STORE REFUND
# ============================================================


@transaction.atomic
def create_exchange_refund(
    *,
    exchange_id,
    method,
    actor,
    reference=None,
    reason=None,
    notes=None,
):
    """
    Create a refund request when the STORE owes money
    to the customer.

    Example:
        old device = 5000 DH
        new device = 4000 DH
        store refunds = 1000 DH
    """

    exchange = _get_exchange_or_raise(exchange_id)

    if exchange.status != Exchange.Status.APPROVED:
        raise ValueError(
            "Refunds can only be created for APPROVED exchanges."
        )

    if (
        exchange.financial_direction
        != Exchange.FinancialDirection.STORE_REFUNDS
    ):
        raise ValueError(
            "This exchange does not require a store refund."
        )

    existing_refund = (
        Refund.objects
        .select_for_update()
        .filter(
            source_type=Refund.SourceType.EXCHANGE,
            source_id=exchange.id,
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
            "A refund already exists for this exchange."
        )

    refund = create_refund(
        customer=exchange.customer,
        source_type=Refund.SourceType.EXCHANGE,
        source_id=exchange.id,
        amount=exchange.difference_amount,
        method=method,
        reason=reason or (
            f"Exchange refund for "
            f"{exchange.exchange_number}"
        ),
        actor=actor,
        reference=reference,
        notes=notes,
    )

    return refund


# ============================================================
# COMPLETE STORE REFUND
# ============================================================


@transaction.atomic
def complete_exchange_refund(
    *,
    refund_id,
    actor,
):
    """
    Approve and complete an EXCHANGE refund.
    """

    refund = (
        Refund.objects
        .select_for_update()
        .get(pk=refund_id)
    )

    if refund.source_type != Refund.SourceType.EXCHANGE:
        raise ValueError(
            "This refund is not an exchange refund."
        )

    if refund.status == Refund.Status.REQUESTED:
        refund = approve_refund(
            refund_id=refund.id,
            actor=actor,
        )

    if refund.status != Refund.Status.APPROVED:
        raise ValueError(
            "Only APPROVED exchange refunds can be completed."
        )

    return complete_refund(
        refund_id=refund.id,
        actor=actor,
    )