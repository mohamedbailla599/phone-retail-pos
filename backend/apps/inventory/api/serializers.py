from rest_framework import serializers
from apps.inventory.models import DeviceItem, AccessoryStock
from apps.catalog.api.serializers import ProductSerializer

class DeviceItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = DeviceItem
        fields = [
            'id', 'product', 'imei_1', 'imei_2', 'serial_number', 
            'cost_price', 'default_selling_price', 'minimum_selling_price', 
            'battery_health', 'battery_capacity_mah', 'condition', 'status', 'received_at'
        ]

class AccessoryStockSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = AccessoryStock
        fields = [
            'id', 'product', 'quantity', 'cost_price', 'selling_price', 
            'reorder_level', 'created_at', 'updated_at'
        ]

class ReceiveDeviceSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    imei_1 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    imei_2 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    serial_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    default_selling_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    minimum_selling_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    battery_health = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=100)
    battery_capacity_mah = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    condition = serializers.ChoiceField(choices=DeviceItem.Condition.choices, default=DeviceItem.Condition.A)

class ReceiveAccessorySerializer(serializers.Serializer):
    accessory_stock_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)

class AdjustAccessoryStockSerializer(serializers.Serializer):
    accessory_stock_id = serializers.IntegerField()
    quantity_delta = serializers.IntegerField()
    reason = serializers.CharField(required=True, allow_blank=False, min_length=1)

    def validate_quantity_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity delta must not be 0.")
        return value

class DeviceStatusChangeSerializer(serializers.Serializer):
    device_id = serializers.IntegerField()
    target_status = serializers.CharField(required=True, allow_blank=False)
    reason = serializers.CharField(required=True, allow_blank=False, min_length=1)
