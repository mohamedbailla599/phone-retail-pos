from django.db import models


class WarrantyClaim(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        REPAIR = "REPAIR", "Repair"
        SALE_CANCELLED = "SALE_CANCELLED", "Sale Cancelled"
        REJECTED = "REJECTED", "Rejected"
        RESOLVED = "RESOLVED", "Resolved"

    claim_number = models.CharField(
        max_length=30,
        unique=True,
    )

    transaction = models.ForeignKey(
        "sales.Transaction",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
    )

    transaction_item = models.ForeignKey(
        "sales.TransactionItem",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
    )

    device = models.ForeignKey(
        "inventory.DeviceItem",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
        null=True,
        blank=True,
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
    )

    opened_at = models.DateTimeField()

    problem_description = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    resolution = models.TextField(
        null=True,
        blank=True,
    )

    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    resolved_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="warranty_claims_resolved",
        null=True,
        blank=True,
    )

    owner_notes = models.TextField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at", "-id"]

        indexes = [
            models.Index(
                fields=["status", "created_at"]
            ),
            models.Index(
                fields=["customer", "created_at"]
            ),
            models.Index(
                fields=["transaction", "created_at"]
            ),
            models.Index(
                fields=["device", "created_at"]
            ),
        ]

    def __str__(self):
        return (
            f"{self.claim_number} — "
            f"{self.status}"
        )


class RepairTicket(models.Model):
    class IssueType(models.TextChoices):
        SCREEN = "SCREEN", "Écran / Vitre cassée"
        BATTERY = "BATTERY", "Batterie / Autonomie"
        CHARGING_PORT = "CHARGING_PORT", "Connecteur de charge / Port"
        BACK_GLASS = "BACK_GLASS", "Vitre arrière / Châssis"
        CAMERA = "CAMERA", "Caméra / Lentille"
        WATER_DAMAGE = "WATER_DAMAGE", "Oxydation / Dégât des eaux"
        SPEAKER_MIC = "SPEAKER_MIC", "Micro / Haut-parleur / Écouteur"
        SOFTWARE = "SOFTWARE", "Système / Déblocage / Flash"
        MOTHERBOARD = "MOTHERBOARD", "Carte Mère / Micro-soudure"
        OTHER = "OTHER", "Autre panne / Diagnostic global"

    class Status(models.TextChoices):
        RECEIVED = "RECEIVED", "Reçu"
        DIAGNOSING = "DIAGNOSING", "En diagnostic"
        WAITING_PARTS = "WAITING_PARTS", "En attente de pièces"
        IN_PROGRESS = "IN_PROGRESS", "En cours de réparation"
        READY = "READY", "Prêt pour retrait"
        DELIVERED = "DELIVERED", "Livré & Clôturé"
        CANCELLED = "CANCELLED", "Annulé"

    ticket_number = models.CharField(
        max_length=30,
        unique=True,
    )

    # Customer info
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        related_name="repair_tickets",
        null=True,
        blank=True,
    )
    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=50)

    # Device info
    device_brand = models.CharField(max_length=50)
    device_model = models.CharField(max_length=100)
    device_color = models.CharField(max_length=50, null=True, blank=True)
    imei_or_serial = models.CharField(max_length=50, null=True, blank=True)
    passcode = models.CharField(max_length=50, null=True, blank=True)

    # Issue details
    issue_type = models.CharField(
        max_length=30,
        choices=IssueType.choices,
        default=IssueType.SCREEN,
    )
    issue_description = models.TextField()
    technician_notes = models.TextField(null=True, blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RECEIVED,
    )

    # Financials
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
    )
    final_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
    )
    deposit_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
    )
    is_paid = models.BooleanField(default=False)
    payment_method = models.CharField(
        max_length=20,
        null=True,
        blank=True,
    )

    warranty_days = models.PositiveIntegerField(default=90)

    # Operators / Actors
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="repairs_created",
    )
    assigned_technician = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="repairs_assigned",
        null=True,
        blank=True,
    )

    estimated_completion_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["customer_phone"]),
            models.Index(fields=["ticket_number"]),
        ]

    def __str__(self):
        return f"{self.ticket_number} — {self.device_model} ({self.status})"