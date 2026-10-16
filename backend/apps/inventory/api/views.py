from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.utils import IntegrityError
from apps.inventory.models import DeviceItem, AccessoryStock
from apps.catalog.models import Product
from apps.inventory.api.serializers import (
    DeviceItemSerializer, AccessoryStockSerializer, 
    ReceiveDeviceSerializer, ReceiveAccessorySerializer,
    AdjustAccessoryStockSerializer, DeviceStatusChangeSerializer,
    DeviceItemUpdateSerializer
)
from apps.audit.models import AuditLog
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


class DeviceDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            device = DeviceItem.objects.select_related('product').get(pk=pk)
            return Response(DeviceItemSerializer(device).data)
        except DeviceItem.DoesNotExist:
            return Response({'error': 'Appareil non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        try:
            device = DeviceItem.objects.select_related('product').get(pk=pk)
            try:
                operator = get_required_operator(request)
            except Exception:
                operator = getattr(request, "user", None)

            serializer = DeviceItemUpdateSerializer(device, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)

            old_data = {
                'imei_1': device.imei_1,
                'imei_2': device.imei_2,
                'serial_number': device.serial_number,
                'cost_price': str(device.cost_price),
                'default_selling_price': str(device.default_selling_price),
                'minimum_selling_price': str(device.minimum_selling_price),
                'condition': device.condition,
                'battery_health': device.battery_health,
                'battery_capacity_mah': device.battery_capacity_mah,
            }

            updated_device = serializer.save()

            changes = {}
            for field, old_val in old_data.items():
                new_val = getattr(updated_device, field)
                new_val_str = str(new_val) if new_val is not None else None
                if old_val != new_val_str:
                    changes[field] = {'from': old_val, 'to': new_val_str}

            if changes and operator:
                try:
                    AuditLog.objects.create(
                        actor=operator,
                        action=AuditLog.Action.DEVICE_UPDATED,
                        entity_type="DeviceItem",
                        entity_id=updated_device.id,
                        old_values={k: v['from'] for k, v in changes.items()},
                        new_values={k: v['to'] for k, v in changes.items()},
                        reason=f"Mise à jour des informations de l'appareil {updated_device.product.name}",
                    )
                except Exception:
                    pass

            return Response(DeviceItemSerializer(updated_device).data, status=status.HTTP_200_OK)

        except DeviceItem.DoesNotExist:
            return Response({'error': 'Appareil non trouvé.'}, status=status.HTTP_404_NOT_FOUND)
        except IntegrityError as e:
            error_str = str(e).lower()
            if 'imei_1' in error_str:
                return Response({'error': "Cet IMEI 1 est déjà attribué à un autre appareil."}, status=status.HTTP_400_BAD_REQUEST)
            if 'imei_2' in error_str:
                return Response({'error': "Cet IMEI 2 est déjà attribué à un autre appareil."}, status=status.HTTP_400_BAD_REQUEST)
            if 'serial_number' in error_str:
                return Response({'error': "Ce numéro de série est déjà attribué à un autre appareil."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': "Un appareil avec ces identifiants existe déjà."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            device = DeviceItem.objects.select_related('product').get(pk=pk)
            try:
                operator = get_required_operator(request)
            except Exception:
                operator = getattr(request, "user", None)

            if device.status == DeviceItem.Status.SOLD:
                return Response(
                    {'error': "Impossible de supprimer un appareil vendu."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if linked to non-cancelled transactions
            if hasattr(device, 'transaction_items') and device.transaction_items.exclude(transaction__status="CANCELLED").exists():
                return Response(
                    {'error': "Impossible de supprimer cet appareil car il figure dans une vente ou transaction."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if linked to warranty cases
            if hasattr(device, 'warranty_cases') and device.warranty_cases.exists():
                return Response(
                    {'error': "Impossible de supprimer cet appareil car un dossier de garantie lui est associé."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            snapshot = {
                "product": device.product.name,
                "imei_1": device.imei_1,
                "imei_2": device.imei_2,
                "serial_number": device.serial_number,
                "status": device.status,
                "cost_price": str(device.cost_price),
                "selling_price": str(device.default_selling_price),
            }
            device_id = device.id
            device.delete()

            if operator:
                try:
                    AuditLog.objects.create(
                        actor=operator,
                        action=AuditLog.Action.DEVICE_DELETED,
                        entity_type="DeviceItem",
                        entity_id=device_id,
                        old_values=snapshot,
                        reason=f"Suppression de l'appareil {snapshot['product']} (IMEI: {snapshot['imei_1'] or snapshot['serial_number'] or 'N/A'})",
                    )
                except Exception:
                    pass

            return Response({'success': True, 'message': 'Appareil supprimé du stock avec succès.'}, status=status.HTTP_200_OK)

        except DeviceItem.DoesNotExist:
            return Response({'error': 'Appareil non trouvé.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
