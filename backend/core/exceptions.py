class BusinessError(Exception):
    """
    Base exception for expected business-rule violations.
    """

    code = "BUSINESS_ERROR"
    message = "A business rule prevented this operation."

    def __init__(self, message=None, *, code=None):
        self.code = code or self.code
        self.message = message or self.message
        super().__init__(self.message)


# ============================================================
# Inventory
# ============================================================

class InventoryError(BusinessError):
    code = "INVENTORY_ERROR"
    message = "An inventory rule prevented this operation."


class DeviceNotFound(InventoryError):
    code = "DEVICE_NOT_FOUND"
    message = "The requested device was not found."


class DeviceNotAvailable(InventoryError):
    code = "DEVICE_NOT_AVAILABLE"
    message = "The device is not available."


class InvalidDeviceTransition(InventoryError):
    code = "INVALID_DEVICE_TRANSITION"
    message = "This device status transition is not allowed."


class InsufficientAccessoryStock(InventoryError):
    code = "INSUFFICIENT_ACCESSORY_STOCK"
    message = "There is not enough accessory stock."


class InvalidStockAdjustment(InventoryError):
    code = "INVALID_STOCK_ADJUSTMENT"
    message = "The stock adjustment is not valid."


class InvalidIdentifier(InventoryError):
    code = "INVALID_IDENTIFIER"
    message = "The supplied inventory identifier is not valid."


# ============================================================
# Sales
# ============================================================

class SalesError(BusinessError):
    code = "SALES_ERROR"
    message = "A sales rule prevented this operation."


class InvalidSale(SalesError):
    code = "INVALID_SALE"
    message = "The sale cannot be completed."


class InvalidSaleItem(SalesError):
    code = "INVALID_SALE_ITEM"
    message = "The sale item is not valid."


class PriceBelowMinimum(SalesError):
    code = "PRICE_BELOW_MINIMUM"
    message = "The selling price is below the allowed minimum."


# ============================================================
# Payments
# ============================================================

class PaymentError(BusinessError):
    code = "PAYMENT_ERROR"
    message = "A payment rule prevented this operation."


class InvalidPayment(PaymentError):
    code = "INVALID_PAYMENT"
    message = "The payment is not valid."


class PaymentNotFound(PaymentError):
    code = "PAYMENT_NOT_FOUND"
    message = "The requested payment was not found."


class PaymentAlreadyProcessed(PaymentError):
    code = "PAYMENT_ALREADY_PROCESSED"
    message = "This payment has already been processed."


class InsufficientPayment(PaymentError):
    code = "INSUFFICIENT_PAYMENT"
    message = "The confirmed payment amount is insufficient."


# ============================================================
# Reservations
# ============================================================

class ReservationError(BusinessError):
    code = "RESERVATION_ERROR"
    message = "A reservation rule prevented this operation."


class ReservationNotFound(ReservationError):
    code = "RESERVATION_NOT_FOUND"
    message = "The requested reservation was not found."


class ReservationNotActive(ReservationError):
    code = "RESERVATION_NOT_ACTIVE"
    message = "The reservation is not active."


class ReservationAlreadyExists(ReservationError):
    code = "RESERVATION_ALREADY_EXISTS"
    message = "An active reservation already exists."


class ReservationExpired(ReservationError):
    code = "RESERVATION_EXPIRED"
    message = "The reservation has expired."


class ReservationBalanceRemaining(ReservationError):
    code = "RESERVATION_BALANCE_REMAINING"
    message = "The reservation still has an unpaid balance."


# ============================================================
# Returns
# ============================================================

class ReturnError(BusinessError):
    code = "RETURN_ERROR"
    message = "A return rule prevented this operation."


class ReturnNotFound(ReturnError):
    code = "RETURN_NOT_FOUND"
    message = "The requested return was not found."


class ReturnNotAllowed(ReturnError):
    code = "RETURN_NOT_ALLOWED"
    message = "This item cannot be returned."


class ReturnQuantityExceeded(ReturnError):
    code = "RETURN_QUANTITY_EXCEEDED"
    message = "The requested return quantity exceeds the refundable quantity."


# ============================================================
# Exchanges
# ============================================================

class ExchangeError(BusinessError):
    code = "EXCHANGE_ERROR"
    message = "An exchange rule prevented this operation."


class ExchangeNotFound(ExchangeError):
    code = "EXCHANGE_NOT_FOUND"
    message = "The requested exchange was not found."


class ExchangeNotAllowed(ExchangeError):
    code = "EXCHANGE_NOT_ALLOWED"
    message = "This exchange is not allowed."


# ============================================================
# Refunds
# ============================================================

class RefundError(BusinessError):
    code = "REFUND_ERROR"
    message = "A refund rule prevented this operation."


class RefundNotFound(RefundError):
    code = "REFUND_NOT_FOUND"
    message = "The requested refund was not found."


class RefundAmountExceeded(RefundError):
    code = "REFUND_AMOUNT_EXCEEDED"
    message = "The refund amount exceeds the refundable amount."


class RefundAlreadyCompleted(RefundError):
    code = "REFUND_ALREADY_COMPLETED"
    message = "This refund has already been completed."


# ============================================================
# Warranty
# ============================================================

class WarrantyError(BusinessError):
    code = "WARRANTY_ERROR"
    message = "A warranty rule prevented this operation."


class WarrantyClaimNotFound(WarrantyError):
    code = "WARRANTY_CLAIM_NOT_FOUND"
    message = "The requested warranty claim was not found."


class WarrantyExpired(WarrantyError):
    code = "WARRANTY_EXPIRED"
    message = "The warranty period has expired."


class WarrantyNotAllowed(WarrantyError):
    code = "WARRANTY_NOT_ALLOWED"
    message = "This warranty operation is not allowed."


# ============================================================
# Customers
# ============================================================

class CustomerError(BusinessError):
    code = "CUSTOMER_ERROR"
    message = "A customer rule prevented this operation."


class CustomerNotFound(CustomerError):
    code = "CUSTOMER_NOT_FOUND"
    message = "The requested customer was not found."


class InvalidCustomerPhone(CustomerError):
    code = "INVALID_CUSTOMER_PHONE"
    message = "The customer phone number is not valid."


# ============================================================
# Store settings
# ============================================================

class StoreSettingsError(BusinessError):
    code = "STORE_SETTINGS_ERROR"
    message = "A store settings rule prevented this operation."


class StoreSettingsNotFound(StoreSettingsError):
    code = "STORE_SETTINGS_NOT_FOUND"
    message = "Store settings have not been configured."