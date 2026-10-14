import io
import barcode
from barcode.writer import ImageWriter

from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from rest_framework import permissions
from rest_framework.views import APIView

from apps.sales.models import Transaction

class BarcodeGenerationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code, *args, **kwargs):
        try:
            barcode_class = barcode.get_barcode_class('code128')
            writer = ImageWriter()
            rv = io.BytesIO()
            barcode_class(code, writer=writer).write(rv)
            return HttpResponse(rv.getvalue(), content_type="image/png")
        except Exception as e:
            return HttpResponse(f"Error generating barcode: {str(e)}", status=400)


class ReceiptGenerationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, transaction_id, *args, **kwargs):
        transaction = get_object_or_404(Transaction, pk=transaction_id)
        
        context = {
            "transaction": transaction,
            "items": transaction.items.all(),
            "payments": transaction.payments.all(),
        }
        
        try:
            html = render_to_string("printing/receipt.html", context)
            return HttpResponse(html, content_type="text/html")
        except Exception as e:
            return HttpResponse(f"Error generating receipt: {str(e)}", status=500)
