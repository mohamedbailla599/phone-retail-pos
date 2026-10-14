from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.utils import IntegrityError
from apps.inventory.models import DeviceItem, AccessoryStock
from apps.catalog.models import Product
from apps.inventory.api.serializers import (
    DeviceItemSerializer, AccessoryStockSerializer, 
    ReceiveDeviceSerializer, ReceiveAccessorySerializer,
    AdjustAccessoryStockSerializer, DeviceStatusChangeSerializer
)
from apps.inventory.services.inventory import (
    receive_device, receive_accessory_stock, adjust_accessory_stock,
    reserve_device, sell_device, mark_device_damaged, mark_device_lost,
    release_reserved_device, send_device_to_repair, return_device_to_stock,
    complete_device_repair, force_change_device_status
)
from apps.users.services.operator_context import get_required_operator
from core.exceptions import (
    InvalidIdentifier, DeviceNotFound, InvalidStockAdjustment,
    InvalidDeviceTransition
)

class DeviceListView(generics.ListAPIView):
    serializer_class = DeviceItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = DeviceItem.objects.all().select_related('product')
        status = self.request.query_params.get('status')
        product_id = self.request.query_params.get('product_id')
        search = self.request.query_params.get('search')
        platform = self.request.query_params.get('platform')
        condition = self.request.query_params.get('condition')

        if status:
            queryset = queryset.filter(status=status)
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        if platform:
            queryset = queryset.filter(product__platform=platform)
        if condition:
            queryset = queryset.filter(condition=condition)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(product__name__icontains=search) |
                Q(product__sku__icontains=search) |
                Q(imei_1__icontains=search) |
                Q(imei_2__icontains=search) |
                Q(serial_number__icontains=search)
            )

        return queryset

class AccessoryStockListView(generics.ListAPIView):
    serializer_class = AccessoryStockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = AccessoryStock.objects.all().select_related('product')
        search = self.request.query_params.get('search')
        
        if search:
            queryset = queryset.filter(product__name__icontains=search)
            
        return queryset

class ReceiveDeviceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReceiveDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            operator = get_required_operator(request)
            product = Product.objects.get(id=data['product_id'])
            
            # None out empty strings for uniqueness constraints
            imei_1 = data.get('imei_1') or None
            imei_2 = data.get('imei_2') or None
            serial_number = data.get('serial_number') or None

            device = receive_device(
                actor=operator,
                product=product,
                cost_price=data['cost_price'],
                default_selling_price=data['default_selling_price'],
                minimum_selling_price=data['minimum_selling_price'],
                imei_1=imei_1,
                imei_2=imei_2,
                serial_number=serial_number,
                battery_health=data.get('battery_health'),
                battery_capacity_mah=data.get('battery_capacity_mah'),
                condition=data.get('condition', DeviceItem.Condition.A)
            )

            return Response(DeviceItemSerializer(device).data, status=status.HTTP_201_CREATED)

        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError as e:
            error_str = str(e).lower()
            if 'imei_1' in error_str:
                return Response({'error': 'IMEI 1 is already registered in inventory.'}, status=status.HTTP_400_BAD_REQUEST)
            if 'imei_2' in error_str:
                return Response({'error': 'IMEI 2 is already registered in inventory.'}, status=status.HTTP_400_BAD_REQUEST)
            if 'serial_number' in error_str:
                return Response({'error': 'Serial number is already registered in inventory.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'A device with this identifier already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        except (InvalidIdentifier, ValueError, Exception) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ReceiveAccessoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReceiveAccessorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            operator = get_required_operator(request)
            stock = receive_accessory_stock(
                accessory_stock_id=data['accessory_stock_id'],
                quantity=data['quantity'],
                actor=operator
            )
            return Response(AccessoryStockSerializer(stock).data, status=status.HTTP_200_OK)
        except (DeviceNotFound, InvalidStockAdjustment, Exception) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class AdjustAccessoryStockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AdjustAccessoryStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            operator = get_required_operator(request)
            stock = adjust_accessory_stock(
                accessory_stock_id=data['accessory_stock_id'],
                quantity_delta=data['quantity_delta'],
                actor=operator,
                reason=data['reason']
            )
            return Response(AccessoryStockSerializer(stock).data, status=status.HTTP_200_OK)
            
        except (DeviceNotFound, InvalidStockAdjustment, Exception) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class DeviceStatusChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DeviceStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            operator = get_required_operator(request)
            device = DeviceItem.objects.get(id=data['device_id'])
            
            current_status = device.status
            target_status = data['target_status']
            reason = data['reason']
            
            kwargs = {
                'device_id': device.id,
                'actor': operator,
                'reason': reason
            }
            
            if current_status == DeviceItem.Status.IN_STOCK:
                if target_status == DeviceItem.Status.RESERVED:
                    updated_device = reserve_device(**kwargs)
                elif target_status == DeviceItem.Status.SOLD:
                    updated_device = sell_device(**kwargs)
                elif target_status == DeviceItem.Status.DAMAGED:
                    updated_device = mark_device_damaged(**kwargs)
                elif target_status == DeviceItem.Status.LOST:
                    updated_device = mark_device_lost(**kwargs)
                else:
                    updated_device = force_change_device_status(**kwargs, target_status=target_status)
            elif current_status == DeviceItem.Status.RESERVED:
                if target_status == DeviceItem.Status.IN_STOCK:
                    updated_device = release_reserved_device(**kwargs)
                else:
                    updated_device = force_change_device_status(**kwargs, target_status=target_status)
            elif current_status == DeviceItem.Status.SOLD:
                if target_status == DeviceItem.Status.REPAIR:
                    updated_device = send_device_to_repair(**kwargs)
                elif target_status == DeviceItem.Status.IN_STOCK:
                    updated_device = return_device_to_stock(**kwargs)
                else:
                    updated_device = force_change_device_status(**kwargs, target_status=target_status)
            elif current_status == DeviceItem.Status.REPAIR:
                if target_status == DeviceItem.Status.IN_STOCK:
                    updated_device = complete_device_repair(**kwargs)
                else:
                    updated_device = force_change_device_status(**kwargs, target_status=target_status)
            else:
                updated_device = force_change_device_status(**kwargs, target_status=target_status)
                
            return Response(DeviceItemSerializer(updated_device).data, status=status.HTTP_200_OK)
            
        except DeviceItem.DoesNotExist:
            return Response({'error': 'Device not found.'}, status=status.HTTP_400_BAD_REQUEST)
        except (DeviceNotFound, InvalidDeviceTransition, Exception) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
