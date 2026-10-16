"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "api/exchanges/",
        include("apps.exchanges.api.urls"),
    ),
    path(
        "api/customers/",
        include("apps.customers.api.urls"),
    ),
    path(
        "api/returns/",
        include("apps.returns.api.urls"),
    ),
    path(
        "api/refunds/",
        include("apps.refunds.api.urls"),
    ),
    path("api/auth/", include("apps.users.urls")),
    path("api/printing/", include("apps.printing.api.urls")),
    path("api/sales/", include("apps.sales.api.urls")),
    path("api/catalog/", include("apps.catalog.api.urls")),
    path("api/inventory/", include("apps.inventory.api.urls")),
    path("api/warranty/", include("apps.warranty.api.urls")),
    path("api/audit-logs/", include("apps.audit.api.urls")),
    path("api/settings/", include("apps.store_settings.api.urls")),
    path("api/reservations/", include("apps.reservations.api.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
]
