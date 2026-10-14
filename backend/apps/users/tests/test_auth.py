from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class POSAuthenticationAPITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            username="admin",
            password="test-pos-password",
            role=User.Role.OWNER,
            is_pos_account=True,
        )
        cls.hassan = User.objects.create_user(
            username="hassan",
            first_name="Hassan",
            role=User.Role.OWNER,
            is_pos_operator=True,
        )
        cls.mohamed = User.objects.create_user(
            username="mohamed",
            first_name="Mohamed",
            role=User.Role.OWNER,
            is_pos_operator=True,
        )
        cls.non_operator = User.objects.create_user(
            username="non_operator",
            password="non_operator-password",
            role=User.Role.OWNER,
            is_pos_operator=False,
        )

    def test_login_requires_valid_pos_account(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            "/api/auth/login/",
            {"username": "cashier", "password": "cashier-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_creates_shared_pos_session(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "test-pos-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["authenticated"])
        self.assertEqual(response.data["user"]["username"], "admin")
        self.assertIsNone(response.data["operator"])

        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "admin")
        self.assertIsNone(response.data["operator"])

    def test_unauthenticated_user_cannot_access_operators(self):
        response = self.client.get("/api/auth/operators/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_operator_list_contains_only_active_owner_operators(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/auth/operators/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["username"] for item in response.data},
            {"hassan", "mohamed"},
        )

    def test_operator_is_selected_for_an_operation_without_relogin(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/auth/operators/select/",
            {"operator_id": self.hassan.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        hassan_context = response.data["operator_context"]
        self.assertEqual(response.data["operator"]["username"], "hassan")

        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.data["operator"]["username"], "hassan")

        response = self.client.post(
            "/api/auth/operators/select/",
            {"operator_id": self.mohamed.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mohamed_context = response.data["operator_context"]
        self.assertNotEqual(hassan_context, mohamed_context)
        self.assertEqual(response.data["operator"]["username"], "mohamed")

        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.data["operator"]["username"], "mohamed")

    def test_operator_context_is_required_and_bound_to_session(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/auth/operators/select/",
            {"operator_id": self.hassan.id},
            format="json",
        )
        token = response.data["operator_context"]

        self.assertEqual(
            self.client.get(
                "/api/auth/me/",
                HTTP_X_OPERATOR_CONTEXT=token,
            ).status_code,
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.get("/api/auth/me/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_non_operator_cannot_be_selected(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/auth/operators/select/",
            {"operator_id": self.non_operator.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_logout_ends_shared_pos_session(self):
        self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "test-pos-password"},
            format="json",
        )
        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
