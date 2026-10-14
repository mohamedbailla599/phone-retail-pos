from decimal import Decimal
from django.db.models import Q, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer, CustomerDebtPayment
from apps.customers.services.debt_service import record_debt_payment
from apps.users.services.operator_context import get_required_operator
from .serializers import (
    CustomerSerializer,
    CustomerDetailSerializer,
    CustomerDebtPaymentSerializer,
)


class CustomerListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        queryset = (
            Customer.objects
            .annotate(transactions_count=Count('transactions', distinct=True))
            .order_by('-current_debt', 'full_name')
        )

        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(phone_number__icontains=search) |
                Q(full_name__icontains=search)
            )

        has_debt = self.request.query_params.get('has_debt', '').lower()
        if has_debt in ['true', '1', 'yes']:
            queryset = queryset.filter(current_debt__gt=Decimal('0.00'))
        elif has_debt in ['false', '0', 'no']:
            queryset = queryset.filter(current_debt=Decimal('0.00'))

        return queryset

    def create(self, request, *args, **kwargs):
        phone_number = request.data.get('phone_number', '').strip()
        full_name = request.data.get('full_name', '').strip()

        if not phone_number:
            return Response(
                {'error': 'Le numéro de téléphone est obligatoire.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not full_name:
            return Response(
                {'error': 'Le nom du client est obligatoire.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Customer.objects.filter(phone_number=phone_number).exists():
            return Response(
                {'error': f'Un client avec le numéro {phone_number} existe déjà.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CustomerDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomerDetailSerializer
    queryset = Customer.objects.all()


class CustomerDebtPaymentCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        customer = get_object_or_404(Customer, pk=pk)
        amount_raw = request.data.get('amount')
        payment_method = request.data.get('payment_method', CustomerDebtPayment.Method.CASH)
        notes = request.data.get('notes', '')

        if not amount_raw:
            return Response(
                {'error': 'Le montant est obligatoire.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = Decimal(str(amount_raw))
        except Exception:
            return Response(
                {'error': 'Montant invalide.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            operator = get_required_operator(request)
        except Exception:
            operator = getattr(request, 'user', None)

        try:
            payment, updated_customer = record_debt_payment(
                customer_id=customer.id,
                amount=amount,
                payment_method=payment_method,
                notes=notes,
                operator=operator,
            )

            return Response(
                {
                    'message': 'Règlement enregistré avec succès.',
                    'payment': CustomerDebtPaymentSerializer(payment).data,
                    'customer': CustomerSerializer(updated_customer).data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class CustomerStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_debt = Customer.objects.aggregate(total=Sum('current_debt'))['total'] or Decimal('0.00')
        customers_with_debt = Customer.objects.filter(current_debt__gt=Decimal('0.00')).count()
        total_customers = Customer.objects.count()

        repayments_month = (
            CustomerDebtPayment.objects
            .filter(created_at__gte=start_of_month)
            .aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        return Response({
            'total_debt': str(total_debt),
            'customers_with_debt_count': customers_with_debt,
            'total_customers_count': total_customers,
            'repayments_month': str(repayments_month),
        })
