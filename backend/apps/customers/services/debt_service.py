from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.customers.models import Customer, CustomerDebtPayment


@transaction.atomic
def record_debt_payment(
    customer_id: int,
    amount: Decimal,
    payment_method: str = CustomerDebtPayment.Method.CASH,
    notes: str = "",
    operator=None,
):
    """
    Record a debt repayment/deposit from a customer, deduct from customer's current_debt,
    and persist a CustomerDebtPayment audit record.
    """
    if amount <= Decimal("0.00"):
        raise ValidationError("Le montant du versement doit être supérieur à 0.")

    customer = (
        Customer.objects
        .select_for_update()
        .filter(id=customer_id)
        .first()
    )

    if not customer:
        raise ValidationError("Client introuvable.")

    if customer.current_debt <= Decimal("0.00"):
        raise ValidationError("Ce client n'a aucune dette en cours.")

    if amount > customer.current_debt:
        raise ValidationError(
            f"Le montant ({amount} DH) dépasse la dette actuelle ({customer.current_debt} DH)."
        )

    # Create payment record
    payment = CustomerDebtPayment.objects.create(
        customer=customer,
        amount=amount,
        payment_method=payment_method,
        notes=notes or "Règlement de dette",
        operator=operator,
    )

    # Deduct debt
    customer.current_debt -= amount
    customer.save(update_fields=["current_debt", "updated_at"])

    return payment, customer


@transaction.atomic
def add_customer_debt(
    customer_id: int,
    amount: Decimal,
    reason: str = "",
):
    """
    Add debt to a customer (e.g. from an unpaid credit sale balance).
    """
    if amount <= Decimal("0.00"):
        return None

    customer = (
        Customer.objects
        .select_for_update()
        .filter(id=customer_id)
        .first()
    )

    if not customer:
        return None

    customer.current_debt += amount
    customer.save(update_fields=["current_debt", "updated_at"])
    return customer
