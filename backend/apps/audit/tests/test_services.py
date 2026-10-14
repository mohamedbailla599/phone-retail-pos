from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.audit.models import AuditLog
from apps.audit.services import record_audit


User = get_user_model()


class AuditServiceTestCase(TestCase):
    def setUp(self):
        self.operator = User.objects.create_user(
            username="hassan",
            first_name="Hassan",
            role=User.Role.OWNER,
            is_pos_operator=True,
        )
        self.admin = User.objects.create_user(
            username="admin",
            role=User.Role.OWNER,
            is_pos_account=True,
        )

    def test_record_audit_uses_selected_operator(self):
        audit = record_audit(
            actor=self.operator,
            action=AuditLog.Action.USER_UPDATED,
            entity_type="User",
            entity_id=self.admin.id,
            old_values={"is_active": True},
            new_values={"is_active": False},
            reason="Test audit",
        )

        self.assertEqual(audit.actor_id, self.operator.id)
        self.assertEqual(audit.entity_id, self.admin.id)
        self.assertEqual(audit.reason, "Test audit")

    def test_shared_pos_account_cannot_be_audit_actor(self):
        with self.assertRaises(ValueError):
            record_audit(
                actor=self.admin,
                action=AuditLog.Action.USER_UPDATED,
                entity_type="User",
                entity_id=self.operator.id,
            )
