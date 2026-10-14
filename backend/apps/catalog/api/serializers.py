from rest_framework import serializers
from apps.catalog.models import Product, Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'is_device']

class ProductSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True
    )
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'brand', 'platform', 
            'storage_gb', 'ram_gb', 'is_active', 
            'category_id', 'category', 'created_at'
        ]

    def create(self, validated_data):
        from apps.inventory.models import AccessoryStock
        from django.db import transaction

        with transaction.atomic():
            product = Product.objects.create(**validated_data)
            # Initialize AccessoryStock if it's an accessory
            if not product.category.is_device:
                AccessoryStock.objects.create(
                    product=product,
                    quantity=0,
                    selling_price=0,  # Explicitly initialized, will need adjustment APIs later
                    cost_price=0
                )
            return product
