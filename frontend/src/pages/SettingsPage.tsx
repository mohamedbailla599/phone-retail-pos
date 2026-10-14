import { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { settingsApi, type StoreSettings, type Operator } from '../api/settings';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import {
  Settings as SettingsIcon,
  Store,
  Users,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  UserCheck,
  UserX,
  Phone,
  MapPin,
  Receipt,
  Lock,
  Loader2,
  Eye,
  Crown,
  KeyRound,
} from 'lucide-react';

export default function SettingsPage() {
  const { operator: currentOperator } = useAuthStore();
  const { fetchSettings, updateSettings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'store' | 'operators' | 'warranties'>('store');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State for Store Settings
  const [formData, setFormData] = useState<Partial<StoreSettings>>({
    store_name: '',
    phone_number: '',
    address: '',
    currency: 'MAD',
    receipt_prefix: 'BP',
    receipt_footer_message: '',
    default_device_warranty_months: 3,
    default_accessory_warranty_months: 1,
    default_reservation_months: 1,
  });

  // Operators State
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingOperator, setIsCreatingOperator] = useState(false);
  const [operatorForm, setOperatorForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    role: 'CASHIER',
    password: '',
  });
  const [operatorModalError, setOperatorModalError] = useState<string | null>(null);
  const [updatingOperatorId, setUpdatingOperatorId] = useState<number | null>(null);

  // Password / PIN Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedOperatorForPassword, setSelectedOperatorForPassword] = useState<Operator | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);

  // Load Initial Data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [fetchedSettings, fetchedOperators] = await Promise.all([
        fetchSettings(),
        settingsApi.getOperators(),
      ]);

      if (fetchedSettings) {
        setFormData({
          store_name: fetchedSettings.store_name || '',
          phone_number: fetchedSettings.phone_number || '',
          address: fetchedSettings.address || '',
          currency: fetchedSettings.currency || 'MAD',
          receipt_prefix: fetchedSettings.receipt_prefix || 'BP',
          receipt_footer_message: fetchedSettings.receipt_footer_message || '',
          default_device_warranty_months: fetchedSettings.default_device_warranty_months ?? 3,
          default_accessory_warranty_months: fetchedSettings.default_accessory_warranty_months ?? 1,
          default_reservation_months: fetchedSettings.default_reservation_months ?? 1,
        });
      }

      setOperators(fetchedOperators || []);
    } catch (err: any) {
      console.error('Error loading settings', err);
      setErrorMessage(err.response?.data?.detail || err.message || 'Erreur lors du chargement des paramètres.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updated = await updateSettings(formData);
      setFormData({
        store_name: updated.store_name,
        phone_number: updated.phone_number,
        address: updated.address,
        currency: updated.currency,
        receipt_prefix: updated.receipt_prefix,
        receipt_footer_message: updated.receipt_footer_message,
        default_device_warranty_months: updated.default_device_warranty_months,
        default_accessory_warranty_months: updated.default_accessory_warranty_months,
        default_reservation_months: updated.default_reservation_months,
      });
      setSuccessMessage('Paramètres enregistrés et appliqués avec succès !');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Erreur lors de la mise à jour des paramètres.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOperatorStatus = async (op: Operator) => {
    setUpdatingOperatorId(op.id);
    setErrorMessage(null);
    try {
      const updated = await settingsApi.updateOperator(op.id, {
        is_active: !op.is_active,
      });
      setOperators((prev) =>
        prev.map((item) => (item.id === op.id ? { ...item, is_active: updated.is_active } : item))
      );
      setSuccessMessage(
        `Opérateur ${op.display_name} ${updated.is_active ? 'activé' : 'désactivé'} avec succès.`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Action impossible sur cet opérateur.');
    } finally {
      setUpdatingOperatorId(null);
    }
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorForm.username.trim() || !operatorForm.first_name.trim()) {
      setOperatorModalError("L'identifiant et le prénom sont obligatoires.");
      return;
    }

    setIsCreatingOperator(true);
    setOperatorModalError(null);

    try {
      const newOp = await settingsApi.createOperator({
        username: operatorForm.username.trim().toLowerCase(),
        first_name: operatorForm.first_name.trim(),
        last_name: operatorForm.last_name.trim(),
        role: operatorForm.role,
        password: operatorForm.password.trim() || undefined,
      });

      setOperators((prev) => [newOp, ...prev]);
      setIsCreateModalOpen(false);
      setOperatorForm({ username: '', first_name: '', last_name: '', role: 'CASHIER', password: '' });
      setSuccessMessage(`Utilisateur ${newOp.display_name} créé avec succès !`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setOperatorModalError(
        err.response?.data?.username?.[0] ||
        err.response?.data?.detail ||
        'Erreur lors de la création du caissier.'
      );
    } finally {
      setIsCreatingOperator(false);
    }
  };

  const handleOpenPasswordModal = (op: Operator) => {
    setSelectedOperatorForPassword(op);
    setPasswordInput('');
    setPasswordModalError(null);
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOperatorForPassword) return;
    if (!passwordInput.trim()) {
      setPasswordModalError('Veuillez saisir un mot de passe ou code PIN.');
      return;
    }

    setIsSavingPassword(true);
    setPasswordModalError(null);
    try {
      await settingsApi.updateOperator(selectedOperatorForPassword.id, {
        password: passwordInput.trim(),
      });
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setSuccessMessage(`Mot de passe/PIN de ${selectedOperatorForPassword.display_name} mis à jour avec succès !`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setPasswordModalError(err.response?.data?.detail || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const filteredOperators = operators.filter((op) => {
    const q = operatorSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      op.username.toLowerCase().includes(q) ||
      op.first_name.toLowerCase().includes(q) ||
      op.last_name.toLowerCase().includes(q) ||
      op.display_name.toLowerCase().includes(q)
    );
  });

  const activeOperatorsCount = operators.filter((op) => op.is_active).length;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-bg text-text overflow-hidden font-sans">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden">
        {/* Header */}
        <header className="px-8 py-5 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold shadow-lg shadow-gold/5">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight text-white">Paramètres du Magasin</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gold/10 text-gold border border-gold-border/50">
                  {formData.store_name || 'Bighrissen Phone'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Personnalisation de la boutique, en-tête & pied de ticket de caisse et gestion de l'équipe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'operators' && (
              <Button
                variant="primary"
                onClick={handleSaveSettings}
                loading={isSaving}
                icon={<Save className="w-4 h-4" />}
              >
                Enregistrer les modifications
              </Button>
            )}
            {activeTab === 'operators' && (
              <Button
                variant="primary"
                onClick={() => {
                  setOperatorModalError(null);
                  setIsCreateModalOpen(true);
                }}
                icon={<Plus className="w-4 h-4" />}
              >
                Nouvel Opérateur
              </Button>
            )}
          </div>
        </header>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Notifications */}
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3 animate-[fadeIn_150ms_ease-out]">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3 animate-[fadeIn_150ms_ease-out]">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Boutique Active</p>
                <p className="text-base font-bold text-white mt-0.5 truncate max-w-[200px]">
                  {formData.store_name || 'Bighrissen Phone'}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Préfixe reçus : <span className="font-mono text-gold">{formData.receipt_prefix || 'BP'}</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-gold-border/60 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold/15 border border-gold-border flex items-center justify-center text-gold">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Propriétaires & Direction</p>
                <p className="text-base font-bold text-white mt-0.5">Hassan & Mohamed</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Co-propriétaires & Administrateurs ({activeOperatorsCount} opérateurs actifs)
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Garanties par Défaut</p>
                <p className="text-base font-bold text-white mt-0.5">
                  {formData.default_device_warranty_months} mois (Téléphones)
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Accessoires : {formData.default_accessory_warranty_months} mois | Réservations : {formData.default_reservation_months} mois
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <button
              onClick={() => setActiveTab('store')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'store'
                  ? 'bg-gold/15 text-gold border border-gold-border shadow-sm'
                  : 'text-text-secondary hover:text-white hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Boutique & Reçus</span>
            </button>

            <button
              onClick={() => setActiveTab('operators')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'operators'
                  ? 'bg-gold/15 text-gold border border-gold-border shadow-sm'
                  : 'text-text-secondary hover:text-white hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Équipe & Caissiers ({operators.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('warranties')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'warranties'
                  ? 'bg-gold/15 text-gold border border-gold-border shadow-sm'
                  : 'text-text-secondary hover:text-white hover:bg-surface-hover border border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Garanties & Délais</span>
            </button>
          </div>

          {/* Tab 1: Boutique & Reçus */}
          {activeTab === 'store' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Col (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-border">
                    <Store className="w-4 h-4 text-gold" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Informations Générales de l'Établissement
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Nom de l'Enseigne"
                        value={formData.store_name || ''}
                        onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                        placeholder="Ex: Bighrissen Phone"
                      />
                    </div>
                    <div>
                      <Input
                        label="Numéro de Téléphone"
                        icon={<Phone className="w-4 h-4" />}
                        value={formData.phone_number || ''}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        placeholder="+212 600-000000"
                      />
                    </div>
                  </div>

                  <div>
                    <Input
                      label="Adresse Physique"
                      icon={<MapPin className="w-4 h-4" />}
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Ex: Boulevard Hassan II, Agadir"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <Input
                        label="Devise Monétaire"
                        value={formData.currency || 'MAD'}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                        placeholder="MAD"
                      />
                    </div>
                    <div>
                      <Input
                        label="Préfixe des Reçus de Vente"
                        icon={<Receipt className="w-4 h-4" />}
                        value={formData.receipt_prefix || 'BP'}
                        onChange={(e) => setFormData({ ...formData, receipt_prefix: e.target.value.toUpperCase() })}
                        placeholder="BP"
                      />
                    </div>
                  </div>
                </div>

                {/* Receipt Customization */}
                <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-border">
                    <Receipt className="w-4 h-4 text-gold" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Message du Pied de Reçu Thermique (Ticket 80mm)
                    </h2>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">
                      Texte de Clôture & Conditions Générales du Ticket
                    </label>
                    <textarea
                      rows={3}
                      value={formData.receipt_footer_message || ''}
                      onChange={(e) => setFormData({ ...formData, receipt_footer_message: e.target.value })}
                      placeholder="Ex: Merci de votre visite ! Les articles vendus sont sous garantie selon nos conditions générales."
                      className="w-full p-3 bg-surface-elevated border border-border rounded-xl text-text text-sm placeholder:text-text-muted focus:outline-none focus:border-gold-border focus:ring-1 focus:ring-gold/20 transition-all resize-none"
                    />
                    <p className="text-[11px] text-text-muted mt-1">
                      Ce message s'imprime automatiquement en bas de chaque reçu thermique client (80mm).
                    </p>
                  </div>
                </div>
              </div>

              {/* Receipt Preview Simulator Col (1 col) */}
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-surface border border-border">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <Eye className="w-4 h-4 text-gold" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Aperçu Direct du Ticket Thermique
                    </h3>
                  </div>

                  {/* Simulator Box */}
                  <div className="bg-white text-black p-4 rounded-xl font-mono text-[11px] shadow-inner space-y-3 leading-tight select-none border border-neutral-300">
                    <div className="text-center pb-2 border-b border-black border-dashed">
                      <p className="text-sm font-bold uppercase tracking-wider">
                        {formData.store_name || 'BIGHRISSEN PHONE'}
                      </p>
                      <p className="text-[10px] mt-0.5">{formData.address || 'Boulevard Hassan II, Agadir'}</p>
                      <p className="text-[10px]">Tél : {formData.phone_number || '+212 600-000000'}</p>
                    </div>

                    <div className="space-y-0.5 text-[10px] border-b border-black border-dashed pb-2">
                      <p>Ticket : {formData.receipt_prefix || 'BP'}-20261014-001</p>
                      <p>Date : 14/10/2026 14:30</p>
                      <p>Opérateur : {currentOperator?.display_name || 'Hassan'}</p>
                      <p>Client : Client de Passage</p>
                    </div>

                    <div className="border-b border-black border-dashed pb-2">
                      <div className="flex justify-between font-bold text-[10px] mb-1">
                        <span>Article</span>
                        <span>Total</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>iPhone 15 Pro (128GB)</span>
                        <span>8,900.00 DH</span>
                      </div>
                      <div className="text-[9px] text-gray-500">IMEI: 352981098765432</div>
                    </div>

                    <div className="border-b border-black border-dashed pb-2 space-y-0.5 text-[10px]">
                      <div className="flex justify-between font-bold text-xs pt-1">
                        <span>TOTAL :</span>
                        <span>8,900.00 {formData.currency || 'MAD'}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>Mode : Espèces</span>
                        <span>8,900.00 {formData.currency || 'MAD'}</span>
                      </div>
                    </div>

                    <div className="text-center text-[9px] text-gray-800 pt-1 space-y-1">
                      <p className="font-semibold whitespace-pre-line">
                        {formData.receipt_footer_message ||
                          'Merci pour votre visite ! Les articles vendus sont garantis selon conditions.'}
                      </p>
                      <p className="text-[8px] text-gray-600">Aucun remboursement ou échange sans ce ticket.</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-muted mt-3 text-center">
                    Le rendu correspond fidèlement aux rouleaux thermiques 80mm de votre caisse.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Équipe & Caissiers */}
          {activeTab === 'operators' && (
            <div className="space-y-5">
              {/* Filter & Action bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-72">
                  <Input
                    placeholder="Rechercher un opérateur..."
                    value={operatorSearch}
                    onChange={(e) => setOperatorSearch(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">
                    {filteredOperators.length} opérateur(s) trouvé(s)
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setOperatorModalError(null);
                      setIsCreateModalOpen(true);
                    }}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Ajouter un Caissier
                  </Button>
                </div>
              </div>

              {/* Operators Table */}
              <div className="rounded-2xl bg-surface border border-border overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated/80 border-b border-border text-text-muted uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-6">Opérateur / Caissier</th>
                      <th className="py-3.5 px-6">Identifiant (Username)</th>
                      <th className="py-3.5 px-6">Rôle & Compte</th>
                      <th className="py-3.5 px-6">Statut Caisse</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredOperators.map((op) => {
                      const isOwner = op.username === 'hassan' || op.username === 'mohamed' || op.role === 'OWNER';
                      const isPOSAdmin = op.username === 'admin';
                      return (
                        <tr key={op.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                  isOwner
                                    ? 'bg-gold/20 border border-gold text-gold shadow-sm'
                                    : isPOSAdmin
                                    ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                                    : 'bg-surface-elevated border border-border text-text-secondary'
                                }`}
                              >
                                {isOwner ? (
                                  <Crown className="w-4 h-4 text-gold" />
                                ) : (
                                  op.first_name ? op.first_name[0] : op.username[0]
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-white text-sm">{op.display_name}</p>
                                  {isOwner && (
                                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gold/15 text-gold border border-gold-border/60">
                                      Propriétaire & Admin
                                    </span>
                                  )}
                                </div>
                                <p className={`text-[11px] ${isOwner ? 'text-gold/90 font-medium' : 'text-text-muted'}`}>
                                  {isOwner
                                    ? 'Co-propriétaire & Administrateur du Magasin'
                                    : isPOSAdmin
                                    ? 'Poste Terminal Caisse Principal'
                                    : 'Caissier / Opérateur Vente'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-mono text-text-secondary bg-surface-elevated px-2 py-1 rounded-md border border-border">
                              {op.username}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              {isOwner ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold/15 text-gold border border-gold-border flex items-center gap-1.5 shadow-sm">
                                  <Crown className="w-3.5 h-3.5 text-gold" /> PROPRIÉTAIRE & ADMIN
                                </span>
                              ) : isPOSAdmin ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                                  <Store className="w-3 h-3 text-blue-400" /> Caisse Centrale (POS)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-neutral-500/15 text-neutral-300 border border-neutral-500/30">
                                  Caissier
                                </span>
                              )}
                              {op.is_pos_account && !isPOSAdmin && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                  Terminal POS
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {op.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                                Désactivé
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isOwner || isPOSAdmin ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gold/90 bg-gold/5 border border-gold-border/40"
                                  title="Compte Administrateur / Propriétaire protégé contre la désactivation"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-gold" /> Protégé
                                </span>
                              ) : (
                                <Button
                                  variant={op.is_active ? 'danger' : 'secondary'}
                                  size="sm"
                                  loading={updatingOperatorId === op.id}
                                  onClick={() => handleToggleOperatorStatus(op)}
                                  icon={op.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                >
                                  {op.is_active ? 'Désactiver' : 'Activer'}
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenPasswordModal(op)}
                                icon={<KeyRound className="w-3.5 h-3.5" />}
                                title="Modifier le code PIN ou mot de passe"
                              >
                                PIN / Mdp
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredOperators.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-text-muted">
                          Aucun opérateur ne correspond à votre recherche.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Garanties & Délais */}
          {activeTab === 'warranties' && (
            <div className="max-w-3xl space-y-6">
              <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-border">
                  <ShieldCheck className="w-4 h-4 text-gold" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Délais et Périodes de Garantie Appliqués par Défaut
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2">
                    <label className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>Garantie Téléphones & Appareils</span>
                      <span className="text-gold font-bold">{formData.default_device_warranty_months} mois</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="36"
                      value={formData.default_device_warranty_months ?? 3}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_device_warranty_months: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-text text-sm focus:outline-none focus:border-gold-border"
                    />
                    <p className="text-[11px] text-text-muted">
                      Nombre de mois de garantie standard appliqués lors de la vente d'un téléphone.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2">
                    <label className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>Garantie Accessoires</span>
                      <span className="text-gold font-bold">{formData.default_accessory_warranty_months} mois</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={formData.default_accessory_warranty_months ?? 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_accessory_warranty_months: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-text text-sm focus:outline-none focus:border-gold-border"
                    />
                    <p className="text-[11px] text-text-muted">
                      Garantie accordée par défaut sur les chargeurs, écouteurs, coques, etc.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2">
                  <label className="text-xs font-semibold text-white flex items-center justify-between">
                    <span>Délai Maximal de Réservation Client</span>
                    <span className="text-gold font-bold">{formData.default_reservation_months} mois</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.default_reservation_months ?? 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_reservation_months: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-text text-sm focus:outline-none focus:border-gold-border max-w-xs"
                  />
                  <p className="text-[11px] text-text-muted">
                    Durée de validité par défaut avant expiration d'un acompte ou d'une réservation de téléphone.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleSaveSettings}
                  loading={isSaving}
                  icon={<Save className="w-4 h-4" />}
                >
                  Sauvegarder les Délais de Garantie
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Nouvel Opérateur */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Créer un Nouvel Opérateur / Caissier"
      >
        <form onSubmit={handleCreateOperator} className="space-y-4">
          {operatorModalError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{operatorModalError}</span>
            </div>
          )}

          <div>
            <Input
              label="Identifiant de connexion (Username) *"
              placeholder="ex: hassan, mohamed..."
              value={operatorForm.username}
              onChange={(e) => setOperatorForm({ ...operatorForm, username: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Prénom *"
                placeholder="ex: Hassan"
                value={operatorForm.first_name}
                onChange={(e) => setOperatorForm({ ...operatorForm, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Input
                label="Nom (Optionnel)"
                placeholder="ex: Bighrissen"
                value={operatorForm.last_name}
                onChange={(e) => setOperatorForm({ ...operatorForm, last_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5">
              Rôle & Droits d'Accès *
            </label>
            <select
              value={operatorForm.role}
              onChange={(e) => setOperatorForm({ ...operatorForm, role: e.target.value })}
              className="w-full h-10 px-3 bg-surface border border-border rounded-xl text-text text-sm focus:outline-none focus:border-gold-border"
            >
              <option value="CASHIER">Caissier / Opérateur (Droits caisse standard)</option>
              <option value="OWNER">Co-propriétaire & Administrateur (Tous les droits)</option>
            </select>
          </div>

          <div>
            <Input
              label="Mot de passe ou Code PIN (Optionnel)"
              type="password"
              icon={<Lock className="w-4 h-4" />}
              placeholder="••••••••"
              value={operatorForm.password}
              onChange={(e) => setOperatorForm({ ...operatorForm, password: e.target.value })}
            />
            <p className="text-[10px] text-text-muted mt-1">
              Si laissé vide, l'opérateur pourra être sélectionné directement au changement de session.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border mt-5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreatingOperator}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isCreatingOperator}
              icon={<Plus className="w-4 h-4" />}
            >
              Créer l'Opérateur
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Modifier Mot de Passe / Code PIN */}
      <Modal
        open={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedOperatorForPassword(null);
          setPasswordInput('');
          setPasswordModalError(null);
        }}
        title={`Modifier le Mot de Passe / PIN — ${selectedOperatorForPassword?.display_name || ''}`}
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          {passwordModalError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{passwordModalError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-surface border border-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold/15 border border-gold-border flex items-center justify-center text-gold font-bold text-xs uppercase">
              {selectedOperatorForPassword?.first_name ? selectedOperatorForPassword.first_name[0] : 'U'}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{selectedOperatorForPassword?.display_name}</p>
              <p className="text-[11px] text-text-muted">
                Identifiant : <span className="font-mono text-gold">{selectedOperatorForPassword?.username}</span>
              </p>
            </div>
          </div>

          <div>
            <Input
              label="Nouveau Mot de Passe ou Code PIN *"
              type="password"
              icon={<Lock className="w-4 h-4" />}
              placeholder="Saisissez le nouveau code..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
            />
            <p className="text-[11px] text-text-muted mt-1">
              Ce code permettra de se connecter sur l'écran d'accueil du POS.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border mt-5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsPasswordModalOpen(false);
                setSelectedOperatorForPassword(null);
                setPasswordInput('');
              }}
              disabled={isSavingPassword}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSavingPassword}
              icon={<Save className="w-4 h-4" />}
            >
              Enregistrer le Code
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
