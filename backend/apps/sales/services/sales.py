from calendar import monthrange
from decimal import Decimal, InvalidOperation

from django.db import models, transaction
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import AccessoryStock, DeviceItem, StockMovement
from apps.sales.models import Transaction, TransactionItem
from apps.store_settings.models import StoreSettings
from core.exceptions import (
    DeviceNotAvailable,
    DeviceNotFound,
    InvalidSale,
    InvalidSaleItem,
    InsufficientAccessoryStock,
    InsufficientPayment,
    PriceBelowMinimum,
)


def _get_store_settings():
    """
    Return the singleton store settings.
    """
    settings = StoreSettings.objects.first()

    if settings is None:
        raise RuntimeError(
            "Store settings have not been configured."
        )

    return settings


def _calculate_sale_subtotal(transaction_obj):
    """
    Calculate the subtotal from all sale items.
    """
    subtotal = sum(
        item.line_total
        for item in transaction_obj.items.all()
    )

    transaction_obj.subtotal = subtotal

    return subtotal


@transaction.atomic
def create_sale(
    *,
    actor,
    customer=None,
    notes=None,
):
    """
    Create an empty SALE transaction in DRAFT status.

    No inventory is changed.
    No payment is created.
    No TransactionItem is created.
    """
    settings = _get_store_settings()

    transaction_obj = Transaction.objects.create(
        receipt_id="PENDING",
        customer=customer,
        transaction_type=Transaction.TransactionType.SALE,
        status=Transaction.Status.DRAFT,
        subtotal=0,
        discount_amount=0,
        total_amount=0,
        notes=notes,
        created_by=actor,
    )

    year = timezone.localtime().year

    receipt_id = (
        f"{settings.receipt_prefix}-"
        f"{year}-"
        f"{transaction_obj.id:06d}"
    )

    transaction_obj.receipt_id = receipt_id

    transaction_obj.save(
        update_fields=["receipt_id"]
    )

    return transaction_obj


@transaction.atomic
def add_device_to_sale(
    *,
    sale_id,
    device_id,
    actor,
    price_sold=None,
):
    """
    Add one physical device to a DRAFT sale.

    Inventory is NOT changed here.

    The device must:

    - exist
    - be IN_STOCK
    - not already belong to this sale
    - respect its minimum selling price
    """
    sale = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type=Transaction.TransactionType.SALE,
        )
        .first()
    )

    if sale is None:
        raise InvalidSale(
            "Sale does not exist."
        )

    if sale.status != Transaction.Status.DRAFT:
        raise InvalidSale(
            "Only DRAFT sales can be modified."
        )

    device = (
        DeviceItem.objects
        .select_for_update()
        .select_related("product")
        .filter(id=device_id)
        .first()
    )

    if device is None:
        raise DeviceNotFound(
            "Device does not exist."
        )

    if device.status != DeviceItem.Status.IN_STOCK:
        raise DeviceNotAvailable(
            "Device is not available for sale."
        )

    already_in_sale = (
        TransactionItem.objects
        .filter(
            transaction=sale,
            device=device,
        )
        .exists()
    )

    if already_in_sale:
        raise InvalidSaleItem(
            "This device is already in the sale."
        )

    if price_sold is None:
        final_price = device.default_selling_price
    else:
        final_price = price_sold

    if final_price < device.minimum_selling_price:
        raise PriceBelowMinimum(
            "Selling price is below the device minimum selling price."
        )

    item = TransactionItem.objects.create(
        transaction=sale,
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

    subtotal = _calculate_sale_subtotal(sale)

    sale.total_amount = (
        subtotal - sale.discount_amount
    )

    sale.save(
        update_fields=[
            "subtotal",
            "total_amount",
            "updated_at",
        ]
    )

    return item


@transaction.atomic
def add_accessory_to_sale(
    *,
    sale_id,
    accessory_stock_id,
    quantity,
    actor,
    price_sold=None,
    is_complimentary=False,
):
    """
    Add accessory stock to a DRAFT sale.

    Inventory is NOT changed here.

    One AccessoryStock corresponds to one cart line.
    Adding the same accessory again increases the
    existing line quantity.

    Rules:

    - quantity must be positive
    - total cart quantity cannot exceed available stock
    - sale must be DRAFT
    - negotiated price has no minimum-price rule in V1
    - negative selling prices are forbidden
    - complimentary accessory has price_sold = 0
    """
    if quantity <= 0:
        raise InvalidSaleItem(
            "Accessory quantity must be greater than zero."
        )

    sale = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type=Transaction.TransactionType.SALE,
        )
        .first()
    )

    if sale is None:
        raise InvalidSale(
            "Sale does not exist."
        )

    if sale.status != Transaction.Status.DRAFT:
        raise InvalidSale(
            "Only DRAFT sales can be modified."
        )

    accessory_stock = (
        AccessoryStock.objects
        .select_for_update()
        .select_related("product")
        .filter(id=accessory_stock_id)
        .first()
    )

    if accessory_stock is None:
        raise InvalidSaleItem(
            "Accessory stock does not exist."
        )

    if price_sold is not None and price_sold < 0:
        raise InvalidSaleItem(
            "Accessory selling price cannot be negative."
        )

    existing_item = (
        TransactionItem.objects
        .select_for_update()
        .filter(
            transaction=sale,
            accessory_stock=accessory_stock,
        )
        .first()
    )

    current_cart_quantity = (
        existing_item.quantity
        if existing_item
        else 0
    )

    required_quantity = (
        current_cart_quantity + quantity
    )

    if accessory_stock.quantity < required_quantity:
        raise InsufficientAccessoryStock(
            "Insufficient accessory stock for the total cart quantity."
        )

    if is_complimentary:
        final_price = 0

    elif price_sold is None:
        final_price = accessory_stock.selling_price

    else:
        final_price = price_sold

    if existing_item is not None:

        if existing_item.is_complimentary != is_complimentary:
            raise InvalidSaleItem(
                "The existing accessory line uses a different pricing mode."
            )

        new_quantity = (
            existing_item.quantity + quantity
        )

        existing_item.quantity = new_quantity
        existing_item.price_sold = final_price
        existing_item.line_total = (
            final_price * new_quantity
        )

        existing_item.save(
            update_fields=[
                "quantity",
                "price_sold",
                "line_total",
            ]
        )

        item = existing_item

    else:

        item = TransactionItem.objects.create(
            transaction=sale,
            device=None,
            accessory_stock=accessory_stock,
            product_name_snapshot=accessory_stock.product.name,
            sku_snapshot=accessory_stock.product.sku,
            quantity=quantity,
            unit_price=accessory_stock.selling_price,
            price_sold=final_price,
            line_total=final_price * quantity,
            cost_price_at_sale=accessory_stock.cost_price,
            is_complimentary=is_complimentary,
        )

    subtotal = _calculate_sale_subtotal(sale)

    sale.total_amount = (
        subtotal - sale.discount_amount
    )

    sale.save(
        update_fields=[
            "subtotal",
            "total_amount",
            "updated_at",
        ]
    )

    return item

@transaction.atomic
def remove_sale_item(
    *,
    sale_id,
    item_id,
    actor,
    quantity=None,
):
    """
    Remove an item from a DRAFT sale.

    Device:
        The complete item is removed.
        `quantity` must not be provided.

    Accessory:
        If quantity is provided, remove that quantity.
        If quantity is None, remove the complete line.

    Inventory is NOT changed here.
    """

    sale = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type=Transaction.TransactionType.SALE,
        )
        .first()
    )

    if sale is None:
        raise InvalidSale(
            "Sale does not exist."
        )

    if sale.status != Transaction.Status.DRAFT:
        raise InvalidSale(
            "Only DRAFT sales can be modified."
        )

    item = (
        TransactionItem.objects
        .select_for_update()
        .filter(
            id=item_id,
            transaction=sale,
        )
        .first()
    )

    if item is None:
        raise InvalidSaleItem(
            "Sale item does not exist."
        )

    # ---------------------------------------------------------
    # DEVICE
    # ---------------------------------------------------------
    if item.device is not None:

        if quantity is not None:
            raise InvalidSaleItem(
                "Device quantity cannot be partially removed."
            )

        item.delete()

    # ---------------------------------------------------------
    # ACCESSORY
    # ---------------------------------------------------------
    elif item.accessory_stock is not None:

        if quantity is None:
            item.delete()

        else:

            if quantity <= 0:
                raise InvalidSaleItem(
                    "Removal quantity must be greater than zero."
                )

            if quantity > item.quantity:
                raise InvalidSaleItem(
                    "Cannot remove more than the cart quantity."
                )

            remaining_quantity = (
                item.quantity - quantity
            )

            if remaining_quantity == 0:
                item.delete()

            else:
                item.quantity = remaining_quantity
                item.line_total = (
                    item.price_sold * remaining_quantity
                )

                item.save(
                    update_fields=[
                        "quantity",
                        "line_total",
                    ]
                )

    else:
        raise InvalidSaleItem(
            "Sale item has no valid stock reference."
        )

    # ---------------------------------------------------------
    # RECALCULATE SALE TOTALS
    # ---------------------------------------------------------

    subtotal = _calculate_sale_subtotal(sale)

    # Removing an item invalidates the existing sale discount.
    sale.discount_amount = Decimal("0.00")

    sale.subtotal = subtotal
    sale.total_amount = subtotal

    sale.save(
        update_fields=[
            "subtotal",
            "discount_amount",
            "total_amount",
            "updated_at",
        ]
    )

    return sale


@transaction.atomic
def update_sale_item_price(
    *,
    sale_id,
    item_id,
    new_price,
    actor,
):
    """
    Update the negotiated selling price of a DRAFT sale item.

    Rules:
    - OWNER only.
    - Sale must be DRAFT.
    - Device price cannot go below minimum_selling_price.
    - Accessory price must be greater than zero.
    - Complimentary pricing must be handled explicitly elsewhere.
    - unit_price remains unchanged.
    - price_sold and line_total are updated.
    - Inventory is not changed.
    - Audit is handled when the sale is completed.
    """

    if actor is None or actor.role != actor.Role.OWNER:
        raise InvalidSale(
            "Only owners can negotiate sale item prices."
        )

    try:
        new_price = Decimal(str(new_price))
    except (TypeError, ValueError, InvalidOperation):
        raise InvalidSaleItem(
            "Sale item price must be a valid number."
        )

    if new_price <= 0:
        raise InvalidSaleItem(
            "Sale item price must be greater than zero."
        )

    sale = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type=Transaction.TransactionType.SALE,
        )
        .first()
    )

    if sale is None:
        raise InvalidSale("Sale does not exist.")

    if sale.status != Transaction.Status.DRAFT:
        raise InvalidSale(
            "Only DRAFT sales can be modified."
        )

    item = (
    TransactionItem.objects
    .select_for_update()
    .filter(
        id=item_id,
        transaction=sale,
    )
    .first()
)

    if item is None:
        raise InvalidSaleItem(
            "Sale item does not exist."
        )

    if item.device is not None:
        if new_price < item.device.minimum_selling_price:
            raise PriceBelowMinimum(
                "Device price cannot be below the minimum selling price."
            )

    elif item.accessory_stock is not None:
        # Accessory prices must remain strictly positive.
        # Complimentary pricing must be handled explicitly.
        if new_price <= 0:
            raise InvalidSaleItem(
                "Accessory price must be greater than zero."
            )

    else:
        raise InvalidSaleItem(
            "Sale item has no valid stock reference."
        )

    item.price_sold = new_price
    item.line_total = new_price * item.quantity

    item.save(
        update_fields=[
            "price_sold",
            "line_total",
        ]
    )

    subtotal = _calculate_sale_subtotal(sale)

    if sale.discount_amount > subtotal:
        sale.discount_amount = Decimal("0.00")

    sale.total_amount = subtotal - sale.discount_amount

    sale.save(
        update_fields=[
            "subtotal",
            "discount_amount",
            "total_amount",
            "updated_at",
        ]
    )

    return item

@transaction.atomic
def set_sale_discount(
    *,
    sale_id,
    discount_amount,
    actor,
):
    """
    Set or remove the fixed discount of a DRAFT sale.

    Rules:
    - OWNER only.
    - SALE transactions only.
    - Sale must be DRAFT.
    - Discount is a fixed monetary amount.
    - Discount cannot be negative.
    - Discount cannot exceed the current subtotal.
    - 0 removes the discount.
    - Inventory is not changed.
    - Transaction items are not changed.
    - No audit is created at this stage.
    """

    if actor is None or actor.role != actor.Role.OWNER:
        raise InvalidSale(
            "Only owners can apply sale discounts."
        )

    try:
        discount_amount = Decimal(str(discount_amount))
    except (TypeError, ValueError, InvalidOperation):
        raise InvalidSale(
            "Discount amount must be a valid number."
        )

    if discount_amount < 0:
        raise InvalidSale(
            "Discount amount cannot be negative."
        )

    sale = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type=Transaction.TransactionType.SALE,
        )
        .first()
    )

    if sale is None:
        raise InvalidSale(
            "Sale does not exist."
        )

    if sale.status != Transaction.Status.DRAFT:
        raise InvalidSale(
            "Only DRAFT sales can be modified."
        )

    # Always calculate from actual transaction items.
    subtotal = _calculate_sale_subtotal(sale)

    if discount_amount > subtotal:
        raise InvalidSale(
            "Discount cannot exceed the sale subtotal."
        )

    sale.discount_amount = discount_amount
    sale.subtotal = subtotal
    sale.total_amount = subtotal - discount_amount

    sale.save(
        update_fields=[
            "subtotal",
            "discount_amount",
            "total_amount",
            "updated_at",
        ]
    )

    return sale


@transaction.atomic
def move_sale_to_pending_payment(
    *,
    sale_id,
    actor,
):
    """
    Move a SALE from DRAFT to PENDING_PAYMENT.

    Rules:
    - SALE transactions only.
    - Sale must be DRAFT.
    - Sale must contain at least one item.
    - Inventory is NOT changed.
    - Payments are NOT created.
    - Sale totals are recalculated from actual items.
    """

    sale = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type=Transaction.TransactionType.SALE,
        )
        .first()
    )

    if sale is None:
        raise InvalidSale(
            "Sale does not exist."
        )

    if sale.status != Transaction.Status.DRAFT:
        raise InvalidSale(
            "Only DRAFT sales can be moved to PENDING_PAYMENT."
        )

    if not sale.items.exists():
        raise InvalidSale(
            "A sale must contain at least one item."
        )

    # Always recalculate from actual transaction items.
    subtotal = _calculate_sale_subtotal(sale)

    if sale.discount_amount > subtotal:
        sale.discount_amount = Decimal("0.00")

    sale.subtotal = subtotal
    sale.total_amount = subtotal - sale.discount_amount
    sale.status = Transaction.Status.PENDING_PAYMENT

    sale.save(
        update_fields=[
            "status",
            "subtotal",
            "discount_amount",
            "total_amount",
            "updated_at",
        ]
    )

    return sale

def _add_calendar_months(value, months):
    """Add calendar months while keeping the date valid."""
    if months <= 0:
        return value

    total_months = value.year * 12 + (value.month - 1) + months
    year = total_months // 12
    month = total_months % 12 + 1
    day = min(value.day, monthrange(year, month)[1])

    return value.replace(year=year, month=month, day=day)


@transaction.atomic
def complete_sale(
    *,
    sale_id,
    actor,
):
    """
    Complete a SALE atomically after full confirmed payment.

    The complete operation is one database transaction:

    - sale must be PENDING_PAYMENT
    - confirmed payments must cover the sale total
    - all stock targets are locked and revalidated
    - device inventory moves to SOLD
    - accessory inventory is decremented
    - stock movements are created
    - warranty dates are snapshotted on TransactionItem
    - customer total_spent is updated
    - sale moves to COMPLETED

    If any validation fails, every change is rolled back.
    """

    sale = (
        Transaction.objects
        .select_for_update()
        .filter(
            id=sale_id,
            transaction_type=Transaction.TransactionType.SALE,
        )
        .first()
    )

    if sale is None:
        raise InvalidSale("Sale does not exist.")

    if sale.status != Transaction.Status.PENDING_PAYMENT:
        raise InvalidSale(
            "Only PENDING_PAYMENT sales can be completed."
        )

    confirmed_paid = (
        sale.payments
        .filter(status="CONFIRMED")
        .aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )

    if confirmed_paid < sale.total_amount:
        raise InsufficientPayment(
            "The confirmed payment amount is insufficient to complete the sale."
        )

    items = list(
        TransactionItem.objects
        .select_for_update()
        .filter(transaction=sale)
        .order_by("id")
    )

    if not items:
        raise InvalidSale("A sale must contain at least one item.")

    # Lock all physical stock targets in deterministic order.
    # This reduces deadlock risk when multiple pending sales compete
    # for the same inventory.
    device_ids = sorted({item.device_id for item in items if item.device_id})
    accessory_ids = sorted(
        {
            item.accessory_stock_id
            for item in items
            if item.accessory_stock_id
        }
    )

    devices = {
        device.id: device
        for device in (
            DeviceItem.objects
            .select_for_update()
            .filter(id__in=device_ids)
            .order_by("id")
        )
    }

    accessories = {
        stock.id: stock
        for stock in (
            AccessoryStock.objects
            .select_for_update()
            .filter(id__in=accessory_ids)
            .order_by("id")
        )
    }

    # Revalidate every stock target at completion time.
    for item in items:
        if item.device_id is not None:
            device = devices.get(item.device_id)

            if device is None:
                raise DeviceNotFound("Sale device does not exist.")

            if device.status != DeviceItem.Status.IN_STOCK:
                raise DeviceNotAvailable(
                    f"Device {device.id} is no longer available for sale."
                )

        elif item.accessory_stock_id is not None:
            stock = accessories.get(item.accessory_stock_id)

            if stock is None:
                raise InvalidSaleItem(
                    "Sale accessory stock does not exist."
                )

            if stock.quantity < item.quantity:
                raise InsufficientAccessoryStock(
                    f"Insufficient stock for accessory {stock.product.name}. "
                    f"Available: {stock.quantity}, requested: {item.quantity}."
                )

        else:
            raise InvalidSaleItem(
                "Sale item has no valid stock reference."
            )

    completed_at = timezone.now()
    warranty_date = timezone.localdate()
    settings = _get_store_settings()

    # Customer is part of the same transaction. Lock it before changing
    # the aggregate total so concurrent sales for the same customer cannot
    # lose an increment.
    customer = None
    if sale.customer_id is not None:
        customer = (
            Customer.objects
            .select_for_update()
            .get(pk=sale.customer_id)
        )

    # ---------------------------------------------------------
    # APPLY INVENTORY + WARRANTY CHANGES
    # ---------------------------------------------------------
    for item in items:
        if item.device_id is not None:
            device = devices[item.device_id]
            old_status = device.status

            device.status = DeviceItem.Status.SOLD
            device.save(update_fields=["status", "updated_at"])

            StockMovement.objects.create(
                device=device,
                movement_type=StockMovement.MovementType.SOLD,
                quantity=1,
                from_status=old_status,
                to_status=device.status,
                reference_type="Transaction",
                reference_id=str(sale.id),
                reason="Sale completed.",
                created_by=actor,
            )

            warranty_months = settings.default_device_warranty_months

        else:
            stock = accessories[item.accessory_stock_id]
            stock.quantity -= item.quantity
            stock.save(update_fields=["quantity", "updated_at"])

            movement_type = (
                StockMovement.MovementType.COMPLIMENTARY
                if item.is_complimentary
                else StockMovement.MovementType.SALE
            )

            StockMovement.objects.create(
                accessory_stock=stock,
                movement_type=movement_type,
                quantity=-item.quantity,
                reference_type="Transaction",
                reference_id=str(sale.id),
                reason="Sale completed.",
                created_by=actor,
            )

            warranty_months = settings.default_accessory_warranty_months

        if warranty_months > 0:
            item.warranty_start = warranty_date
            item.warranty_end = _add_calendar_months(
                warranty_date,
                warranty_months,
            )
        else:
            item.warranty_start = None
            item.warranty_end = None

        item.save(
            update_fields=[
                "warranty_start",
                "warranty_end",
            ]
        )

    # ---------------------------------------------------------
    # CUSTOMER AGGREGATE
    # ---------------------------------------------------------
    if customer is not None:
        customer.total_spent += sale.total_amount
        customer.save(
            update_fields=["total_spent", "updated_at"]
        )

    # ---------------------------------------------------------
    # COMPLETE SALE
    # ---------------------------------------------------------
    sale.status = Transaction.Status.COMPLETED
    sale.completed_at = completed_at
    sale.save(
        update_fields=[
            "status",
            "completed_at",
            "updated_at",
        ]
    )

    return sale
