from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.warranty.models import RepairTicket

User = get_user_model()


class RepairTicketAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="tech_admin",
            password="password123",
            role="ADMIN",
        )
        self.client.force_authenticate(user=self.user)

    def test_create_repair_ticket(self):
        payload = {
            "customer_name": "Yassine Mansouri",
            "customer_phone": "0612345678",
            "device_brand": "Apple",
            "device_model": "iPhone 14 Pro",
            "device_color": "Space Black",
            "imei_or_serial": "358912093812736",
            "passcode": "2580",
            "issue_type": "SCREEN",
            "issue_description": "Écran fissuré suite à une chute, afficheur OLED vert.",
            "estimated_cost": "1200.00",
            "deposit_paid": "400.00",
            "estimated_completion_date": "2026-10-18",
        }
        response = self.client.post("/api/warranty/repairs/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.data
        self.assertTrue(data["ticket_number"].startswith("BP-REP-"))
        self.assertEqual(data["customer_name"], "Yassine Mansouri")
        self.assertEqual(data["device_model"], "iPhone 14 Pro")
        self.assertEqual(data["passcode"], "2580")
        self.assertEqual(data["status"], "RECEIVED")
        self.assertEqual(Decimal(str(data["estimated_cost"])), Decimal("1200.00"))
        self.assertEqual(Decimal(str(data["deposit_paid"])), Decimal("400.00"))
        self.assertEqual(float(data["remaining_balance"]), 800.0)

    def test_filter_and_search_repair_tickets(self):
        RepairTicket.objects.create(
            ticket_number="BP-REP-2026-000001",
            customer_name="Reda Bennani",
            customer_phone="0699887766",
            device_brand="Samsung",
            device_model="Galaxy S23 Ultra",
            issue_type="BATTERY",
            issue_description="Batterie gonflée",
            status="RECEIVED",
            created_by=self.user,
        )
        RepairTicket.objects.create(
            ticket_number="BP-REP-2026-000002",
            customer_name="Fatima Zahra",
            customer_phone="0611223344",
            device_brand="Apple",
            device_model="iPhone 13",
            issue_type="SCREEN",
            issue_description="Vitre cassée",
            status="READY",
            created_by=self.user,
        )

        # Status filter
        res = self.client.get("/api/warranty/repairs/?status=READY")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["ticket_number"], "BP-REP-2026-000002")

        # Search filter by model
        res_search = self.client.get("/api/warranty/repairs/?search=Galaxy")
        self.assertEqual(res_search.status_code, 200)
        self.assertEqual(len(res_search.data), 1)
        self.assertEqual(res_search.data[0]["customer_name"], "Reda Bennani")

        # Search by Brand
        res_brand = self.client.get("/api/warranty/repairs/?search=Apple")
        self.assertEqual(res_brand.status_code, 200)
        self.assertEqual(len(res_brand.data), 1)
        self.assertEqual(res_brand.data[0]["ticket_number"], "BP-REP-2026-000002")

        # Multi-word search (Brand + Model)
        res_multi = self.client.get("/api/warranty/repairs/?search=Samsung Ultra")
        self.assertEqual(res_multi.status_code, 200)
        self.assertEqual(len(res_multi.data), 1)
        self.assertEqual(res_multi.data[0]["customer_name"], "Reda Bennani")

        # Search by issue description
        res_issue = self.client.get("/api/warranty/repairs/?search=gonflée")
        self.assertEqual(res_issue.status_code, 200)
        self.assertEqual(len(res_issue.data), 1)
        self.assertEqual(res_issue.data[0]["customer_name"], "Reda Bennani")

    def test_update_repair_status_pipeline(self):
        ticket = RepairTicket.objects.create(
            ticket_number="BP-REP-2026-000003",
            customer_name="Omar Tazi",
            customer_phone="0655443322",
            device_brand="Xiaomi",
            device_model="Redmi Note 12",
            issue_type="CHARGING_PORT",
            issue_description="Ne charge plus",
            status="RECEIVED",
            estimated_cost=Decimal("250.00"),
            final_cost=Decimal("250.00"),
            created_by=self.user,
        )

        # Update to IN_PROGRESS
        res = self.client.post(
            f"/api/warranty/repairs/{ticket.id}/status/",
            {
                "status": "IN_PROGRESS",
                "technician_notes": "Connecteur USB-C dessoudé, nettoyage effectué.",
                "final_cost": "280.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "IN_PROGRESS")
        self.assertEqual(Decimal(str(res.data["final_cost"])), Decimal("280.00"))

        # Advance to READY
        res_ready = self.client.post(
            f"/api/warranty/repairs/{ticket.id}/status/",
            {"status": "READY"},
            format="json",
        )
        self.assertEqual(res_ready.status_code, 200)
        self.assertEqual(res_ready.data["status"], "READY")
        self.assertIsNotNone(res_ready.data["completed_at"])

    def test_deliver_repair_ticket(self):
        ticket = RepairTicket.objects.create(
            ticket_number="BP-REP-2026-000004",
            customer_name="Hamza Kabbaj",
            customer_phone="0677889900",
            device_brand="Apple",
            device_model="iPhone 12",
            issue_type="SCREEN",
            issue_description="Écran à remplacer",
            status="READY",
            estimated_cost=Decimal("800.00"),
            final_cost=Decimal("800.00"),
            deposit_paid=Decimal("200.00"),
            created_by=self.user,
        )

        res = self.client.post(
            f"/api/warranty/repairs/{ticket.id}/deliver/",
            {
                "payment_method": "CASH",
                "notes": "Remis au client en main propre avec vérification.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "DELIVERED")
        self.assertTrue(res.data["is_paid"])
        self.assertEqual(res.data["payment_method"], "CASH")
        self.assertIsNotNone(res.data["delivered_at"])
