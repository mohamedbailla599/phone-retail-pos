from decimal import Decimal

from apps.exchanges.models import Exchange
from apps.exchanges.services.exchanges import (
    approve_exchange,
    complete_exchange,
    create_exchange,
    reject_exchange,
    submit_exchange_for_review,
)
from apps.exchanges.services.settlement import (
    complete_exchange_refund,
    create_exchange_payment,
    create_exchange_refund,
)
from apps.inventory.models import DeviceItem, StockMovement
from apps.payments.models import Payment
from apps.payments.services.payments import confirm_bank_transfer
from apps.refunds.models import Refund

from .base import ExchangeTestCase


class ExchangeServiceTest(ExchangeTestCase):
    def test_customer_pays_exchange(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="111111111111111",
            status=DeviceItem.Status.SOLD,
            selling="4000.00",
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="222222222222222",
            status=DeviceItem.Status.IN_STOCK,
            selling="5500.00",
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("4000.00"),
            new_device_price=Decimal("5500.00"),
            reason="Customer wants an upgrade.",
            actor=self.owner,
        )
        self.assertEqual(exchange.status, Exchange.Status.REQUESTED)
        self.assertEqual(exchange.difference_amount, Decimal("1500.00"))
        self.assertEqual(
            exchange.financial_direction,
            Exchange.FinancialDirection.CUSTOMER_PAYS,
        )

        submit_exchange_for_review(exchange_id=exchange.id, actor=self.owner)
        approve_exchange(exchange_id=exchange.id, actor=self.owner)
        create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("1500.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )
        complete_exchange(exchange_id=exchange.id, actor=self.owner)

        old_device.refresh_from_db()
        new_device.refresh_from_db()
        exchange.refresh_from_db()

        self.assertEqual(old_device.status, DeviceItem.Status.IN_STOCK)
        self.assertEqual(new_device.status, DeviceItem.Status.SOLD)
        self.assertEqual(exchange.status, Exchange.Status.COMPLETED)
        self.assertEqual(
            StockMovement.objects.filter(
                reference_type="Exchange",
                reference_id=exchange.id,
            ).count(),
            2,
        )

    def test_store_refunds_exchange(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="333333333333333",
            status=DeviceItem.Status.SOLD,
            selling="5000.00",
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="444444444444444",
            status=DeviceItem.Status.IN_STOCK,
            selling="4000.00",
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("5000.00"),
            new_device_price=Decimal("4000.00"),
            actor=self.owner,
        )
        self.assertEqual(exchange.difference_amount, Decimal("1000.00"))
        self.assertEqual(
            exchange.financial_direction,
            Exchange.FinancialDirection.STORE_REFUNDS,
        )
        submit_exchange_for_review(exchange_id=exchange.id, actor=self.owner)
        approve_exchange(exchange_id=exchange.id, actor=self.owner)
        refund = create_exchange_refund(
            exchange_id=exchange.id,
            method=Refund.Method.CASH,
            actor=self.owner,
            reason="Exchange refund.",
        )
        complete_exchange_refund(refund_id=refund.id, actor=self.owner)
        complete_exchange(exchange_id=exchange.id, actor=self.owner)

        exchange.refresh_from_db()
        self.assertEqual(exchange.status, Exchange.Status.COMPLETED)

    def test_even_exchange(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="555555555555555",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="666666666666666",
            status=DeviceItem.Status.IN_STOCK,
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("4000.00"),
            new_device_price=Decimal("4000.00"),
            actor=self.owner,
        )
        self.assertEqual(exchange.difference_amount, Decimal("0.00"))
        self.assertEqual(
            exchange.financial_direction,
            Exchange.FinancialDirection.EVEN,
        )

    def test_reject_exchange(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="777777777777777",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="888888888888888",
            status=DeviceItem.Status.IN_STOCK,
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("4000.00"),
            new_device_price=Decimal("4500.00"),
            actor=self.owner,
        )
        reject_exchange(
            exchange_id=exchange.id,
            actor=self.owner,
            reason="Exchange rejected by owner.",
        )
        exchange.refresh_from_db()
        self.assertEqual(exchange.status, Exchange.Status.REJECTED)

    def test_old_device_must_be_sold(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="999999999999999",
            status=DeviceItem.Status.IN_STOCK,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="101010101010101",
            status=DeviceItem.Status.IN_STOCK,
        )
        sale = self.create_completed_sale(old_device)
        with self.assertRaises(Exception):
            create_exchange(
                customer=self.customer,
                original_transaction=sale,
                old_device=old_device,
                new_device=new_device,
                old_device_value=Decimal("4000.00"),
                new_device_price=Decimal("4500.00"),
                actor=self.owner,
            )

    def test_new_device_must_be_in_stock(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="121212121212121",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="131313131313131",
            status=DeviceItem.Status.SOLD,
        )
        sale = self.create_completed_sale(old_device)
        with self.assertRaises(Exception):
            create_exchange(
                customer=self.customer,
                original_transaction=sale,
                old_device=old_device,
                new_device=new_device,
                old_device_value=Decimal("4000.00"),
                new_device_price=Decimal("4500.00"),
                actor=self.owner,
            )

    def test_same_device_cannot_be_used_twice(self):
        device = self.create_device(
            product=self.old_product,
            imei="141414141414141",
            status=DeviceItem.Status.SOLD,
        )
        sale = self.create_completed_sale(device)
        with self.assertRaises(Exception):
            create_exchange(
                customer=self.customer,
                original_transaction=sale,
                old_device=device,
                new_device=device,
                old_device_value=Decimal("4000.00"),
                new_device_price=Decimal("4000.00"),
                actor=self.owner,
            )

    def test_exchange_cannot_complete_twice(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="151515151515151",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="161616161616161",
            status=DeviceItem.Status.IN_STOCK,
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("4000.00"),
            new_device_price=Decimal("4500.00"),
            actor=self.owner,
        )
        submit_exchange_for_review(exchange_id=exchange.id, actor=self.owner)
        approve_exchange(exchange_id=exchange.id, actor=self.owner)
        create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("500.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )
        complete_exchange(exchange_id=exchange.id, actor=self.owner)
        with self.assertRaises(Exception):
            complete_exchange(exchange_id=exchange.id, actor=self.owner)

    def test_customer_pays_without_payment_cannot_complete(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="171717171717171",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="181818181818181",
            status=DeviceItem.Status.IN_STOCK,
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("4000.00"),
            new_device_price=Decimal("4500.00"),
            actor=self.owner,
        )
        submit_exchange_for_review(exchange_id=exchange.id, actor=self.owner)
        approve_exchange(exchange_id=exchange.id, actor=self.owner)
        with self.assertRaises(Exception):
            complete_exchange(exchange_id=exchange.id, actor=self.owner)
        old_device.refresh_from_db()
        new_device.refresh_from_db()
        self.assertEqual(old_device.status, DeviceItem.Status.SOLD)
        self.assertEqual(new_device.status, DeviceItem.Status.IN_STOCK)

    def test_customer_pays_bank_transfer_pending_cannot_complete(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="191919191919191",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="202020202020202",
            status=DeviceItem.Status.IN_STOCK,
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("4000.00"),
            new_device_price=Decimal("4500.00"),
            actor=self.owner,
        )
        submit_exchange_for_review(exchange_id=exchange.id, actor=self.owner)
        approve_exchange(exchange_id=exchange.id, actor=self.owner)
        _, payment = create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("500.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
        )
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)
        with self.assertRaises(Exception):
            complete_exchange(exchange_id=exchange.id, actor=self.owner)
        old_device.refresh_from_db()
        new_device.refresh_from_db()
        self.assertEqual(old_device.status, DeviceItem.Status.SOLD)
        self.assertEqual(new_device.status, DeviceItem.Status.IN_STOCK)

    def test_customer_pays_bank_transfer_confirmed_can_complete(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="212121212121212",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="222222222222222",
            status=DeviceItem.Status.IN_STOCK,
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("4000.00"),
            new_device_price=Decimal("4500.00"),
            actor=self.owner,
        )
        submit_exchange_for_review(exchange_id=exchange.id, actor=self.owner)
        approve_exchange(exchange_id=exchange.id, actor=self.owner)
        _, payment = create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("500.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
        )
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)
        payment = confirm_bank_transfer(payment_id=payment.id, actor=self.owner)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.CONFIRMED)
        complete_exchange(exchange_id=exchange.id, actor=self.owner)
        old_device.refresh_from_db()
        new_device.refresh_from_db()
        exchange.refresh_from_db()
        self.assertEqual(old_device.status, DeviceItem.Status.IN_STOCK)
        self.assertEqual(new_device.status, DeviceItem.Status.SOLD)
        self.assertEqual(exchange.status, Exchange.Status.COMPLETED)

    def test_store_refund_not_completed_cannot_complete_exchange(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="232323232323232",
            status=DeviceItem.Status.SOLD,
            selling="5000.00",
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="242424242424242",
            status=DeviceItem.Status.IN_STOCK,
            selling="4000.00",
        )
        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal("5000.00"),
            new_device_price=Decimal("4000.00"),
            actor=self.owner,
        )
        submit_exchange_for_review(exchange_id=exchange.id, actor=self.owner)
        approve_exchange(exchange_id=exchange.id, actor=self.owner)
        refund = create_exchange_refund(
            exchange_id=exchange.id,
            method=Refund.Method.CASH,
            actor=self.owner,
            reason="Exchange refund protection test.",
        )
        refund.refresh_from_db()
        self.assertEqual(refund.status, Refund.Status.REQUESTED)
        with self.assertRaises(Exception):
            complete_exchange(exchange_id=exchange.id, actor=self.owner)
        old_device.refresh_from_db()
        new_device.refresh_from_db()
        exchange.refresh_from_db()
        self.assertEqual(old_device.status, DeviceItem.Status.SOLD)
        self.assertEqual(new_device.status, DeviceItem.Status.IN_STOCK)
        self.assertEqual(exchange.status, Exchange.Status.APPROVED)
