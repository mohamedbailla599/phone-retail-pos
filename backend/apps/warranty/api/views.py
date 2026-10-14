from decimal import Decimal
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.warranty.models import RepairTicket
from apps.warranty.api.serializers import (
    RepairTicketSerializer,
    CreateRepairTicketSerializer,
    UpdateRepairStatusSerializer,
    DeliverRepairSerializer,
    generate_repair_ticket_number,
)
from apps.users.services.operator_context import get_required_operator


def _resolve_operator(request):
    try:
        return get_required_operator(request)
    except Exception:
        if getattr(request, "user", None) and request.user.is_authenticated:
            return request.user
        raise


class RepairTicketListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = RepairTicket.objects.select_related("customer", "created_by", "assigned_technician").all()

        # Status filter
        status_filter = request.query_params.get("status")
        if status_filter and status_filter != "ALL":
            queryset = queryset.filter(status=status_filter)

        # Search query
        search_query = request.query_params.get("search", "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(ticket_number__icontains=search_query)
                | Q(customer_name__icontains=search_query)
                | Q(customer_phone__icontains=search_query)
                | Q(device_model__icontains=search_query)
                | Q(imei_or_serial__icontains=search_query)
            )

        serializer = RepairTicketSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        operator = _resolve_operator(request)
        serializer = CreateRepairTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ticket_number = generate_repair_ticket_number()
        customer_id = data.get("customer_id")

        ticket = RepairTicket.objects.create(
            ticket_number=ticket_number,
            customer_id=customer_id,
            customer_name=data["customer_name"],
            customer_phone=data["customer_phone"],
            device_brand=data["device_brand"],
            device_model=data["device_model"],
            device_color=data.get("device_color") or None,
            imei_or_serial=data.get("imei_or_serial") or None,
            passcode=data.get("passcode") or None,
            issue_type=data.get("issue_type", RepairTicket.IssueType.SCREEN),
            issue_description=data["issue_description"],
            status=RepairTicket.Status.RECEIVED,
            estimated_cost=data.get("estimated_cost", Decimal("0.00")),
            final_cost=data.get("estimated_cost", Decimal("0.00")),
            deposit_paid=data.get("deposit_paid", Decimal("0.00")),
            estimated_completion_date=data.get("estimated_completion_date"),
            created_by=operator,
        )

        return Response(RepairTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class RepairTicketDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        ticket = get_object_or_404(RepairTicket, pk=pk)
        return Response(RepairTicketSerializer(ticket).data)


class RepairTicketStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        operator = _resolve_operator(request)
        ticket = get_object_or_404(RepairTicket, pk=pk)
        serializer = UpdateRepairStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        new_status = data["status"]
        ticket.status = new_status

        if "technician_notes" in data and data["technician_notes"] is not None:
            ticket.technician_notes = data["technician_notes"]

        if "final_cost" in data and data["final_cost"] is not None:
            ticket.final_cost = data["final_cost"]

        if "assigned_technician_id" in data:
            ticket.assigned_technician_id = data["assigned_technician_id"]

        if new_status == RepairTicket.Status.READY and not ticket.completed_at:
            ticket.completed_at = timezone.now()

        ticket.save()
        return Response(RepairTicketSerializer(ticket).data)


class RepairTicketDeliverView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        operator = _resolve_operator(request)
        ticket = get_object_or_404(RepairTicket, pk=pk)
        serializer = DeliverRepairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ticket.status = RepairTicket.Status.DELIVERED
        ticket.is_paid = True
        ticket.payment_method = data["payment_method"]
        ticket.delivered_at = timezone.now()
        if not ticket.completed_at:
            ticket.completed_at = timezone.now()

        if data.get("notes"):
            ticket.technician_notes = (
                f"{ticket.technician_notes or ''}\nDelivery Note: {data['notes']}".strip()
            )

        ticket.save()
        return Response(RepairTicketSerializer(ticket).data)
