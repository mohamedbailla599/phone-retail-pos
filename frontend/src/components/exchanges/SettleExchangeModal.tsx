import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import { useRequireOperator } from '../../hooks/useRequireOperator';
import { exchangeApi } from '../../api/exchanges';
import type { Exchange } from '../../api/exchanges';
import { useAuthStore } from '../../store/authStore';
import ExchangeReceiptPrint, { printExchangeReceipt } from './ExchangeReceiptPrint';
import {
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Smartphone,
  Printer,
  Loader2,
  ShieldCheck,
  CreditCard,
  Banknote,
  Eye,
  EyeOff
} from 'lucide-react';

interface SettleExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchange: Exchange | null;
  onSuccess: () => void;
}

export function SettleExchangeModal({
  isOpen,
  onClose,
  exchange,
  onSuccess,
}: SettleExchangeModalProps) {
  const { operator } = useAuthStore();
  const {
    isOperatorModalOpen,
    handleOperatorRequired,
    onOperatorSelected,
    onOperatorModalClose,
  } = useRequireOperator();

  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSubmittingFinancial, setIsSubmittingFinancial] = useState(false);
  const [isCompletingExchange, setIsCompletingExchange] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Financial Settlement state
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [refundReference, setRefundReference] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Settlement status from backend
  const [isCustomerPaid, setIsCustomerPaid] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState('0.00');
  const [isRefundCompleted, setIsRefundCompleted] = useState(false);

  // Completion & Print State
  const [isCompleted, setIsCompleted] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  const handlePrint = () => {
    if (!exchange) return;
    printExchangeReceipt(exchange, operator);
  };

  const checkPaymentStatus = useCallback(async () => {
    if (!exchange || exchange.financial_direction !== 'CUSTOMER_PAYS') return;
    try {
      setIsLoadingStatus(true);
      const res = await exchangeApi.getPaymentStatus(exchange.id);
      setIsCustomerPaid(res.fully_paid);
      setConfirmedAmount(res.confirmed_amount || '0.00');
    } catch (err) {
      console.error('Failed to check payment status', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [exchange]);

  useEffect(() => {
    if (isOpen && exchange) {
      setError(null);
      setIsCompleted(exchange.status === 'COMPLETED');
      setShowReceiptPreview(false);
      setPaymentReference('');
      setRefundReference('');
      setRefundReason('');

      if (exchange.financial_direction === 'CUSTOMER_PAYS') {
        checkPaymentStatus();
      } else if (exchange.financial_direction === 'STORE_REFUNDS') {
        setIsRefundCompleted(exchange.status === 'COMPLETED');
      } else {
        // EVEN
        setIsCustomerPaid(true);
        setIsRefundCompleted(true);
      }
    }
  }, [isOpen, exchange, checkPaymentStatus]);

  if (!exchange) return null;

  // Handle Customer Payment Submit
  const handlePaymentSubmit = async () => {
    setError(null);
    setIsSubmittingFinancial(true);

    try {
      await exchangeApi.createPayment(exchange.id, {
        amount: exchange.difference_amount,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
      });

      await checkPaymentStatus();
    } catch (err: any) {
      if (!handleOperatorRequired(err, handlePaymentSubmit)) {
        setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'Payment submission failed.');
      }
    } finally {
      setIsSubmittingFinancial(false);
    }
  };

  // Handle Store Refund Submit
  const handleRefundSubmit = async () => {
    setError(null);
    setIsSubmittingFinancial(true);

    try {
      const refundRes = await exchangeApi.createRefund(exchange.id, {
        method: refundMethod,
        reference: refundReference.trim() || undefined,
        reason: refundReason.trim() || `Exchange refund for ${exchange.exchange_number}`,
      });

      const refundId = refundRes.refund?.id;
      if (refundId) {
        await exchangeApi.completeRefund(refundId);
      }

      setIsRefundCompleted(true);
    } catch (err: any) {
      if (!handleOperatorRequired(err, handleRefundSubmit)) {
        setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'Refund submission failed.');
      }
    } finally {
      setIsSubmittingFinancial(false);
    }
  };

  // Handle Final Complete Exchange
  const handleCompleteExchange = async () => {
    setError(null);
    setIsCompletingExchange(true);

    try {
      await exchangeApi.completeExchange(exchange.id);
      setIsCompleted(true);
      onSuccess();
    } catch (err: any) {
      if (!handleOperatorRequired(err, handleCompleteExchange)) {
        setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to complete exchange.');
      }
    } finally {
      setIsCompletingExchange(false);
    }
  };

  const isSettlementReady =
    exchange.financial_direction === 'EVEN' ||
    (exchange.financial_direction === 'CUSTOMER_PAYS' && isCustomerPaid) ||
    (exchange.financial_direction === 'STORE_REFUNDS' && isRefundCompleted);

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title="Settle & Complete Exchange"
        className="max-w-2xl"
      >
        <div className="space-y-6">
          {/* Header Summary Pill */}
          <div className="flex items-center justify-between p-3.5 bg-surface-alt rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-text-muted font-mono">{exchange.exchange_number}</div>
                <div className="text-sm font-semibold text-text">{exchange.customer_name} • {exchange.customer_phone}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-text-muted">Exchange Status</div>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {exchange.status}
              </span>
            </div>
          </div>

          {/* Success Banner if Completed */}
          {isCompleted ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-400">Exchange Successfully Completed!</h3>
                <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                  The trade-in phone has been received into inventory (IN_STOCK), and the replacement device is marked as SOLD.
                </p>
              </div>

              <div className="p-4 bg-surface rounded-xl border border-border text-left grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-text-muted">Intake Trade-In Phone:</div>
                  <div className="font-semibold text-text mt-0.5">{exchange.trade_in_product_name}</div>
                  <div className="text-[11px] font-mono text-gold mt-0.5">IMEI: {exchange.trade_in_imei}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5">Status: IN_STOCK (Cost: MAD {exchange.trade_in_value})</div>
                </div>
                <div>
                  <div className="text-text-muted">Replacement Phone Delivered:</div>
                  <div className="font-semibold text-text mt-0.5">Device #{exchange.new_device}</div>
                  <div className="text-[11px] font-mono text-gold mt-0.5">IMEI: {exchange.new_device_imei_1 || 'N/A'}</div>
                  <div className="text-[11px] text-text-secondary mt-0.5">Status: SOLD (Price: MAD {exchange.new_device_price})</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowReceiptPreview(!showReceiptPreview)}
                  className="flex items-center gap-2"
                >
                  {showReceiptPreview ? <EyeOff className="w-4 h-4 text-gold" /> : <Eye className="w-4 h-4 text-gold" />}
                  {showReceiptPreview ? 'Hide Preview' : 'Preview Thermal Ticket'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handlePrint}
                  className="flex items-center gap-2 font-bold"
                >
                  <Printer className="w-4 h-4" />
                  Print Thermal Receipt
                </Button>
                <Button
                  variant="secondary"
                  onClick={onClose}
                >
                  Close & Done
                </Button>
              </div>

              {/* On-Screen Thermal Receipt Preview */}
              {showReceiptPreview && (
                <div className="mt-4 p-5 bg-white text-black rounded-xl max-w-[300px] mx-auto text-left font-mono text-[11px] leading-tight border border-gray-300 shadow-2xl">
                  <div className="text-center font-bold text-xs uppercase mb-0.5">BIGHRISSEN PHONE</div>
                  <div className="text-center text-[10px] text-gray-700 mb-2 pb-2 border-b border-black border-dashed">
                    DEVICE EXCHANGE & TRADE-IN
                  </div>
                  <div className="space-y-0.5 mb-2 pb-2 border-b border-black border-dashed text-[10px]">
                    <div>RC#: {exchange.exchange_number}</div>
                    <div>DATE: {new Date().toLocaleDateString('en-GB')}</div>
                    <div>OPERATOR: {operator?.display_name || operator?.username || 'Staff'}</div>
                    <div className="pt-0.5">CUSTOMER: {exchange.customer_name}</div>
                    <div>TEL: {exchange.customer_phone}</div>
                  </div>
                  <div className="mb-2 pb-2 border-b border-black border-dashed space-y-0.5 text-[10px]">
                    <div className="font-bold">1. TRADE-IN RECEIVED:</div>
                    <div className="font-semibold">{exchange.trade_in_product_name}</div>
                    <div>IMEI: {exchange.trade_in_imei}</div>
                    <div>Grade {exchange.trade_in_condition} • {exchange.trade_in_battery_health ? `${exchange.trade_in_battery_health}%` : 'N/A'}</div>
                    <div className="font-bold pt-0.5">Credit: MAD {parseFloat(exchange.trade_in_value).toFixed(2)}</div>
                  </div>
                  <div className="mb-2 pb-2 border-b border-black border-dashed space-y-0.5 text-[10px]">
                    <div className="font-bold">2. REPLACEMENT DELIVERED:</div>
                    <div className="font-semibold">{exchange.new_device_product_name || `Store Device #${exchange.new_device}`}</div>
                    {exchange.new_device_imei_1 && <div>IMEI: {exchange.new_device_imei_1}</div>}
                    <div className="font-bold pt-0.5">Price: MAD {parseFloat(exchange.new_device_price).toFixed(2)}</div>
                  </div>
                  <div className="mb-2 pb-2 border-b border-black border-dashed font-bold text-[11px]">
                    <div className="flex justify-between">
                      <span>{exchange.financial_direction === 'CUSTOMER_PAYS' ? 'CUSTOMER PAID:' : 'BALANCE:'}</span>
                      <span>MAD {parseFloat(exchange.difference_amount).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-center text-gray-700 leading-normal pt-1">
                    3-month store warranty applies.
                    <br />
                    Keep receipt for warranty claims.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Device Comparison Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Trade-In Phone (Intake) */}
                <div className="p-4 rounded-xl bg-surface-alt/60 border border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-gold" />
                      Trade-In (Customer)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold-border font-medium">
                      Intake to Stock
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-text">{exchange.trade_in_product_name}</div>
                  <div className="text-xs font-mono text-text-muted">IMEI: {exchange.trade_in_imei}</div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="text-text-muted">Agreed Trade-In Value:</span>
                    <span className="font-bold text-gold">MAD {exchange.trade_in_value}</span>
                  </div>
                </div>

                {/* Replacement Phone (Store) */}
                <div className="p-4 rounded-xl bg-surface-alt/60 border border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      Replacement Device
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      To Mark Sold
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-text">Store Device #{exchange.new_device}</div>
                  <div className="text-xs font-mono text-text-muted">IMEI: {exchange.new_device_imei_1 || 'N/A'}</div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="text-text-muted">Exchange Selling Price:</span>
                    <span className="font-bold text-emerald-400">MAD {exchange.new_device_price}</span>
                  </div>
                </div>
              </div>

              {/* Financial Settlement Section */}
              <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-gold" />
                    <span className="text-sm font-bold text-text">Valuation & Settlement Balance</span>
                  </div>

                  {exchange.financial_direction === 'CUSTOMER_PAYS' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      Customer Pays MAD {exchange.difference_amount}
                    </span>
                  )}
                  {exchange.financial_direction === 'STORE_REFUNDS' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger-bg text-danger border border-danger/30">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Store Refunds MAD {exchange.difference_amount}
                    </span>
                  )}
                  {exchange.financial_direction === 'EVEN' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      <Scale className="w-3.5 h-3.5" />
                      Even Exchange (MAD 0.00)
                    </span>
                  )}
                </div>

                {/* Sub-section: CUSTOMER_PAYS settlement */}
                {exchange.financial_direction === 'CUSTOMER_PAYS' && (
                  <div className="space-y-4 pt-2">
                    {isLoadingStatus ? (
                      <div className="py-4 flex items-center justify-center text-xs text-text-muted gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gold" />
                        Verifying payment status...
                      </div>
                    ) : isCustomerPaid ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <div>
                            <div className="text-xs font-bold text-emerald-400">Payment Fully Confirmed</div>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              Amount paid: MAD {confirmedAmount} / MAD {exchange.difference_amount}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded">
                          Settled
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-surface-alt border border-border space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text font-medium">Select Payment Method:</span>
                          <span className="text-xs font-bold text-gold">Due: MAD {exchange.difference_amount}</span>
                        </div>

                        {/* Payment Method Switcher */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('CASH')}
                            className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                              paymentMethod === 'CASH'
                                ? 'bg-gold/15 border-gold text-gold shadow-[0_0_15px_rgba(212,175,90,0.1)]'
                                : 'bg-surface border-border text-text-muted hover:border-text-secondary'
                            }`}
                          >
                            <Banknote className="w-4 h-4" />
                            Cash (Instant)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('BANK_TRANSFER')}
                            className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                              paymentMethod === 'BANK_TRANSFER'
                                ? 'bg-gold/15 border-gold text-gold shadow-[0_0_15px_rgba(212,175,90,0.1)]'
                                : 'bg-surface border-border text-text-muted hover:border-text-secondary'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            Bank Transfer
                          </button>
                        </div>

                        {paymentMethod === 'BANK_TRANSFER' && (
                          <div>
                            <label className="block text-[11px] font-medium text-text-muted mb-1">
                              Transfer Reference / Transaction ID
                            </label>
                            <input
                              type="text"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              placeholder="e.g. TR-9823472"
                              className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-text text-xs focus:outline-none focus:border-gold"
                            />
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="primary"
                          className="w-full justify-center"
                          disabled={isSubmittingFinancial}
                          onClick={handlePaymentSubmit}
                        >
                          {isSubmittingFinancial ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            `Record Payment of MAD ${exchange.difference_amount}`
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-section: STORE_REFUNDS settlement */}
                {exchange.financial_direction === 'STORE_REFUNDS' && (
                  <div className="space-y-4 pt-2">
                    {isRefundCompleted ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <div>
                            <div className="text-xs font-bold text-emerald-400">Store Refund Fully Issued</div>
                            <div className="text-[11px] text-text-muted mt-0.5">
                              Refund of MAD {exchange.difference_amount} processed and completed.
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded">
                          Settled
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-surface-alt border border-border space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text font-medium">Issue Store Refund:</span>
                          <span className="text-xs font-bold text-danger">Payout: MAD {exchange.difference_amount}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setRefundMethod('CASH')}
                            className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                              refundMethod === 'CASH'
                                ? 'bg-gold/15 border-gold text-gold shadow-[0_0_15px_rgba(212,175,90,0.1)]'
                                : 'bg-surface border-border text-text-muted hover:border-text-secondary'
                            }`}
                          >
                            <Banknote className="w-4 h-4" />
                            Cash Payout
                          </button>
                          <button
                            type="button"
                            onClick={() => setRefundMethod('BANK_TRANSFER')}
                            className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                              refundMethod === 'BANK_TRANSFER'
                                ? 'bg-gold/15 border-gold text-gold shadow-[0_0_15px_rgba(212,175,90,0.1)]'
                                : 'bg-surface border-border text-text-muted hover:border-text-secondary'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            Bank Transfer
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-text-muted mb-1">
                            Reference / Reason (Optional)
                          </label>
                          <input
                            type="text"
                            value={refundReference}
                            onChange={(e) => setRefundReference(e.target.value)}
                            placeholder="e.g. Cash drawer payout receipt #12"
                            className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-text text-xs focus:outline-none focus:border-gold"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="danger"
                          className="w-full justify-center"
                          disabled={isSubmittingFinancial}
                          onClick={handleRefundSubmit}
                        >
                          {isSubmittingFinancial ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            `Issue Store Refund of MAD ${exchange.difference_amount}`
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-section: EVEN exchange */}
                {exchange.financial_direction === 'EVEN' && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-xs font-bold text-blue-400">Even Trade-In</div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Both devices have identical valuation. Ready for inventory transfer and handover.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3 bg-danger-bg border border-danger/30 rounded-xl flex items-center gap-2 text-xs text-danger">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Final Complete Action Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isCompletingExchange}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2"
                  disabled={!isSettlementReady || isCompletingExchange}
                  onClick={handleCompleteExchange}
                >
                  {isCompletingExchange ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Completing Exchange & Inventory Transfer...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Exchange & Hand Over Device
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Operator Authentication Modal if Required */}
      <OperatorSelectionModal
        isOpen={isOperatorModalOpen}
        onClose={onOperatorModalClose}
        onSelect={onOperatorSelected}
      />

      {/* Direct Fallback Thermal Receipt Element */}
      <ExchangeReceiptPrint exchange={exchange} operator={operator} />
    </>
  );
}
