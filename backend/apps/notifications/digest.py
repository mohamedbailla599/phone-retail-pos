import logging
from datetime import datetime, time
from decimal import Decimal
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import models
from django.utils import timezone

from apps.catalog.models import Product
from apps.customers.models import Customer
from apps.inventory.models import AccessoryStock, DeviceItem
from apps.notifications.models import Notification
from apps.payments.models import Payment
from apps.reservations.models import Reservation
from apps.sales.models import Transaction
from apps.store_settings.models import StoreSettings

logger = logging.getLogger(__name__)


def get_daily_digest_data(target_date=None) -> dict:
    """Collects financial, stock, reservation, and debt metrics for target date."""
    if target_date is None:
        target_date = timezone.localtime().date()

    start_of_day = timezone.make_aware(datetime.combine(target_date, time.min))
    end_of_day = timezone.make_aware(datetime.combine(target_date, time.max))

    # 1. Sales & Financials for the day
    daily_transactions = Transaction.objects.filter(
        created_at__range=(start_of_day, end_of_day),
        status=Transaction.Status.COMPLETED,
    )
    total_sales_count = daily_transactions.count()
    total_revenue = daily_transactions.aggregate(total=models.Sum("total_amount"))["total"] or Decimal("0.00")

    # Payment breakdown
    payments_today = Payment.objects.filter(
        transaction__created_at__range=(start_of_day, end_of_day),
        status=Payment.Status.CONFIRMED,
    )
    cash_total = (
        payments_today.filter(method=Payment.Method.CASH).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    transfer_total = (
        payments_today.filter(method=Payment.Method.BANK_TRANSFER).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )
    debt_total = (
        payments_today.filter(method=Payment.Method.DEBT).aggregate(total=models.Sum("amount"))["total"]
        or Decimal("0.00")
    )

    # 2. Critical Inventory & Out of Stock
    # Phones
    device_products = (
        Product.objects.filter(category__is_device=True, is_active=True)
        .annotate(
            in_stock_count=models.Count(
                "device_items",
                filter=models.Q(device_items__status=DeviceItem.Status.IN_STOCK),
            )
        )
        .filter(in_stock_count__lte=1)
        .order_by("in_stock_count", "name")
    )
    low_device_items = [
        {"name": p.name, "brand": p.brand, "count": p.in_stock_count} for p in device_products[:15]
    ]

    # Accessories
    low_accessories = (
        AccessoryStock.objects.select_related("product")
        .filter(models.Q(quantity__lte=models.F("reorder_level")) | models.Q(quantity=0))
        .order_by("quantity", "product__name")
    )
    low_accessory_items = [
        {"name": a.product.name, "quantity": a.quantity, "reorder_level": a.reorder_level}
        for a in low_accessories[:15]
    ]

    # 3. Reservations Expirations
    now = timezone.now()
    expired_reservations = Reservation.objects.select_related("customer", "device__product").filter(
        status=Reservation.Status.ACTIVE,
        expires_at__lt=now,
    )[:10]
    expired_res_list = [
        {
            "number": r.reservation_number,
            "customer": r.customer.full_name,
            "device": r.device.product.name if r.device else "Appareil",
            "expires_at": timezone.localtime(r.expires_at).strftime("%d/%m/%Y %H:%M"),
        }
        for r in expired_reservations
    ]

    # Tomorrow expiring
    tomorrow_end = now + timezone.timedelta(days=1)
    expiring_soon_res = Reservation.objects.select_related("customer", "device__product").filter(
        status=Reservation.Status.ACTIVE,
        expires_at__gte=now,
        expires_at__lte=tomorrow_end,
    )[:10]
    expiring_soon_list = [
        {
            "number": r.reservation_number,
            "customer": r.customer.full_name,
            "device": r.device.product.name if r.device else "Appareil",
            "expires_at": timezone.localtime(r.expires_at).strftime("%d/%m/%Y %H:%M"),
        }
        for r in expiring_soon_res
    ]

    # 4. Debts Summary
    debtor_customers = Customer.objects.filter(current_debt__gt=0).order_by("-current_debt")
    total_outstanding_debt = debtor_customers.aggregate(total=models.Sum("current_debt"))["total"] or Decimal("0.00")
    top_debtors = [
        {"name": c.full_name, "phone": c.phone_number, "debt": c.current_debt}
        for c in debtor_customers[:10]
    ]

    # Store Settings
    store_settings = StoreSettings.objects.first()
    store_name = store_settings.store_name if store_settings else "Bighrissen Phone"

    return {
        "store_name": store_name,
        "date_str": target_date.strftime("%d/%m/%Y"),
        "total_sales_count": total_sales_count,
        "total_revenue": total_revenue,
        "cash_total": cash_total,
        "transfer_total": transfer_total,
        "debt_total": debt_total,
        "low_device_items": low_device_items,
        "low_accessory_items": low_accessory_items,
        "expired_reservations": expired_res_list,
        "expiring_soon_reservations": expiring_soon_list,
        "total_outstanding_debt": total_outstanding_debt,
        "top_debtors": top_debtors,
    }


def render_daily_digest_html(data: dict) -> str:
    """Renders a modern, responsive HTML email for the 23:00 daily digest."""
    store_name = data["store_name"]
    date_str = data["date_str"]

    # Device rows
    device_rows = ""
    for d in data["low_device_items"]:
        status_color = "#ef4444" if d["count"] == 0 else "#f59e0b"
        status_text = "RUPTURE (0)" if d["count"] == 0 else "1 restant"
        device_rows += f"""
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">{d['name']}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 12px;">{d['brand']}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; text-align: right;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: {status_color}25; color: {status_color}; border: 1px solid {status_color}50;">
              {status_text}
            </span>
          </td>
        </tr>
        """
    if not device_rows:
        device_rows = """<tr><td colspan="3" style="padding: 12px; text-align: center; color: #10b981; font-size: 13px;">[OK] Tous les stocks telephnes sont suffisants.</td></tr>"""

    # Accessory rows
    accessory_rows = ""
    for a in data["low_accessory_items"]:
        status_color = "#ef4444" if a["quantity"] == 0 else "#f59e0b"
        status_text = "RUPTURE (0)" if a["quantity"] == 0 else f"{a['quantity']} restants (seuil: {a['reorder_level']})"
        accessory_rows += f"""
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">{a['name']}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; text-align: right;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: {status_color}25; color: {status_color}; border: 1px solid {status_color}50;">
              {status_text}
            </span>
          </td>
        </tr>
        """
    if not accessory_rows:
        accessory_rows = """<tr><td colspan="2" style="padding: 12px; text-align: center; color: #10b981; font-size: 13px;">[OK] Tous les accessoires sont au-dessus du seuil.</td></tr>"""

    # Reservations rows
    res_rows = ""
    for r in data["expired_reservations"]:
        res_rows += f"""
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #ef4444; font-weight: 600; font-size: 12px;">{r['number']}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">{r['customer']} ({r['device']})</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; text-align: right; color: #ef4444; font-size: 12px;">Expirée ({r['expires_at']})</td>
        </tr>
        """
    for r in data["expiring_soon_reservations"]:
        res_rows += f"""
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #d4af5a; font-weight: 600; font-size: 12px;">{r['number']}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">{r['customer']} ({r['device']})</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; text-align: right; color: #f59e0b; font-size: 12px;">Expire demain ({r['expires_at']})</td>
        </tr>
        """
    if not res_rows:
        res_rows = """<tr><td colspan="3" style="padding: 12px; text-align: center; color: #10b981; font-size: 13px;">[OK] Aucune reservation expiree ou en retard.</td></tr>"""

    # Debts rows
    debt_rows = ""
    for c in data["top_debtors"]:
        debt_rows += f"""
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px; font-weight: 600;">{c['name']}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 12px;">{c['phone']}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; text-align: right; color: #ef4444; font-size: 13px; font-weight: 700;">{c['debt']:,.2f} MAD</td>
        </tr>
        """
    if not debt_rows:
        debt_rows = """<tr><td colspan="3" style="padding: 12px; text-align: center; color: #10b981; font-size: 13px;">[OK] Aucune creance client en attente.</td></tr>"""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recapitulatif Quotidien - {store_name}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #09090b; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; background-color: #121214; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 24px 30px; background: linear-gradient(135deg, #18181b 0%, #09090b 100%); border-bottom: 1px solid #d4af5a40;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #d4af5a; font-weight: 700;">Rapport de Cloture 23h00</span>
                        <h1 style="margin: 4px 0 0 0; font-size: 22px; color: #ffffff; font-weight: 800;">{store_name}</h1>
                      </td>
                      <td align="right">
                        <span style="display: inline-block; padding: 6px 14px; background-color: #27272a; border-radius: 8px; color: #e4e4e7; font-size: 13px; font-weight: 600;">
                          Date : {date_str}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Financial Summary Cards -->
              <tr>
                <td style="padding: 24px 30px 10px 30px;">
                  <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #d4af5a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">[Bilan Financier du Jour]</h3>
                  <table width="100%" cellpadding="0" cellspacing="6">
                    <tr>
                      <td width="50%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 14px;">
                        <span style="font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Chiffre d'Affaires</span>
                        <div style="font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 4px;">{data['total_revenue']:,.2f} MAD</div>
                        <span style="font-size: 11px; color: #10b981;">{data['total_sales_count']} vente(s) realisee(s)</span>
                      </td>
                      <td width="50%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 14px;">
                        <span style="font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Encaissement Especes</span>
                        <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 4px;">{data['cash_total']:,.2f} MAD</div>
                        <span style="font-size: 11px; color: #a1a1aa;">Virement : {data['transfer_total']:,.2f} MAD</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Stock Alerts Section -->
              <tr>
                <td style="padding: 16px 30px 10px 30px;">
                  <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #d4af5a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">[Alertes Reapprovisionnement & Ruptures]</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #27272a; border-radius: 10px; overflow: hidden; background-color: #18181b;">
                    <tr style="background-color: #27272a50;">
                      <th align="left" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Article</th>
                      <th align="left" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Details</th>
                      <th align="right" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Etat</th>
                    </tr>
                    {device_rows}
                    {accessory_rows}
                  </table>
                </td>
              </tr>

              <!-- Reservations Section -->
              <tr>
                <td style="padding: 16px 30px 10px 30px;">
                  <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #d4af5a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">[Suivi des Reservations]</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #27272a; border-radius: 10px; overflow: hidden; background-color: #18181b;">
                    <tr style="background-color: #27272a50;">
                      <th align="left" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">N° Reservation</th>
                      <th align="left" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Client & Appareil</th>
                      <th align="right" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Statut</th>
                    </tr>
                    {res_rows}
                  </table>
                </td>
              </tr>

              <!-- Debts Section -->
              <tr>
                <td style="padding: 16px 30px 24px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                    <tr>
                      <td><h3 style="margin: 0; font-size: 14px; color: #d4af5a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">[Dettes Clients en Attente]</h3></td>
                      <td align="right"><span style="font-size: 12px; color: #ef4444; font-weight: 700;">Total : {data['total_outstanding_debt']:,.2f} MAD</span></td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #27272a; border-radius: 10px; overflow: hidden; background-color: #18181b;">
                    <tr style="background-color: #27272a50;">
                      <th align="left" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Client</th>
                      <th align="left" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Telephone</th>
                      <th align="right" style="padding: 8px 12px; font-size: 11px; color: #a1a1aa; text-transform: uppercase;">Solde Du</th>
                    </tr>
                    {debt_rows}
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 18px 30px; background-color: #18181b; border-top: 1px solid #27272a; text-align: center; color: #71717a; font-size: 11px;">
                  Genere automatiquement a 23h00 par <strong>Bighrissen Phone ERP</strong> - Systeme Local
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    return html


def send_daily_digest(recipient_email=None, target_date=None, force=False) -> dict:
    """Generates and sends the daily digest email."""
    # Find recipient email
    if not recipient_email:
        store_settings = StoreSettings.objects.first()
        if store_settings and hasattr(store_settings, "owner_email") and store_settings.owner_email:
            recipient_email = store_settings.owner_email
        else:
            recipient_email = getattr(settings, "OWNER_EMAIL", None) or getattr(settings, "DEFAULT_FROM_EMAIL", None)

    if not recipient_email:
        recipient_email = "owner@bighrissenphone.local"

    data = get_daily_digest_data(target_date=target_date)
    html_content = render_daily_digest_html(data)
    text_content = (
        f"Recapitulatif Quotidien - {data['store_name']} ({data['date_str']})\n\n"
        f"Ventes du jour: {data['total_sales_count']} ventes, Total: {data['total_revenue']} MAD\n"
        f"Especes: {data['cash_total']} MAD, Virement: {data['transfer_total']} MAD\n"
        f"Dettes en cours: {data['total_outstanding_debt']} MAD\n"
        f"Stock critique: {len(data['low_device_items'])} telephones, {len(data['low_accessory_items'])} accessoires\n"
    )

    subject = f"[Bighrissen Phone] Recapitulatif Quotidien {data['date_str']}"
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "Bighrissen Phone <noreply@bighrissenphone.local>")

    msg = EmailMultiAlternatives(subject, text_content, from_email, [recipient_email])
    msg.attach_alternative(html_content, "text/html")

    try:
        sent_count = msg.send(fail_silently=False)
        logger.info(f"Daily digest sent successfully to {recipient_email}")

        # Also log a SYSTEM notification in the app
        Notification.objects.create(
            category=Notification.Category.SYSTEM,
            severity=Notification.Severity.INFO,
            title=f"Recapitulatif 23h00 envoye ({data['date_str']})",
            message=f"Le rapport de cloture quotidienne a ete genere et expedie a {recipient_email}.",
            action_url="/dashboard",
        )

        return {
            "status": "success",
            "recipient": recipient_email,
            "sent_count": sent_count,
            "summary": data,
        }
    except Exception as exc:
        logger.error(f"Failed to send daily digest to {recipient_email}: {exc}")
        return {
            "status": "error",
            "recipient": recipient_email,
            "error": str(exc),
            "summary": data,
        }
