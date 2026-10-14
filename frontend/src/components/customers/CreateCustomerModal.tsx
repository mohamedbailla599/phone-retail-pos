import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { customersApi, type Customer } from '../../api/customers';
import { User, Phone, MapPin, CreditCard, FileText, Loader2 } from 'lucide-react';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCustomer: Customer) => void;
}

export default function CreateCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateCustomerModalProps) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('0.00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    onClose();
    setFullName('');
    setPhoneNumber('');
    setAddress('');
    setCreditLimit('0.00');
    setNotes('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim()) {
      setError('Le nom complet et le numéro de téléphone sont requis.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const created = await customersApi.createCustomer({
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        address: address.trim() || undefined,
        credit_limit: creditLimit.trim() || '0.00',
        notes: notes.trim() || undefined,
      });
      handleClose();
      onSuccess(created);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.phone_number?.[0] || 'Erreur lors de la création du client.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title="Nouveau Client">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Nom complet *"
          placeholder="Ex: Mohamed Alami"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          icon={<User className="w-4 h-4" />}
          autoFocus
          required
        />

        <Input
          label="Numéro de téléphone *"
          placeholder="Ex: 0612345678"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          icon={<Phone className="w-4 h-4" />}
          required
        />

        <Input
          label="Adresse (Optionnelle)"
          placeholder="Ex: Avenue Hassan II, Agadir"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          icon={<MapPin className="w-4 h-4" />}
        />

        <Input
          label="Plafond de crédit autorisé (DH)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          icon={<CreditCard className="w-4 h-4" />}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-text-muted" />
            Remarques / Notes (Optionnel)
          </label>
          <textarea
            rows={3}
            placeholder="Informations supplémentaires ou historique de confiance..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-surface border border-border rounded-[var(--radius-md)] px-3 py-2 text-text text-sm placeholder:text-text-muted focus:outline-none focus:border-gold-border focus:ring-1 focus:ring-gold/20 transition-smooth resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !fullName.trim() || !phoneNumber.trim()}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Création...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
