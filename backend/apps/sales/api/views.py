from decimal import Decimal
from django.utils import timezone
from django.db import models
from django.db.models import Count, Q, Min, Sum, F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from apps.sales.models import Transaction, TransactionItem
from apps.payments.models import Payment
from apps.sales.services.scanner import process_scanned_barcode, broadcast_cart_update
from rest_framework.exceptions import ValidationError
from apps.inventory.models import DeviceItem, AccessoryStock
from apps.catalog.models import Product
from apps.customers.models import Customer
from apps.sales.services.sales import create_sale, add_device_to_sale, add_accessory_to_sale, remove_sale_item, move_sale_to_pending_payment, revert_sale_to_draft, complete_sale
from apps.payments.services.payments import create_payment, confirm_bank_transfer, reject_bank_transfer

class ScannerSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id, *args, **kwargs):
        """
        Receive a scanned barcode from the mobile POS scanner.
        """
        barcode = request.data.get("barcode")
        if not barcode:
            return Response({"error": "Barcode is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate transaction
        transaction = get_object_or_404(Transaction, id=transaction_id)
        if transaction.status != Transaction.Status.DRAFT:
            return Response({"error": "Can only scan items into a DRAFT sale."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from apps.users.services.operator_context import get_required_operator
            try:
                operator = get_required_operator(request)
            except Exception:
                user = getattr(request, "user", None)
                if user and user.is_authenticated:
                    operator = user
                else:
                    from apps.users.models import User
                    operator = User.objects.filter(is_pos_operator=True, is_active=True).first() or User.objects.first()
            
            # Add item to sale
            result_data = process_scanned_barcode(
                sale_id=transaction_id, 
                barcode=barcode, 
                actor=operator
            )
            
            # Broadcast the event to the laptop UI connected via WebSocket
            broadcast_cart_update(transaction_id, result_data)

            return Response({
                "message": "Item added successfully",
                "item": result_data
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({"error": str(e.detail[0] if isinstance(e.detail, list) else e.detail)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class POSCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        products = Product.objects.filter(is_active=True)
        catalog = []
        for p in products:
            if p.category.is_device:
                devices = p.device_items.filter(status=DeviceItem.Status.IN_STOCK)
                stock_count = devices.count()
                if stock_count > 0:
                    price = devices.aggregate(min_price=Min('default_selling_price'))['min_price']
                    catalog.append({
                        "id": p.id,
                        "name": p.name,
                        "sub": f"{p.storage_gb}GB" if p.storage_gb else p.brand,
                        "price": str(price),
                        "type": "device",
                        "stock_count": stock_count,
                    })
            else:
                if hasattr(p, 'accessory_stock') and p.accessory_stock.quantity > 0:
                    catalog.append({
                        "id": p.id,
                        "name": p.name,
                        "sub": p.brand,
                        "price": str(p.accessory_stock.selling_price),
                        "type": "accessory",
                        "stock_count": p.accessory_stock.quantity,
                    })
        return Response(catalog)

class SaleCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = Transaction.objects.all().order_by("-id")
        customer_id = request.query_params.get("customer_id")
        status_param = request.query_params.get("status")
        transaction_type = request.query_params.get("transaction_type")
        
        if transaction_type:
            if transaction_type not in Transaction.TransactionType.values:
                return Response(
                    {"error": f"Invalid transaction_type. Allowed values are: {', '.join(Transaction.TransactionType.values)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(transaction_type=transaction_type)
            
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        data = []
        for t in queryset:
            data.append({
                "id": t.id,
                "receipt_id": t.receipt_id,
                "customer_id": t.customer_id,
                "transaction_type": t.transaction_type,
                "status": t.status,
                "total_amount": str(t.total_amount),
                "created_at": t.created_at,
            })
        return Response(data)

    def post(self, request):
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            sale = create_sale(actor=operator)
            return Response({"id": sale.id, "receipt_id": sale.receipt_id}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SaleItemAddView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        product_id = request.data.get("product_id")
        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            product = get_object_or_404(Product, id=product_id)
            if product.category.is_device:
                device = product.device_items.filter(status=DeviceItem.Status.IN_STOCK).first()
                if not device:
                    return Response({"error": "Out of stock"}, status=status.HTTP_400_BAD_REQUEST)
                
                item = add_device_to_sale(sale_id=transaction_id, device_id=device.id, actor=operator)
                data = {
                    "type": "device",
                    "id": item.id,
                    "name": product.name,
                    "identifier": device.imei_1 or device.serial_number,
                    "price": str(item.price_sold),
                }
            else:
                acc_stock = product.accessory_stock
                if not acc_stock or acc_stock.quantity <= 0:
                    return Response({"error": "Out of stock"}, status=status.HTTP_400_BAD_REQUEST)
                
                item = add_accessory_to_sale(sale_id=transaction_id, accessory_stock_id=acc_stock.id, quantity=1, actor=operator)
                data = {
                    "type": "accessory",
                    "id": item.id,
                    "name": product.name,
                    "sku": product.sku,
                    "price": str(item.price_sold),
                }

            broadcast_cart_update(transaction_id, data)
            return Response({"message": "Added", "item": data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

def serialize_transaction(sale):
    items = []
    for item in sale.items.all():
        if item.device:
            items.append({
                "type": "device",
                "id": item.id,
                "device_id": item.device.id,
                "product_id": item.device.product_id,
                "name": item.product_name_snapshot,
                "identifier": item.device.imei_1 or item.device.serial_number,
                "price": str(item.price_sold),
                "quantity": 1,
            })
        elif item.accessory_stock:
            items.append({
                "type": "accessory",
                "id": item.id,
                "product_id": item.accessory_stock.product_id,
                "name": item.product_name_snapshot,
                "sku": item.sku_snapshot,
                "price": str(item.price_sold),
                "quantity": item.quantity,
            })
            
    pending_payments = []
    for p in sale.payments.filter(status="PENDING"):
        pending_payments.append({
            "id": p.id,
            "amount": str(p.amount),
            "method": p.method,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
        })

    confirmed_payments = []
    for p in sale.payments.filter(status="CONFIRMED"):
        confirmed_payments.append({
            "id": p.id,
            "amount": str(p.amount),
            "method": p.method,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
        })

    return {
        "id": sale.id,
        "receipt_id": sale.receipt_id,
        "status": sale.status,
        "subtotal": str(sale.subtotal),
        "discount_amount": str(sale.discount_amount),
        "total_amount": str(sale.total_amount),
        "items": items,
        "confirmed_paid": str(sum(p.amount for p in sale.payments.filter(status="CONFIRMED"))),
        "pending_payments": pending_payments,
        "confirmed_payments": confirmed_payments,
        "customer": {
            "id": sale.customer.id,
            "full_name": sale.customer.full_name,
            "phone_number": sale.customer.phone_number,
            "current_debt": str(sale.customer.current_debt),
            "credit_limit": str(sale.customer.credit_limit),
        } if sale.customer else None,
        "customer_name": sale.customer_name,
        "customer_phone": sale.customer_phone,
        "operator_name": sale.created_by.get_full_name() or sale.created_by.username
    }

class SaleCustomerAssignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        sale = get_object_or_404(Transaction, id=transaction_id)
        if sale.status not in (Transaction.Status.DRAFT, Transaction.Status.PENDING_PAYMENT):
            return Response(
                {"error": "Cannot assign customer to a completed or cancelled transaction."},
                status=status.HTTP_400_BAD_REQUEST
            )

        customer_id = request.data.get("customer_id")
        if customer_id:
            customer = get_object_or_404(Customer, id=customer_id)
            sale.customer = customer
            sale.customer_name = customer.full_name
            sale.customer_phone = customer.phone_number
        else:
            sale.customer = None
            sale.customer_name = request.data.get("customer_name") or None
            sale.customer_phone = request.data.get("customer_phone") or None

        sale.save(update_fields=["customer", "customer_name", "customer_phone", "updated_at"])
        return Response(serialize_transaction(sale))

class TransactionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, transaction_id):
        sale = get_object_or_404(Transaction, id=transaction_id)
        return Response(serialize_transaction(sale))

class SaleItemRemoveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, transaction_id, item_id):
        quantity_str = request.query_params.get("quantity")
        quantity = int(quantity_str) if quantity_str and quantity_str.isdigit() else None
        
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            sale = remove_sale_item(sale_id=transaction_id, item_id=item_id, actor=operator, quantity=quantity)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SaleDiscountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        from apps.sales.services.sales import set_sale_discount
        discount_amount = request.data.get("discount_amount", 0)
        
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            sale = set_sale_discount(
                sale_id=transaction_id, 
                discount_amount=discount_amount, 
                actor=operator
            )
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SaleCheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            sale = get_object_or_404(Transaction, id=transaction_id)
            if sale.status == Transaction.Status.PENDING_PAYMENT:
                return Response(serialize_transaction(sale))
            sale = move_sale_to_pending_payment(sale_id=transaction_id, actor=operator)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SaleCancelCheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            sale = revert_sale_to_draft(sale_id=transaction_id, actor=operator)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SaleCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        from apps.sales.services.sales import cancel_sale
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            sale = cancel_sale(sale_id=transaction_id, actor=operator)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SalePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        amount = request.data.get("amount")
        method = request.data.get("method")
        reference = request.data.get("reference")
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            payment = create_payment(
                sale_id=transaction_id,
                amount=amount,
                method=method,
                actor=operator,
                reference=reference
            )
            sale = get_object_or_404(Transaction, id=transaction_id)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SaleCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id):
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            sale = complete_sale(sale_id=transaction_id, actor=operator)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PaymentConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id, payment_id):
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            confirm_bank_transfer(payment_id=payment_id, actor=operator)
            sale = get_object_or_404(Transaction, id=transaction_id)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PaymentRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, transaction_id, payment_id):
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)
            reject_bank_transfer(payment_id=payment_id, actor=operator)
            sale = get_object_or_404(Transaction, id=transaction_id)
            return Response(serialize_transaction(sale))
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # 1. Today's Revenue & Completed Sales
        today_completed_sales = Transaction.objects.filter(
            status=Transaction.Status.COMPLETED,
        ).filter(
            Q(completed_at__gte=today_start) | Q(created_at__gte=today_start)
        )
        today_revenue = today_completed_sales.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")
        today_sales_count = today_completed_sales.count()

        # 2. Today's Payments by Method (Cash vs Transfer)
        today_confirmed_payments = Payment.objects.filter(
            status=Payment.Status.CONFIRMED,
            created_at__gte=today_start,
        )
        today_cash = today_confirmed_payments.filter(method=Payment.Method.CASH).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        today_transfer = today_confirmed_payments.filter(method=Payment.Method.BANK_TRANSFER).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        # 3. Inventory Overview
        devices_in_stock = DeviceItem.objects.filter(status=DeviceItem.Status.IN_STOCK)
        devices_in_stock_count = devices_in_stock.count()
        devices_in_stock_value = devices_in_stock.aggregate(total=Sum("default_selling_price"))["total"] or Decimal("0.00")
        devices_in_stock_cost = devices_in_stock.aggregate(total=Sum("cost_price"))["total"] or Decimal("0.00")

        accessories = AccessoryStock.objects.all()
        accessories_in_stock_count = accessories.aggregate(total=Sum("quantity"))["total"] or 0
        low_stock_accessories = AccessoryStock.objects.filter(quantity__lte=F("reorder_level")).select_related("product")
        low_stock_count = low_stock_accessories.count()

        # 4. Exchanges Overview
        from apps.exchanges.models import Exchange
        pending_exchanges = Exchange.objects.filter(status__in=[Exchange.Status.REQUESTED, Exchange.Status.UNDER_REVIEW])
        approved_exchanges = Exchange.objects.filter(status=Exchange.Status.APPROVED)
        completed_exchanges_today = Exchange.objects.filter(
            status=Exchange.Status.COMPLETED
        ).filter(
            Q(completed_at__gte=today_start) | Q(created_at__gte=today_start)
        )

        # 5. Recent Completed Sales (Last 5)
        recent_sales = []
        for s in Transaction.objects.filter(status=Transaction.Status.COMPLETED).order_by("-created_at")[:5]:
            customer_label = s.customer_name or (s.customer.full_name if s.customer else None) or "Walk-in Customer"
            customer_phone = s.customer_phone or (s.customer.phone if s.customer else None) or ""
            recent_sales.append({
                "id": s.id,
                "receipt_id": s.receipt_id,
                "total_amount": str(s.total_amount),
                "created_at": (s.completed_at or s.created_at).isoformat(),
                "customer_name": customer_label,
                "customer_phone": customer_phone,
                "items_count": s.items.count(),
                "payment_methods": list(s.payments.filter(status=Payment.Status.CONFIRMED).values_list("method", flat=True).distinct()),
            })

        # 6. Recent Exchanges (Last 5)
        recent_exchanges = []
        for ex in Exchange.objects.all().order_by("-created_at")[:5]:
            recent_exchanges.append({
                "id": ex.id,
                "exchange_number": ex.exchange_number,
                "customer_name": ex.customer_name or "Walk-in",
                "trade_in_product_name": ex.trade_in_product.name if ex.trade_in_product else "Trade-In Phone",
                "new_device_name": (ex.new_device.product.name if ex.new_device and ex.new_device.product else f"Device #{ex.new_device_id}") if ex.new_device else "Replacement Phone",
                "difference_amount": str(ex.difference_amount),
                "financial_direction": ex.financial_direction,
                "status": ex.status,
                "created_at": ex.created_at.isoformat(),
            })

        # 7. Low Stock Accessories Details (Top 5)
        low_stock_list = []
        for stock in low_stock_accessories.order_by("quantity")[:5]:
            low_stock_list.append({
                "id": stock.id,
                "name": stock.product.name,
                "sku": stock.product.sku,
                "quantity": stock.quantity,
                "reorder_level": stock.reorder_level,
                "selling_price": str(stock.selling_price),
            })

        return Response({
            "today_revenue": f"{Decimal(str(today_revenue)):.2f}",
            "today_sales_count": today_sales_count,
            "today_cash": f"{Decimal(str(today_cash)):.2f}",
            "today_transfer": f"{Decimal(str(today_transfer)):.2f}",
            "devices_in_stock_count": devices_in_stock_count,
            "devices_in_stock_value": f"{Decimal(str(devices_in_stock_value)):.2f}",
            "devices_in_stock_cost": f"{Decimal(str(devices_in_stock_cost)):.2f}",
            "accessories_in_stock_count": accessories_in_stock_count,
            "low_stock_count": low_stock_count,
            "pending_exchanges_count": pending_exchanges.count(),
            "approved_exchanges_count": approved_exchanges.count(),
            "completed_exchanges_today_count": completed_exchanges_today.count(),
            "recent_sales": recent_sales,
            "recent_exchanges": recent_exchanges,
            "low_stock_items": low_stock_list,
        })
