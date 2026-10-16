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

class DeviceItemUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceItem
        fields = [
            'imei_1', 'imei_2', 'serial_number',
            'cost_price', 'default_selling_price', 'minimum_selling_price',
            'battery_health', 'battery_capacity_mah', 'condition'
        ]
        extra_kwargs = {
            'cost_price': {'required': False},
            'default_selling_price': {'required': False},
            'minimum_selling_price': {'required': False},
            'condition': {'required': False},
            'imei_1': {'required': False, 'allow_null': True, 'allow_blank': True},
            'imei_2': {'required': False, 'allow_null': True, 'allow_blank': True},
            'serial_number': {'required': False, 'allow_null': True, 'allow_blank': True},
            'battery_health': {'required': False, 'allow_null': True},
            'battery_capacity_mah': {'required': False, 'allow_null': True},
        }

    def validate_imei_1(self, value):
        if value:
            clean_val = str(value).strip()
            existing = DeviceItem.objects.filter(imei_1=clean_val)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("Cet IMEI 1 est déjà attribué à un autre appareil.")
            return clean_val
        return None

    def validate_imei_2(self, value):
        if value:
            clean_val = str(value).strip()
            existing = DeviceItem.objects.filter(imei_2=clean_val)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("Cet IMEI 2 est déjà attribué à un autre appareil.")
            return clean_val
        return None

    def validate_serial_number(self, value):
        if value:
            clean_val = str(value).strip()
            existing = DeviceItem.objects.filter(serial_number=clean_val)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("Ce numéro de série est déjà attribué à un autre appareil.")
            return clean_val
        return None

    def validate(self, attrs):
        default_price = attrs.get('default_selling_price', getattr(self.instance, 'default_selling_price', None))
        min_price = attrs.get('minimum_selling_price', getattr(self.instance, 'minimum_selling_price', None))
        if default_price is not None and min_price is not None and min_price > default_price:
            raise serializers.ValidationError({"minimum_selling_price": "Le prix de vente minimum ne peut pas dépasser le prix de vente normal."})
        return attrs
