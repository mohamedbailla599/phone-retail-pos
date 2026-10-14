from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from apps.audit.models import AuditLog
from apps.audit.services import record_audit
from apps.inventory.services.inventory import (
    return_device_to_stock,
    adjust_accessory_stock,
)
from apps.returns.models import Return, ReturnItem
from apps.sales.models import Transaction, TransactionItem


def _generate_return_number():
    year = timezone.now().year

    last_return = (
        Return.objects
        .filter(
            return_number__startswith=f"BP-RET-{year}-"
        )
        .order_by("-id")
        .first()
    )

    if last_return:
        last_number = int(
            last_return.return_number.rsplit("-", 1)[-1]
        )
        next_number = last_number + 1
    else:
        next_number = 1

    return f"BP-RET-{year}-{next_number:06d}"


def _get_already_returned_quantity(transaction_item):
    """
    Return the quantity already associated with
    non-rejected returns for this transaction item.
    """

    return (
        ReturnItem.objects
        .filter(
            transaction_item=transaction_item,
            return_record__status__in=[
                Return.Status.REQUESTED,
                Return.Status.APPROVED,
                Return.Status.RESTOCKED,
                Return.Status.REFUNDED,
            ],
        )
        .aggregate(total=Sum("quantity"))["total"]
        or 0
    )


@transaction.atomic
def create_return(
    *,
    transaction_id,
    transaction_item_id,
    quantity,
    actor,
    reason="",
):
    """
    Create a return request for one transaction item.

    Inventory is NOT modified here.
    Refund is NOT created here.

    This function only validates the sale/item and creates
    the Return + ReturnItem records.
    """

    if quantity <= 0:
        raise ValueError(
            "Return quantity must be greater than zero."
        )

    transaction_obj = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=transaction_id,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
        )
        .first()
    )

    if transaction_obj is None:
        raise ValueError(
            "Returns are only allowed for completed sales."
        )

    transaction_item = (
        TransactionItem.objects
        .select_for_update()
        .filter(
            id=transaction_item_id,
            transaction_id=transaction_obj.id,
        )
        .first()
    )

    if transaction_item is None:
        raise ValueError(
            "The transaction item does not belong to this sale."
        )

    if quantity > transaction_item.quantity:
        raise ValueError(
            "Return quantity cannot exceed the sold quantity."
        )

    already_returned = _get_already_returned_quantity(
        transaction_item
    )

    remaining_quantity = (
        transaction_item.quantity - already_returned
    )

    if quantity > remaining_quantity:
        raise ValueError(
            "Return quantity exceeds the remaining returnable quantity."
        )

    unit_refund_amount = transaction_item.price_sold
    line_total = unit_refund_amount * quantity

    return_record = Return.objects.create(
        return_number=_generate_return_number(),
        transaction=transaction_obj,
        customer=transaction_obj.customer,
        status=Return.Status.REQUESTED,
        reason=reason,
        total_amount=line_total,
        created_by=actor,
    )

    ReturnItem.objects.create(
        return_record=return_record,
        transaction_item=transaction_item,
        quantity=quantity,
        unit_refund_amount=unit_refund_amount,
        line_total=line_total,
    )

    record_audit(
        actor=actor,
        action=AuditLog.Action.RETURN_CREATED,
        entity_type="Return",
        entity_id=return_record.id,
        reason=reason,
    )

    return return_record

@transaction.atomic
def approve_return(*, return_id, actor):
    return_record = (
        Return.objects
        .select_for_update()
        .select_related("transaction")
        .get(pk=return_id)
    )

    if return_record.status != Return.Status.REQUESTED:
        raise ValueError(
            "Only REQUESTED returns can be approved."
        )

    return_record.status = Return.Status.APPROVED
    return_record.approved_by = actor

    return_record.save(
        update_fields=[
            "status",
            "approved_by",
        ]
    )

    record_audit(
        actor=actor,
        action=AuditLog.Action.RETURN_APPROVED,
        entity_type="Return",
        entity_id=return_record.id,
    )

    return return_record


@transaction.atomic
def process_return_restock(*, return_id, actor, reason=None):
    return_record = (
        Return.objects
        .select_for_update()
        .prefetch_related("items")
        .get(pk=return_id)
    )

    if return_record.status != Return.Status.APPROVED:
        raise ValueError(
            "Only APPROVED returns can be processed."
        )

    return_items = list(return_record.items.all())

    if not return_items:
        raise ValueError(
            "Return has no items."
        )

    for return_item in return_items:
        transaction_item = (
            TransactionItem.objects
            .select_for_update()
            .get(pk=return_item.transaction_item_id)
        )

        if transaction_item.device_id is not None:
            return_device_to_stock(
                device_id=transaction_item.device_id,
                actor=actor,
                reference_type="Return",
                reference_id=return_record.id,
                reason=reason or return_record.reason,
            )
        elif transaction_item.accessory_stock_id is not None:
            adjust_accessory_stock(
                accessory_stock_id=transaction_item.accessory_stock_id,
                quantity_delta=return_item.quantity,
                actor=actor,
                reason=reason or f"Retour client {return_record.return_number}",
                reference_type="Return",
                reference_id=return_record.id,
            )
        else:
            raise ValueError("Item has neither device nor accessory stock reference.")

    return_record.status = Return.Status.RESTOCKED
    return_record.save(update_fields=["status"])

    record_audit(
        actor=actor,
        action=AuditLog.Action.RETURN_COMPLETED,
        entity_type="Return",
        entity_id=return_record.id,
        reason=reason or return_record.reason,
    )

    return return_record


def process_device_return(*, return_id, actor, reason=None):
    """Backwards-compatible alias for process_return_restock."""
    record = process_return_restock(return_id=return_id, actor=actor, reason=reason)
    return record, None


@transaction.atomic
def reject_return(*, return_id, actor, reason=None):
    return_record = (
        Return.objects
        .select_for_update()
        .get(pk=return_id)
    )

    if return_record.status not in [Return.Status.REQUESTED, Return.Status.APPROVED]:
        raise ValueError(
            "Only REQUESTED or APPROVED returns can be rejected."
        )

    return_record.status = Return.Status.REJECTED
    if reason:
        return_record.reason = f"{return_record.reason}\n[Rejet]: {reason}".strip()
    return_record.completed_at = timezone.now()
    return_record.save(update_fields=["status", "reason", "completed_at"])

    record_audit(
        actor=actor,
        action=AuditLog.Action.RETURN_REJECTED,
        entity_type="Return",
        entity_id=return_record.id,
        reason=reason or "Return rejected",
    )

    return return_record