from decimal import Decimal
from datetime import datetime, time
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
from apps.customers.models import Customer, CustomerDebtPayment
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
            
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                models.Q(receipt_id__icontains=search) |
                models.Q(customer_name__icontains=search) |
                models.Q(customer_phone__icontains=search) |
                models.Q(customer__full_name__icontains=search) |
                models.Q(customer__phone_number__icontains=search)
            )

        data = []
        for t in queryset.select_related("customer")[:50]:
            data.append({
                "id": t.id,
                "receipt_id": t.receipt_id,
                "customer_id": t.customer_id,
                "customer_name": t.customer.full_name if t.customer else (t.customer_name or "Client Comptoir"),
                "customer_phone": t.customer.phone_number if t.customer else (t.customer_phone or ""),
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
        split = request.data.get("split")
        try:
            from apps.users.services.operator_context import get_required_operator
            operator = get_required_operator(request)

            if method == "MIXED" or split:
                from django.db import transaction as db_transaction
                from decimal import Decimal
                cash_val = Decimal(str(split.get("cash", 0))) if split else Decimal("0")
                debt_val = Decimal(str(split.get("debt", 0))) if split else Decimal("0")

                with db_transaction.atomic():
                    if cash_val > 0:
                        create_payment(
                            sale_id=transaction_id,
                            amount=cash_val,
                            method=Payment.Method.CASH,
                            actor=operator,
                            reference=reference
                        )
                    if debt_val > 0:
                        create_payment(
                            sale_id=transaction_id,
                            amount=debt_val,
                            method=Payment.Method.DEBT,
                            actor=operator,
                            reference=reference
                        )
            else:
                create_payment(
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
            customer_phone = s.customer_phone or (s.customer.phone_number if s.customer else None) or ""
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


class ZReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """
        Z-Report / Daily Financial Summary & Cash Reconciliation.
        Supports query params ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD.
        Defaults to current local date.
        """
        tz = timezone.get_current_timezone()
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()

        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date() if start_date_str else today
        except ValueError:
            start_date = today

        try:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date() if end_date_str else start_date
        except ValueError:
            end_date = start_date

        start_dt = timezone.make_aware(datetime.combine(start_date, time.min), tz)
        end_dt = timezone.make_aware(datetime.combine(end_date, time.max), tz)

        # 1. Completed Sales in range
        completed_sales = Transaction.objects.filter(
            status=Transaction.Status.COMPLETED
        ).filter(
            Q(completed_at__gte=start_dt, completed_at__lte=end_dt) |
            Q(completed_at__isnull=True, created_at__gte=start_dt, created_at__lte=end_dt)
        ).select_related("customer", "created_by").prefetch_related("items", "payments")

        sales_count = completed_sales.count()
        total_revenue = completed_sales.aggregate(t=Sum("total_amount"))["t"] or Decimal("0.00")
        total_discount = completed_sales.aggregate(t=Sum("discount_amount"))["t"] or Decimal("0.00")
        subtotal = completed_sales.aggregate(t=Sum("subtotal"))["t"] or Decimal("0.00")
        average_basket = (total_revenue / Decimal(str(sales_count))) if sales_count > 0 else Decimal("0.00")

        # 2. Confirmed Payments from Sales
        sale_payments = Payment.objects.filter(
            transaction__in=completed_sales,
            status=Payment.Status.CONFIRMED,
        )
        direct_cash = sale_payments.filter(method=Payment.Method.CASH).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
        direct_transfer = sale_payments.filter(method=Payment.Method.BANK_TRANSFER).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
        new_debt_granted = sale_payments.filter(method=Payment.Method.DEBT).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")

        # 3. Customer Debt Repayments in Range
        debt_payments = CustomerDebtPayment.objects.filter(
            created_at__gte=start_dt,
            created_at__lte=end_dt,
        ).select_related("customer", "operator")

        debt_cash = debt_payments.filter(payment_method=CustomerDebtPayment.Method.CASH).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
        debt_transfer = debt_payments.filter(payment_method=CustomerDebtPayment.Method.BANK_TRANSFER).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
        total_debt_recovered = debt_cash + debt_transfer

        # 4. Total Cash in Drawer & Total Real Collected
        cash_in_drawer = direct_cash + debt_cash
        total_bank_transfer = direct_transfer + debt_transfer
        total_real_collected = cash_in_drawer + total_bank_transfer

        # 5. Items, Cost & Profit
        items = TransactionItem.objects.filter(transaction__in=completed_sales)
        total_device_revenue = Decimal("0.00")
        total_device_cost = Decimal("0.00")
        device_units_sold = 0

        total_accessory_revenue = Decimal("0.00")
        total_accessory_cost = Decimal("0.00")
        accessory_units_sold = 0

        product_sales_dict = {}

        for itm in items:
            cost = itm.cost_price_at_sale * itm.quantity
            p_name = itm.product_name_snapshot
            if itm.device_id:
                total_device_revenue += itm.line_total
                total_device_cost += cost
                device_units_sold += itm.quantity
            else:
                total_accessory_revenue += itm.line_total
                total_accessory_cost += cost
                accessory_units_sold += itm.quantity

            if p_name not in product_sales_dict:
                product_sales_dict[p_name] = {
                    "name": p_name,
                    "sku": itm.sku_snapshot,
                    "quantity": 0,
                    "revenue": Decimal("0.00"),
                    "cost": Decimal("0.00"),
                    "profit": Decimal("0.00"),
                }
            product_sales_dict[p_name]["quantity"] += itm.quantity
            product_sales_dict[p_name]["revenue"] += itm.line_total
            product_sales_dict[p_name]["cost"] += cost
            product_sales_dict[p_name]["profit"] += (itm.line_total - cost)

        total_cogs = total_device_cost + total_accessory_cost
        gross_profit = total_revenue - total_cogs
        margin_percent = ((gross_profit / total_revenue) * Decimal("100.0")) if total_revenue > 0 else Decimal("0.00")

        device_profit = total_device_revenue - total_device_cost
        accessory_profit = total_accessory_revenue - total_accessory_cost

        # Top products by revenue
        top_products = sorted(product_sales_dict.values(), key=lambda x: x["revenue"], reverse=True)[:10]
        top_products_formatted = [
            {
                "name": tp["name"],
                "sku": tp["sku"],
                "quantity": tp["quantity"],
                "revenue": f"{tp['revenue']:.2f}",
                "profit": f"{tp['profit']:.2f}",
            }
            for tp in top_products
        ]

        # 6. Sales List
        sales_records = []
        for s in completed_sales.order_by("-completed_at", "-created_at"):
            c_name = s.customer_name or (s.customer.full_name if s.customer else "Client comptoir")
            c_phone = s.customer_phone or (s.customer.phone_number if s.customer else "")
            
            p_cash = s.payments.filter(method=Payment.Method.CASH, status=Payment.Status.CONFIRMED).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
            p_transfer = s.payments.filter(method=Payment.Method.BANK_TRANSFER, status=Payment.Status.CONFIRMED).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
            p_debt = s.payments.filter(method=Payment.Method.DEBT, status=Payment.Status.CONFIRMED).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")

            sales_records.append({
                "id": s.id,
                "receipt_id": s.receipt_id,
                "customer_name": c_name,
                "customer_phone": c_phone,
                "total_amount": f"{s.total_amount:.2f}",
                "discount_amount": f"{s.discount_amount:.2f}",
                "cash_amount": f"{p_cash:.2f}",
                "transfer_amount": f"{p_transfer:.2f}",
                "debt_amount": f"{p_debt:.2f}",
                "items_count": s.items.count(),
                "created_at": (s.completed_at or s.created_at).isoformat(),
                "operator": str(s.created_by) if s.created_by else "",
            })

        # 7. Debt Payments List
        debt_records = []
        for dp in debt_payments.order_by("-created_at"):
            debt_records.append({
                "id": dp.id,
                "customer_name": dp.customer.full_name,
                "customer_phone": dp.customer.phone_number,
                "amount": f"{dp.amount:.2f}",
                "payment_method": dp.payment_method,
                "notes": dp.notes or "",
                "created_at": dp.created_at.isoformat(),
                "operator": str(dp.operator) if dp.operator else "",
            })

        return Response({
            "period": {
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "generated_at": now_local.isoformat(),
                "is_single_day": start_date == end_date,
            },
            "kpi": {
                "total_revenue": f"{total_revenue:.2f}",
                "subtotal": f"{subtotal:.2f}",
                "total_discount": f"{total_discount:.2f}",
                "sales_count": sales_count,
                "average_basket": f"{average_basket:.2f}",
                # Real cash drawer
                "cash_in_drawer": f"{cash_in_drawer:.2f}",
                "direct_cash": f"{direct_cash:.2f}",
                "debt_cash": f"{debt_cash:.2f}",
                # Bank transfers
                "total_bank_transfer": f"{total_bank_transfer:.2f}",
                "direct_transfer": f"{direct_transfer:.2f}",
                "debt_transfer": f"{debt_transfer:.2f}",
                # Total collected
                "total_real_collected": f"{total_real_collected:.2f}",
                # Debt granted vs recovered
                "new_debt_granted": f"{new_debt_granted:.2f}",
                "total_debt_recovered": f"{total_debt_recovered:.2f}",
                # Profitability
                "total_cogs": f"{total_cogs:.2f}",
                "gross_profit": f"{gross_profit:.2f}",
                "margin_percent": f"{margin_percent:.1f}",
            },
            "breakdown": {
                "devices": {
                    "units": device_units_sold,
                    "revenue": f"{total_device_revenue:.2f}",
                    "cost": f"{total_device_cost:.2f}",
                    "profit": f"{device_profit:.2f}",
                },
                "accessories": {
                    "units": accessory_units_sold,
                    "revenue": f"{total_accessory_revenue:.2f}",
                    "cost": f"{total_accessory_cost:.2f}",
                    "profit": f"{accessory_profit:.2f}",
                },
            },
            "top_products": top_products_formatted,
            "sales": sales_records,
            "debt_repayments": debt_records,
        })

