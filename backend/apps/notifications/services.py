from datetime import timedelta
from decimal import Decimal
from django.db import models
from django.utils import timezone

from apps.catalog.models import Product
from apps.customers.models import Customer
from apps.inventory.models import AccessoryStock, DeviceItem
from apps.notifications.models import Notification
from apps.reservations.models import Reservation


class NotificationScanner:
    """Evaluates business rules for low stock, expiring reservations, and debts."""

    @classmethod
    def scan_all(cls) -> dict:
        created_stock = cls.scan_stock()
        created_res = cls.scan_reservations()
        created_debts = cls.scan_debts()
        return {
            "stock_alerts": created_stock,
            "reservation_alerts": created_res,
            "debt_alerts": created_debts,
            "total_new": created_stock + created_res + created_debts,
        }

    @classmethod
    def scan_stock(cls) -> int:
        created_count = 0

        # 1. Accessory stock check (quantity <= reorder_level or quantity == 0)
        low_accessories = AccessoryStock.objects.select_related("product").all()
        for acc in low_accessories:
            ref_type = "ACCESSORY"
            ref_id = str(acc.id)

            is_out = acc.quantity == 0
            is_low = acc.quantity <= acc.reorder_level and acc.reorder_level > 0

            if is_out or is_low:
                # Check if a notification already exists (read or unread)
                existing = Notification.objects.filter(
                    reference_type=ref_type,
                    reference_id=ref_id,
                ).first()

                if not existing:
                    severity = Notification.Severity.CRITICAL if is_out else Notification.Severity.WARNING
                    title = f"Rupture de stock : {acc.product.name}" if is_out else f"Stock faible : {acc.product.name}"
                    message = (
                        f"Le stock d'accessoire est complètement épuisé (0 unité)."
                        if is_out
                        else f"Il ne reste que {acc.quantity} unité(s) en stock (seuil d'alerte configuré : {acc.reorder_level})."
                    )
                    Notification.objects.create(
                        category=Notification.Category.STOCK,
                        severity=severity,
                        title=title,
                        message=message,
                        reference_type=ref_type,
                        reference_id=ref_id,
                        action_url="/accessories",
                    )
                    created_count += 1
                elif is_out and existing.severity != Notification.Severity.CRITICAL:
                    # Upgrade to critical only if condition worsened to total rupture
                    existing.severity = Notification.Severity.CRITICAL
                    existing.title = f"Rupture de stock : {acc.product.name}"
                    existing.message = f"Le stock d'accessoire est complètement épuisé (0 unité)."
                    existing.is_read = False
                    existing.save(update_fields=["severity", "title", "message", "is_read"])
            else:
                # Auto-resolve if restocked
                Notification.objects.filter(
                    reference_type=ref_type,
                    reference_id=ref_id,
                ).delete()

        # 2. Device stock check (models with 0 or 1 in-stock unit)
        device_products = (
            Product.objects.filter(category__is_device=True, is_active=True)
            .annotate(
                in_stock_count=models.Count(
                    "device_items",
                    filter=models.Q(device_items__status=DeviceItem.Status.IN_STOCK),
                )
            )
        )

        for prod in device_products:
            ref_type = "PRODUCT_DEVICE"
            ref_id = str(prod.id)

            if prod.in_stock_count <= 1:
                existing = Notification.objects.filter(
                    reference_type=ref_type,
                    reference_id=ref_id,
                ).first()

                if not existing:
                    is_zero = prod.in_stock_count == 0
                    severity = Notification.Severity.CRITICAL if is_zero else Notification.Severity.WARNING
                    title = (
                        f"Rupture téléphone : {prod.name}"
                        if is_zero
                        else f"Dernier appareil en stock : {prod.name}"
                    )
                    message = (
                        f"Aucun appareil disponible en rayon pour ce modèle."
                        if is_zero
                        else f"Attention, il ne reste plus qu'un seul appareil disponible en stock (1 unité)."
                    )
                    Notification.objects.create(
                        category=Notification.Category.STOCK,
                        severity=severity,
                        title=title,
                        message=message,
                        reference_type=ref_type,
                        reference_id=ref_id,
                        action_url="/devices",
                    )
                    created_count += 1
                elif prod.in_stock_count == 0 and existing.severity != Notification.Severity.CRITICAL:
                    # Upgrade to critical only if stock dropped from 1 to 0
                    existing.severity = Notification.Severity.CRITICAL
                    existing.title = f"Rupture téléphone : {prod.name}"
                    existing.message = f"Aucun appareil disponible en rayon pour ce modèle."
                    existing.is_read = False
                    existing.save(update_fields=["severity", "title", "message", "is_read"])
            else:
                # Auto-resolve if restocked (> 1)
                Notification.objects.filter(
                    reference_type=ref_type,
                    reference_id=ref_id,
                ).delete()

        return created_count

    @classmethod
    def scan_reservations(cls) -> int:
        created_count = 0
        now = timezone.now()

        # 1. Expired active reservations
        expired_reservations = Reservation.objects.select_related(
            "customer", "device__product"
        ).filter(
            status=Reservation.Status.ACTIVE,
            expires_at__lt=now,
        )

        for res in expired_reservations:
            ref_type = "RESERVATION_EXPIRED"
            ref_id = str(res.id)

            existing = Notification.objects.filter(
                reference_type=ref_type,
                reference_id=ref_id,
            ).first()

            if not existing:
                device_name = res.device.product.name if res.device else "Appareil"
                Notification.objects.create(
                    category=Notification.Category.RESERVATION,
                    severity=Notification.Severity.CRITICAL,
                    title=f"Réservation expirée : {res.reservation_number}",
                    message=(
                        f"La réservation de {res.customer.full_name} ({device_name}) "
                        f"a expiré le {res.expires_at.strftime('%d/%m/%Y à %H:%M')}. "
                        f"L'appareil peut être libéré pour remise en vente."
                    ),
                    reference_type=ref_type,
                    reference_id=ref_id,
                    action_url="/reservations",
                )
                created_count += 1

        # 2. Reservations expiring in next 24 hours
        expiring_soon = Reservation.objects.select_related(
            "customer", "device__product"
        ).filter(
            status=Reservation.Status.ACTIVE,
            expires_at__gte=now,
            expires_at__lte=now + timedelta(hours=24),
        )

        for res in expiring_soon:
            ref_type = "RESERVATION_SOON"
            ref_id = str(res.id)

            existing = Notification.objects.filter(
                reference_type=ref_type,
                reference_id=ref_id,
            ).first()

            if not existing:
                device_name = res.device.product.name if res.device else "Appareil"
                Notification.objects.create(
                    category=Notification.Category.RESERVATION,
                    severity=Notification.Severity.WARNING,
                    title=f"Réservation expire bientôt : {res.reservation_number}",
                    message=(
                        f"La réservation de {res.customer.full_name} ({device_name}) "
                        f"expire le {res.expires_at.strftime('%d/%m/%Y à %H:%M')} (moins de 24h restantes)."
                    ),
                    reference_type=ref_type,
                    reference_id=ref_id,
                    action_url="/reservations",
                )
                created_count += 1

        # Auto-resolve notifications for reservations no longer ACTIVE (e.g. COMPLETED or CANCELLED)
        active_res_ids = set(
            Reservation.objects.filter(status=Reservation.Status.ACTIVE).values_list("id", flat=True)
        )
        Notification.objects.filter(
            reference_type__in=["RESERVATION_EXPIRED", "RESERVATION_SOON"],
        ).exclude(reference_id__in=[str(rid) for rid in active_res_ids]).delete()

        return created_count

    @classmethod
    def scan_debts(cls) -> int:
        created_count = 0
        now = timezone.now()

        # Customers with positive debt
        debtor_customers = Customer.objects.filter(current_debt__gt=Decimal("0.00")).order_by("-current_debt")

        for cust in debtor_customers:
            ref_type = "CUSTOMER_DEBT"
            ref_id = str(cust.id)

            is_over_limit = cust.credit_limit > 0 and cust.current_debt > cust.credit_limit

            existing = Notification.objects.filter(
                reference_type=ref_type,
                reference_id=ref_id,
            ).first()

            if not existing:
                severity = Notification.Severity.CRITICAL if is_over_limit else Notification.Severity.WARNING
                title = (
                    f"Dépassement crédit : {cust.full_name}"
                    if is_over_limit
                    else f"Créance client : {cust.full_name}"
                )
                formatted_debt = f"{cust.current_debt:,.2f} MAD"
                extra = (
                    f" (Plafond autorisé de {cust.credit_limit:,.2f} MAD dépassé !)"
                    if is_over_limit
                    else f" en attente de règlement."
                )
                message = f"Le solde dû par le client est de {formatted_debt}{extra}"

                Notification.objects.create(
                    category=Notification.Category.DEBT,
                    severity=severity,
                    title=title,
                    message=message,
                    reference_type=ref_type,
                    reference_id=ref_id,
                    action_url="/customers",
                )
                created_count += 1

        # Auto-resolve for customers who cleared their debt (current_debt == 0)
        debtor_ids = set(Customer.objects.filter(current_debt__gt=0).values_list("id", flat=True))
        Notification.objects.filter(
            reference_type="CUSTOMER_DEBT",
            is_read=False,
        ).exclude(reference_id__in=[str(cid) for cid in debtor_ids]).update(
            is_read=True, read_at=now
        )

        return created_count
