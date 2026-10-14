from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.inventory.models import DeviceItem, AccessoryStock
from apps.sales.services.sales import add_device_to_sale, add_accessory_to_sale
from django.db.models import Q
from rest_framework.exceptions import ValidationError

def process_scanned_barcode(*, sale_id, barcode, actor):
    """
    Process a scanned barcode from the mobile POS scanner.
    """
    barcode = str(barcode).strip()
    if not barcode:
        raise ValidationError("Code-barres ou IMEI manquant.")

    # 1. Check if it's a DeviceItem (by IMEI or Serial)
    device = DeviceItem.objects.filter(
        Q(imei_1=barcode) | Q(imei_2=barcode) | Q(serial_number=barcode)
    ).first()

    if device:
        if device.status != DeviceItem.Status.IN_STOCK:
            raise ValidationError(f"Appareil {device.product.name} est actuellement {device.status}.")
        
        # Attempt to add to sale
        try:
            item = add_device_to_sale(sale_id=sale_id, device_id=device.id, actor=actor)
            return {
                "type": "device",
                "name": device.product.name,
                "identifier": device.imei_1 or device.serial_number,
                "price": str(item.price_sold),
            }
        except Exception as e:
            raise ValidationError(str(e))

    # 2. Check if it's an AccessoryStock (by SKU or Product Name)
    accessory = AccessoryStock.objects.filter(
        Q(product__sku__iexact=barcode) | Q(product__name__iexact=barcode)
    ).first()
    if accessory:
        if accessory.quantity <= 0:
            raise ValidationError(f"Accessoire {accessory.product.name} en rupture de stock.")
        
        try:
            item = add_accessory_to_sale(sale_id=sale_id, accessory_stock_id=accessory.id, quantity=1, actor=actor)
            return {
                "type": "accessory",
                "name": accessory.product.name,
                "sku": accessory.product.sku,
                "price": str(item.price_sold),
            }
        except Exception as e:
            raise ValidationError(str(e))

    raise ValidationError(f"Code-barres ou IMEI '{barcode}' non trouvé dans l'inventaire.")

def broadcast_cart_update(transaction_id, data):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"cart_{transaction_id}",
        {
            "type": "cart.updated",
            "data": data,
        }
    )
