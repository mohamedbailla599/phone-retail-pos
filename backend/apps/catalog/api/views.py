from rest_framework import generics, permissions
from apps.catalog.models import Product, Category
from apps.catalog.api.serializers import ProductSerializer, CategorySerializer

class ProductListView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Product.objects.all()
        name = self.request.query_params.get('name')
        sku = self.request.query_params.get('sku')
        category_id = self.request.query_params.get('category_id')
        is_active = self.request.query_params.get('is_active')
        is_device = self.request.query_params.get('is_device')

        if name:
            queryset = queryset.filter(name__icontains=name)
        if sku:
            queryset = queryset.filter(sku__icontains=sku)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if is_device is not None:
            queryset = queryset.filter(category__is_device=is_device.lower() == 'true')

        return queryset

class CategoryListView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
