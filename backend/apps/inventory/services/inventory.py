from django.db import transaction
from django.utils import timezone

from apps.inventory.models import (
    AccessoryStock,
    DeviceItem,
    StockMovement,
)

from core.exceptions import (
    DeviceNotAvailable,
    DeviceNotFound,
    InvalidDeviceTransition,
    InvalidIdentifier,
    InsufficientAccessoryStock,
    InvalidStockAdjustment,
)


def _create_device_movement(
    *,
    device,
    movement_type,
    actor,
    from_status=None,
    to_status=None,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    return StockMovement.objects.create(
        device=device,
        movement_type=movement_type,
        quantity=1,
        from_status=from_status,
        to_status=to_status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
        created_by=actor,
    )


@transaction.atomic
def receive_device(
    *,
    actor,
    product,
    cost_price,
    default_selling_price,
    minimum_selling_price,
    imei_1=None,
    imei_2=None,
    serial_number=None,
    battery_health=None,
    condition=DeviceItem.Condition.A,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Create one physical device and place it directly into IN_STOCK.
    """

    # A physical device must have at least one identifier.
    if not imei_1 and not serial_number:
        raise InvalidIdentifier(
            "A device must have at least one of IMEI1 or serial number."
        )

    # The database constraint also protects this rule, but we validate
    # explicitly so callers receive a business-level exception.
    if imei_2 and imei_1 and imei_2 == imei_1:
        raise InvalidIdentifier(
            "IMEI2 must be different from IMEI1."
        )

    if minimum_selling_price > default_selling_price:
        raise InvalidIdentifier(
            "Minimum selling price cannot exceed default selling price."
        )

    now = timezone.now()

    device = DeviceItem.objects.create(
        product=product,
        imei_1=imei_1,
        imei_2=imei_2,
        serial_number=serial_number,
        cost_price=cost_price,
        default_selling_price=default_selling_price,
        minimum_selling_price=minimum_selling_price,
        battery_health=battery_health,
        condition=condition,
        status=DeviceItem.Status.IN_STOCK,
        received_at=now,
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.RECEIVED,
        actor=actor,
        to_status=DeviceItem.Status.IN_STOCK,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device


@transaction.atomic
def reserve_device(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Atomically move an IN_STOCK device to RESERVED.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.IN_STOCK:
        raise DeviceNotAvailable(
            f"Device {device_id} is not available for reservation."
        )

    old_status = device.status

    device.status = DeviceItem.Status.RESERVED
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.RESERVED,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device


@transaction.atomic
def release_reserved_device(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Atomically move a RESERVED device back to IN_STOCK.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.RESERVED:
        raise InvalidDeviceTransition(
            f"Device {device_id} is not RESERVED."
        )

    old_status = device.status

    device.status = DeviceItem.Status.IN_STOCK
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.RESERVATION_RELEASED,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device


@transaction.atomic
def sell_device(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Atomically move an IN_STOCK device to SOLD.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.IN_STOCK:
        raise DeviceNotAvailable(
            f"Device {device_id} cannot be sold because "
            f"its current status is {device.status}."
        )

    old_status = device.status

    device.status = DeviceItem.Status.SOLD
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.SOLD,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device

@transaction.atomic
def send_device_to_repair(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Move a SOLD device to REPAIR.
    Typically used after an approved warranty operation.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.SOLD:
        raise InvalidDeviceTransition(
            f"Device {device_id} cannot be sent to repair "
            f"from status {device.status}."
        )

    old_status = device.status

    device.status = DeviceItem.Status.REPAIR
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.REPAIR,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device


@transaction.atomic
def complete_device_repair(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Move a device from REPAIR back to IN_STOCK.
    Completing a repair does not restart the warranty.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.REPAIR:
        raise InvalidDeviceTransition(
            f"Device {device_id} is not currently in repair."
        )

    old_status = device.status

    device.status = DeviceItem.Status.IN_STOCK
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.REPAIR_COMPLETED,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device


@transaction.atomic
def mark_device_damaged(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Move an IN_STOCK device to DAMAGED.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.IN_STOCK:
        raise InvalidDeviceTransition(
            f"Device {device_id} cannot be marked as damaged "
            f"from status {device.status}."
        )

    old_status = device.status

    device.status = DeviceItem.Status.DAMAGED
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.DAMAGED,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device


@transaction.atomic
def mark_device_lost(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Move an IN_STOCK device to LOST.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.IN_STOCK:
        raise InvalidDeviceTransition(
            f"Device {device_id} cannot be marked as lost "
            f"from status {device.status}."
        )

    old_status = device.status

    device.status = DeviceItem.Status.LOST
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.LOST,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device


@transaction.atomic
def return_device_to_stock(
    *,
    device_id,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Move a SOLD device back to IN_STOCK after an approved
    return whose inventory disposition is RESTOCK.
    """

    try:
        device = (
            DeviceItem.objects
            .select_for_update()
            .get(pk=device_id)
        )
    except DeviceItem.DoesNotExist:
        raise DeviceNotFound(
            f"Device {device_id} was not found."
        )

    if device.status != DeviceItem.Status.SOLD:
        raise InvalidDeviceTransition(
            f"Device {device_id} cannot be returned to stock "
            f"from status {device.status}."
        )

    old_status = device.status

    device.status = DeviceItem.Status.IN_STOCK
    device.save(
        update_fields=["status", "updated_at"]
    )

    _create_device_movement(
        device=device,
        movement_type=StockMovement.MovementType.RETURNED,
        actor=actor,
        from_status=old_status,
        to_status=device.status,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
    )

    return device

@transaction.atomic
def receive_accessory_stock(
    *,
    accessory_stock_id,
    quantity,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Add received quantity to accessory stock.
    """

    if quantity <= 0:
        raise InvalidStockAdjustment(
            "Received quantity must be greater than zero."
        )

    try:
        stock = (
            AccessoryStock.objects
            .select_for_update()
            .get(pk=accessory_stock_id)
        )
    except AccessoryStock.DoesNotExist:
        raise DeviceNotFound(
            f"Accessory stock {accessory_stock_id} was not found."
        )

    old_quantity = stock.quantity
    stock.quantity = old_quantity + quantity

    stock.save(
        update_fields=["quantity", "updated_at"]
    )

    StockMovement.objects.create(
        accessory_stock=stock,
        movement_type=StockMovement.MovementType.RECEIVED,
        quantity=quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
        created_by=actor,
    )

    return stock


@transaction.atomic
def sell_accessory_stock(
    *,
    accessory_stock_id,
    quantity,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Remove sold quantity from accessory stock.
    """

    if quantity <= 0:
        raise InvalidStockAdjustment(
            "Sold quantity must be greater than zero."
        )

    try:
        stock = (
            AccessoryStock.objects
            .select_for_update()
            .get(pk=accessory_stock_id)
        )
    except AccessoryStock.DoesNotExist:
        raise DeviceNotFound(
            f"Accessory stock {accessory_stock_id} was not found."
        )

    if stock.quantity < quantity:
        raise InsufficientAccessoryStock(
            f"Insufficient stock for accessory "
            f"{stock.product.name}. "
            f"Available: {stock.quantity}, requested: {quantity}."
        )

    stock.quantity -= quantity

    stock.save(
        update_fields=["quantity", "updated_at"]
    )

    StockMovement.objects.create(
        accessory_stock=stock,
        movement_type=StockMovement.MovementType.SALE,
        quantity=-quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
        created_by=actor,
    )

    return stock


@transaction.atomic
def complimentary_accessory_stock(
    *,
    accessory_stock_id,
    quantity,
    actor,
    reference_type=None,
    reference_id=None,
    reason=None,
):
    """
    Remove accessory quantity given to a customer for free.
    Inventory decreases even though selling price is zero.
    """

    if quantity <= 0:
        raise InvalidStockAdjustment(
            "Complimentary quantity must be greater than zero."
        )

    try:
        stock = (
            AccessoryStock.objects
            .select_for_update()
            .get(pk=accessory_stock_id)
        )
    except AccessoryStock.DoesNotExist:
        raise DeviceNotFound(
            f"Accessory stock {accessory_stock_id} was not found."
        )

    if stock.quantity < quantity:
        raise InsufficientAccessoryStock(
            f"Insufficient stock for accessory "
            f"{stock.product.name}. "
            f"Available: {stock.quantity}, requested: {quantity}."
        )

    stock.quantity -= quantity

    stock.save(
        update_fields=["quantity", "updated_at"]
    )

    StockMovement.objects.create(
        accessory_stock=stock,
        movement_type=StockMovement.MovementType.COMPLIMENTARY,
        quantity=-quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
        created_by=actor,
    )

    return stock


@transaction.atomic
def adjust_accessory_stock(
    *,
    accessory_stock_id,
    quantity_delta,
    actor,
    reason,
    reference_type=None,
    reference_id=None,
):
    """
    Manually adjust accessory stock.

    quantity_delta:
        positive -> increase stock
        negative -> decrease stock
    """

    if quantity_delta == 0:
        raise InvalidStockAdjustment(
            "Stock adjustment cannot be zero."
        )

    if not reason:
        raise InvalidStockAdjustment(
            "A reason is required for a stock adjustment."
        )

    try:
        stock = (
            AccessoryStock.objects
            .select_for_update()
            .get(pk=accessory_stock_id)
        )
    except AccessoryStock.DoesNotExist:
        raise DeviceNotFound(
            f"Accessory stock {accessory_stock_id} was not found."
        )

    new_quantity = stock.quantity + quantity_delta

    if new_quantity < 0:
        raise InvalidStockAdjustment(
            f"Stock cannot become negative. "
            f"Available: {stock.quantity}, "
            f"adjustment: {quantity_delta}."
        )

    stock.quantity = new_quantity

    stock.save(
        update_fields=["quantity", "updated_at"]
    )

    StockMovement.objects.create(
        accessory_stock=stock,
        movement_type=StockMovement.MovementType.ADJUSTMENT,
        quantity=quantity_delta,
        reference_type=reference_type,
        reference_id=reference_id,
        reason=reason,
        created_by=actor,
    )

    return stock