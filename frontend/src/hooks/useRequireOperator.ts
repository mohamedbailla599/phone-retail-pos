import { useState, useCallback } from 'react';

export function useRequireOperator() {
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleOperatorRequired = useCallback((error: any, retryAction?: () => void) => {
    const errorMsg = error?.response?.data?.error || error?.response?.data?.detail;
    if (errorMsg && typeof errorMsg === 'string') {
      const lower = errorMsg.toLowerCase();
      if (
        lower.includes('operator selection is required') ||
        lower.includes('operator must be selected') ||
        lower.includes('pos operator')
      ) {
        setPendingAction(retryAction ? () => retryAction : null);
        setIsOperatorModalOpen(true);
        return true;
      }
    }
    return false;
  }, []);

  const onOperatorSelected = useCallback(() => {
    setIsOperatorModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const onOperatorModalClose = useCallback(() => {
    setIsOperatorModalOpen(false);
    setPendingAction(null);
  }, []);

  return {
    isOperatorModalOpen,
    onOperatorSelected,
    onOperatorModalClose,
    handleOperatorRequired,
  };
}
