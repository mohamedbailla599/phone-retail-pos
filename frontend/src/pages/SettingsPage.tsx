import { useState, useEffect } from 'react';
import { settingsApi, type StoreSettings, type Operator } from '../api/settings';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import PageContainer from '../components/ui/PageContainer';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { formatCurrency } from '../utils/formatters';
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
  Sun,
  Moon,
  Monitor,
  Palette,
  Sparkles,
  Check,
  Bell,
  Mail,
  Send,
  Clock,
  RefreshCw,
  Smartphone,
  Package,
  DollarSign,
  Calendar,
  Download,
} from 'lucide-react';
import client from '../api/client';
import { useThemeStore } from '../store/themeStore';
import { notificationsApi } from '../api/notifications';
import { useNotificationStore } from '../store/notificationStore';

export default function SettingsPage() {
  const { operator: currentOperator } = useAuthStore();
  const { fetchSettings, updateSettings } = useSettingsStore();
  const { theme, resolvedTheme, setTheme } = useThemeStore();
  const { scanNow, unreadCount } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<'store' | 'appearance' | 'operators' | 'warranties' | 'notifications'>('store');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    try {
      setIsDownloadingBackup(true);
      const response = await client.get('/settings/backup/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.setAttribute('download', `bighrissen_pos_backup_${now}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      setSuccessMessage('Sauvegarde complète de la base de données téléchargée avec succès !');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Échec du téléchargement de la sauvegarde.');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  // Digest & Notification State
  const [isScanningAlerts, setIsScanningAlerts] = useState(false);
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [digestStatusMessage, setDigestStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [digestPreview, setDigestPreview] = useState<any>(null);

  // Form State for Store Settings
  const [formData, setFormData] = useState<Partial<StoreSettings>>({
    store_name: '',
    phone_number: '',
    address: '',
    currency: 'DH',
    receipt_prefix: 'BP',
    receipt_footer_message: '',
    owner_email: '',
    daily_digest_enabled: true,
    daily_digest_time: '23:00',
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
          owner_email: fetchedSettings.owner_email || '',
          daily_digest_enabled: fetchedSettings.daily_digest_enabled ?? true,
          daily_digest_time: fetchedSettings.daily_digest_time || '23:00',
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
        owner_email: updated.owner_email || '',
        daily_digest_enabled: updated.daily_digest_enabled ?? true,
        daily_digest_time: updated.daily_digest_time || '23:00',
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

  const handleScanAlerts = async () => {
    setIsScanningAlerts(true);
    try {
      await scanNow();
      setSuccessMessage('Scan des alertes effectué avec succès ! Le compteur et la cloche sont à jour.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du scan.');
    } finally {
      setIsScanningAlerts(false);
    }
  };

  const handleSendTestDigest = async () => {
    setIsSendingDigest(true);
    setDigestStatusMessage(null);
    try {
      const res = await notificationsApi.sendDigest({
        email: formData.owner_email || undefined,
      });
      if (res.status === 'success') {
        setDigestStatusMessage({
          type: 'success',
          text: `Récapitulatif généré et expédié à "${res.recipient}" avec succès ! (Si aucun serveur SMTP externe n'est configuré, le récapitulatif a été affiché dans le terminal de l'application).`,
        });
      } else {
        setDigestStatusMessage({
          type: 'error',
          text: `Erreur d'envoi : ${res.error || 'Veuillez vérifier la configuration email.'}`,
        });
      }
    } catch (err: any) {
      setDigestStatusMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || "Erreur lors de l'envoi du récapitulatif.",
      });
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handleOpenPreview = async () => {
    setIsLoadingPreview(true);
    setIsPreviewOpen(true);
    try {
      const res = await notificationsApi.sendDigest({ preview_only: true });
      if (res.status === 'success') {
        setDigestPreview(res.preview);
      }
    } catch (err: any) {
      console.error('Failed to load digest preview', err);
    } finally {
      setIsLoadingPreview(false);
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
      <PageContainer>
        <div className="h-96 flex flex-col items-center justify-center text-text-muted gap-3">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
          <p className="text-sm font-medium">Chargement des paramètres...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      header={
        <PageHeader
          title="Paramètres du Magasin"
          subtitle="Personnalisation de la boutique, en-tête & pied de ticket de caisse et gestion de l'équipe"
          icon={SettingsIcon}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gold/10 text-gold border border-gold-border/50">
              {formData.store_name || 'Bighrissen Phone'}
            </span>
          }
          actions={
            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                onClick={handleDownloadBackup}
                loading={isDownloadingBackup}
                icon={<Download className="w-4 h-4" />}
                className="text-xs font-semibold"
              >
                Sauvegarder la base
              </Button>
              {activeTab !== 'operators' && activeTab !== 'appearance' && (
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
          }
        />
      }
    >
      <div className="space-y-6">
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
          <StatCard
            label="Boutique Active"
            value={formData.store_name || 'Bighrissen Phone'}
            subValue={`Préfixe reçus : ${formData.receipt_prefix || 'BP'}`}
            icon={Store}
            variant="gold"
          />
          <StatCard
            label="Propriétaires & Direction"
            value="Hassan & Mohamed"
            subValue={`Co-propriétaires & Administrateurs (${activeOperatorsCount} actifs)`}
            icon={Crown}
            variant="gold"
          />
          <StatCard
            label="Garanties par Défaut"
            value={`${formData.default_device_warranty_months} mois`}
            subValue={`Accessoires : ${formData.default_accessory_warranty_months} m | Réservations : ${formData.default_reservation_months} m`}
            icon={ShieldCheck}
            variant="emerald"
          />
        </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <button
              onClick={() => setActiveTab('store')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'store'
                  ? 'bg-gold/15 text-gold border border-gold-border shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Boutique & Reçus</span>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'appearance'
                  ? 'bg-gold/15 text-gold border border-gold-border shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Thème & Apparence</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold/10 text-gold border border-gold-border/30">
                {resolvedTheme === 'dark' ? 'Sombre' : 'Clair'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('operators')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'operators'
                  ? 'bg-gold/15 text-gold border border-gold-border shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent'
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
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Garanties & Délais</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-gold/15 text-gold border border-gold-border shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications & Bilan Quotidien</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold/10 text-gold border border-gold-border/30 tabular-nums">
                {formData.daily_digest_time || '23:00'}
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                  {unreadCount}
                </span>
              )}
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
                        placeholder="+212 617-646824"
                      />
                    </div>
                  </div>

                  <div>
                    <Input
                      label="Adresse Physique"
                      icon={<MapPin className="w-4 h-4" />}
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Ex: Boulevard Youssef Bin Tachfine, Guelmim"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <Input
                        label="Devise Monétaire"
                        value={formData.currency || 'DH'}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                        placeholder="DH"
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
                    <div className="flex items-center gap-3 pb-2 border-b border-black border-dashed">
                      <img
                        src="/logo.jpg"
                        alt="Logo"
                        className="w-12 h-12 rounded-full border border-black object-cover shrink-0"
                      />
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-bold uppercase tracking-wider leading-tight">
                          {formData.store_name || 'BIGHRISSEN PHONE'}
                        </p>
                        <p className="text-[10px] mt-0.5 leading-tight">{formData.address || 'Boulevard Youssef Bin Tachfine, Guelmim'}</p>
                        <p className="text-[10px] leading-tight">Tél : {formData.phone_number || '+212 617-646824'}</p>
                      </div>
                    </div>

                    <div className="space-y-0.5 text-[10px] border-b border-black border-dashed pb-2">
                      <p>Ticket : {formData.receipt_prefix || 'BP'}-20261014-001</p>
                      <p>Date : 14/10/2026 14:30</p>
                      <p>Opérateur : {currentOperator?.display_name || 'Mohamed'}</p>
                      <p>Client : Client de Passage</p>
                    </div>

                    <div className="border-b border-black border-dashed pb-2">
                      <div className="flex justify-between font-bold text-[10px] mb-1">
                        <span>Article</span>
                        <span>Total</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>iPhone 15 Pro (128GB)</span>
                        <span>8,900.00 {formData.currency || 'DH'}</span>
                      </div>
                      <div className="text-[9px] text-gray-500">IMEI: 352981098765432</div>
                    </div>

                    <div className="border-b border-black border-dashed pb-2 space-y-0.5 text-[10px]">
                      <div className="flex justify-between font-bold text-xs pt-1">
                        <span>TOTAL :</span>
                        <span>8,900.00 {formData.currency || 'DH'}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>Mode : Espèces</span>
                        <span>8,900.00 {formData.currency || 'DH'}</span>
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

          {/* Tab: Apparence & Thème */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
              {/* Header Banner */}
              <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold">
                    <Palette className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text">Choix du Thème Visuel</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Personnalisez l'ambiance de l'application selon vos préférences ou les conditions d'éclairage du magasin.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-alt border border-border text-xs">
                  <span className="text-text-muted font-medium">Mode actif :</span>
                  <span className="font-bold text-gold flex items-center gap-1.5">
                    {resolvedTheme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    {theme === 'system'
                      ? `Système (${resolvedTheme === 'dark' ? 'Sombre' : 'Clair'})`
                      : resolvedTheme === 'dark'
                      ? 'Sombre (Noir & Or)'
                      : 'Clair (Blanc & Or)'}
                  </span>
                </div>
              </div>

              {/* Theme Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Dark Mode */}
                <div
                  onClick={() => {
                    setTheme('dark');
                    setSuccessMessage('Thème Sombre (Noir & Or) activé.');
                    setTimeout(() => setSuccessMessage(null), 3000);
                  }}
                  className={`group relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover-lift ${
                    theme === 'dark'
                      ? 'bg-surface border-gold shadow-lg shadow-gold/10 ring-1 ring-gold/30'
                      : 'bg-surface border-border hover:border-gold-border/60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#1C1C1C] border border-neutral-700 flex items-center justify-center text-gold">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold/10 text-gold border border-gold-border/40">
                          Signature
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            theme === 'dark'
                              ? 'border-gold bg-gold text-black'
                              : 'border-neutral-600 bg-surface-alt'
                          }`}
                        >
                          {theme === 'dark' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-text">Mode Sombre</h3>
                      <p className="text-[11px] font-medium text-gold mt-0.5">Noir & Or Signature</p>
                      <p className="text-xs text-text-muted mt-2 leading-relaxed">
                        Fond noir profond, surfaces sombres contrastées et finitions or luxueuses. Idéal pour préserver la vue et économiser la batterie.
                      </p>
                    </div>

                    {/* Miniature UI Mockup */}
                    <div className="p-3 rounded-xl bg-[#080808] border border-neutral-800 space-y-2 mt-4 select-none pointer-events-none">
                      <div className="h-5 px-2 bg-[#111111] border border-neutral-800 rounded flex items-center justify-between">
                        <span className="text-[9px] font-bold text-[#D4AF5A]">BIGHRISSEN</span>
                        <div className="w-2 h-2 rounded-full bg-[#D4AF5A]" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-1.5 rounded bg-[#161616] border border-neutral-800">
                          <span className="text-[8px] text-neutral-400">Ventes</span>
                          <p className="text-[10px] font-bold text-[#D4AF5A]">12 450 DH</p>
                        </div>
                        <div className="p-1.5 rounded bg-[#161616] border border-neutral-800">
                          <span className="text-[8px] text-neutral-400">Stock</span>
                          <p className="text-[10px] font-bold text-neutral-200">28 pcs</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-text-muted">Palette sombre</span>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-gold' : 'text-text-secondary'}`}>
                      {theme === 'dark' ? '✓ Actif' : 'Sélectionner'}
                    </span>
                  </div>
                </div>

                {/* 2. Light Mode */}
                <div
                  onClick={() => {
                    setTheme('light');
                    setSuccessMessage('Thème Clair (Blanc & Or) activé.');
                    setTimeout(() => setSuccessMessage(null), 3000);
                  }}
                  className={`group relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover-lift ${
                    theme === 'light'
                      ? 'bg-surface border-gold shadow-lg shadow-gold/10 ring-1 ring-gold/30'
                      : 'bg-surface border-border hover:border-gold-border/60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          Épuré
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            theme === 'light'
                              ? 'border-gold bg-gold text-black'
                              : 'border-neutral-400 bg-surface-alt'
                          }`}
                        >
                          {theme === 'light' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-text">Mode Clair</h3>
                      <p className="text-[11px] font-medium text-amber-700 dark:text-gold mt-0.5">Blanc & Or Épuré</p>
                      <p className="text-xs text-text-muted mt-2 leading-relaxed">
                        Surfaces lumineuses, typographies foncées à contraste élevé et dorures raffinées. Idéal pour les boutiques fortement éclairées.
                      </p>
                    </div>

                    {/* Miniature UI Mockup */}
                    <div className="p-3 rounded-xl bg-[#F4F5F8] border border-neutral-300 space-y-2 mt-4 select-none pointer-events-none">
                      <div className="h-5 px-2 bg-white border border-neutral-200 rounded flex items-center justify-between shadow-xs">
                        <span className="text-[9px] font-bold text-[#B8860B]">BIGHRISSEN</span>
                        <div className="w-2 h-2 rounded-full bg-[#B8860B]" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-1.5 rounded bg-white border border-neutral-200 shadow-xs">
                          <span className="text-[8px] text-neutral-500">Ventes</span>
                          <p className="text-[10px] font-bold text-[#B8860B]">12 450 DH</p>
                        </div>
                        <div className="p-1.5 rounded bg-white border border-neutral-200 shadow-xs">
                          <span className="text-[8px] text-neutral-500">Stock</span>
                          <p className="text-[10px] font-bold text-neutral-900">28 pcs</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-text-muted">Palette claire</span>
                    <span className={`font-semibold ${theme === 'light' ? 'text-gold' : 'text-text-secondary'}`}>
                      {theme === 'light' ? '✓ Actif' : 'Sélectionner'}
                    </span>
                  </div>
                </div>

                {/* 3. System Mode */}
                <div
                  onClick={() => {
                    setTheme('system');
                    setSuccessMessage('Synchronisation avec le système activée.');
                    setTimeout(() => setSuccessMessage(null), 3000);
                  }}
                  className={`group relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover-lift ${
                    theme === 'system'
                      ? 'bg-surface border-gold shadow-lg shadow-gold/10 ring-1 ring-gold/30'
                      : 'bg-surface border-border hover:border-gold-border/60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          Automatique
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            theme === 'system'
                              ? 'border-gold bg-gold text-black'
                              : 'border-neutral-600 bg-surface-alt'
                          }`}
                        >
                          {theme === 'system' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-text">Automatique / Système</h3>
                      <p className="text-[11px] font-medium text-blue-400 mt-0.5">Selon votre appareil</p>
                      <p className="text-xs text-text-muted mt-2 leading-relaxed">
                        S'adapte automatiquement à l'apparence de votre système d'exploitation (mode clair le jour, mode sombre la nuit).
                      </p>
                    </div>

                    {/* Miniature UI Mockup */}
                    <div className="p-3 rounded-xl bg-surface-alt border border-border space-y-2 mt-4 select-none pointer-events-none flex flex-col items-center justify-center min-h-[66px]">
                      <Monitor className="w-6 h-6 text-text-muted" />
                      <p className="text-[10px] text-text-secondary font-medium">
                        Détecté : <span className="font-bold text-gold">{resolvedTheme === 'dark' ? 'Mode Sombre' : 'Mode Clair'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-text-muted">Détection auto</span>
                    <span className={`font-semibold ${theme === 'system' ? 'text-gold' : 'text-text-secondary'}`}>
                      {theme === 'system' ? '✓ Actif' : 'Sélectionner'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Design System Swatches / Live Token Preview */}
              <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gold" />
                    <h3 className="text-sm font-bold text-text">Nuancier Actuel en Direct</h3>
                  </div>
                  <span className="text-xs text-text-muted">Rendu dynamique Tailwind v4</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex flex-col gap-1.5">
                    <div className="w-full h-8 rounded-lg bg-gold shadow-sm flex items-center justify-center text-[10px] font-bold text-black">
                      Or Accent
                    </div>
                    <span className="text-[11px] font-semibold text-text">Signature Gold</span>
                    <span className="text-[10px] text-text-muted font-mono">var(--theme-gold)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex flex-col gap-1.5">
                    <div className="w-full h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text">
                      Surface
                    </div>
                    <span className="text-[11px] font-semibold text-text">Fond Cartes</span>
                    <span className="text-[10px] text-text-muted font-mono">var(--theme-surface)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex flex-col gap-1.5">
                    <div className="w-full h-8 rounded-lg bg-bg border border-border flex items-center justify-center text-[10px] font-bold text-text">
                      Arrière-plan
                    </div>
                    <span className="text-[11px] font-semibold text-text">Fond Global</span>
                    <span className="text-[10px] text-text-muted font-mono">var(--theme-bg)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex flex-col gap-1.5">
                    <div className="w-full h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-500">
                      Succès
                    </div>
                    <span className="text-[11px] font-semibold text-text">Paiements & Encaissé</span>
                    <span className="text-[10px] text-text-muted font-mono">#10B981</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex flex-col gap-1.5">
                    <div className="w-full h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-500">
                      Avertissement
                    </div>
                    <span className="text-[11px] font-semibold text-text">Échéances & Dettes</span>
                    <span className="text-[10px] text-text-muted font-mono">#F59E0B</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex flex-col gap-1.5">
                    <div className="w-full h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-[10px] font-bold text-red-500">
                      Danger
                    </div>
                    <span className="text-[11px] font-semibold text-text">Alertes & Annulations</span>
                    <span className="text-[10px] text-text-muted font-mono">#EF4444</span>
                  </div>
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

          {/* Tab 5: Notifications & Rapport */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Status Header Banner */}
              <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold-border flex items-center justify-center text-gold shadow-lg shadow-gold/5 flex-shrink-0">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-bold text-text">Système d'Alertes & Bilan Quotidien</h2>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gold/15 text-gold border border-gold-border/30 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-gold" />
                        Prévu à {formData.daily_digest_time || '23:00'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Surveillance Active
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1 max-w-2xl">
                      Détection proactive des stocks critiques (téléphones &le; 1, accessoires sous seuil), dépassements de crédit client, réservations expirées et envoi automatisé du bilan financier journalier à <strong>{formData.daily_digest_time || '23:00'}</strong> (heure de Casablanca).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    onClick={handleScanAlerts}
                    loading={isScanningAlerts}
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    Scanner les alertes maintenant
                  </Button>
                </div>
              </div>

              {/* Status Feedback Message */}
              {digestStatusMessage && (
                <div
                  className={`p-4 rounded-xl text-xs flex items-center gap-3 animate-[fadeIn_150ms_ease-out] ${
                    digestStatusMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/10 border border-red-500/20 text-red-300'
                  }`}
                >
                  {digestStatusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                  )}
                  <span className="leading-relaxed">{digestStatusMessage.text}</span>
                </div>
              )}

              {/* Grid 2 Columns: Email Settings & Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Card 1: Configuration de l'Email et de l'Heure d'Envoi */}
                <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-border">
                    <Mail className="w-4 h-4 text-gold" />
                    <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                      Destinataire & Heure du Rapport Quotidien
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Input
                        label="Adresse Email du Propriétaire / Gérant"
                        type="email"
                        icon={<Mail className="w-4 h-4" />}
                        value={formData.owner_email || ''}
                        onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                        placeholder="ex: proprietaire@bighrissenphone.com"
                      />
                      <p className="text-[11px] text-text-muted mt-1.5">
                        Cette adresse recevra automatiquement le récapitulatif complet des ventes, règlements et alertes de stock chaque soir.
                      </p>
                    </div>

                    {/* Scheduled Time Option */}
                    <div>
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gold" />
                          Heure d'Envoi Automatique Programmé
                        </span>
                        <span className="text-[11px] font-bold text-gold tabular-nums bg-gold/10 px-2 py-0.5 rounded border border-gold-border/30">
                          {formData.daily_digest_time || '23:00'} (GMT+1)
                        </span>
                      </label>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                        <div className="relative flex-1 min-w-[120px]">
                          <input
                            type="time"
                            value={formData.daily_digest_time || '23:00'}
                            onChange={(e) => setFormData({ ...formData, daily_digest_time: e.target.value })}
                            className="w-full h-10 px-3 bg-surface-elevated border border-border rounded-xl text-text text-sm font-bold tabular-nums focus:outline-none focus:border-gold-border focus-ring cursor-pointer"
                          />
                        </div>
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1 overflow-x-auto py-1">
                          {['20:00', '21:00', '22:00', '23:00', '00:00'].map((presetTime) => (
                            <button
                              key={presetTime}
                              type="button"
                              onClick={() => setFormData({ ...formData, daily_digest_time: presetTime })}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-all cursor-pointer border ${
                                formData.daily_digest_time === presetTime
                                  ? 'bg-gold text-bg font-bold border-gold shadow-xs'
                                  : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-white/5 border-border'
                              }`}
                            >
                              {presetTime}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1.5">
                        Heure locale à laquelle le bilan financier et les alertes de stock sont consolidés et expédiés (fuseau Africa/Casablanca).
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="daily_digest_toggle"
                        checked={formData.daily_digest_enabled ?? true}
                        onChange={(e) => setFormData({ ...formData, daily_digest_enabled: e.target.checked })}
                        className="mt-1 w-4 h-4 rounded text-gold focus:ring-gold border-border bg-surface cursor-pointer"
                      />
                      <label htmlFor="daily_digest_toggle" className="text-xs cursor-pointer select-none space-y-1">
                        <span className="font-semibold text-text block">
                          Activer l'envoi automatique chaque soir à {formData.daily_digest_time || '23:00'}
                        </span>
                        <span className="text-text-muted block text-[11px]">
                          Déclencheur d'arrière-plan calé sur le fuseau horaire <strong>Africa/Casablanca (GMT+1)</strong>.
                        </span>
                      </label>
                    </div>

                    <div className="p-3.5 rounded-xl bg-gold/5 border border-gold-border/30 text-xs text-text-secondary flex items-start gap-3">
                      <Clock className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 text-[11px]">
                        <p className="font-semibold text-gold">Fonctionnement en environnement local</p>
                        <p className="text-text-muted leading-relaxed">
                          Si vos identifiants SMTP (Gmail, Brevo, etc.) sont configurés dans les variables d'environnement, les emails partent directement dans votre boîte de réception. Sans SMTP configuré, le récapitulatif est généré et affiché automatiquement dans le terminal local sans interruption.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      onClick={handleSaveSettings}
                      loading={isSaving}
                      icon={<Save className="w-4 h-4" />}
                    >
                      Enregistrer les Préférences
                    </Button>
                  </div>
                </div>

                {/* Card 2: Tests Immédiats & Aperçu */}
                <div className="p-6 rounded-2xl bg-surface border border-border space-y-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 pb-3 border-b border-border">
                      <Send className="w-4 h-4 text-gold" />
                      <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                        Déclenchement Manuel & Prévisualisation
                      </h3>
                    </div>

                    <p className="text-xs text-text-muted mt-3 mb-4 leading-relaxed">
                      Testez immédiatement l'envoi d'un récapitulatif sans attendre {formData.daily_digest_time || '23:00'} ou prévisualisez les chiffres consolidés du jour directement dans une fenêtre modale.
                    </p>

                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-white">Tester l'envoi du récapitulatif</p>
                          <p className="text-[11px] text-text-muted">
                            Expédie le rapport à {formData.owner_email || 'l\'adresse par défaut'}.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={handleSendTestDigest}
                          loading={isSendingDigest}
                          icon={<Send className="w-4 h-4" />}
                        >
                          Envoyer le test
                        </Button>
                      </div>

                      <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-white">Aperçu du Bilan en direct</p>
                          <p className="text-[11px] text-text-muted">
                            Affiche les ventes, la caisse, les dettes et le stock sans envoyer d'email.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={handleOpenPreview}
                          loading={isLoadingPreview}
                          icon={<Eye className="w-4 h-4" />}
                        >
                          Voir l'aperçu
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-elevated/50 border border-border text-[11px] text-text-muted flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gold flex-shrink-0" />
                    <span>La cloche 🔔 en haut de la barre latérale affiche vos alertes en temps réel à tout moment.</span>
                  </div>
                </div>
              </div>

              {/* Rules & Triggers Cards */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gold" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Règles de Détection & Déclencheurs Automatiques
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Stock Téléphones</span>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Alerte automatique dès qu'un modèle n'a plus qu'<strong>un seul exemplaire</strong> ou <strong>0 unité</strong> en inventaire.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Critique &le; 1 unité
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Accessoires</span>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Déclenché dès que la quantité restante d'un accessoire est <strong>inférieure ou égale</strong> à son seuil de réapprovisionnement.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      &le; Seuil d'alerte article
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-bold text-white">Dettes & Crédits</span>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Notification immédiate pour tout client ayant une <strong>dette active impayée</strong> ou dépassant son plafond autorisé.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                      Solde débiteur actif
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">Réservations</span>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Détecte les réservations expirées pour <strong>libérer l'appareil bloqué</strong> ou expirant sous 24h ouvrées.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Délai de validité dépassé
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>


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

      {/* Modal Aperçu du Rapport Quotidien */}
      <Modal
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`Aperçu du Rapport Quotidien (Bilan de ${digestPreview?.scheduled_time || formData.daily_digest_time || '23:00'})`}
      >
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {isLoadingPreview ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <span className="text-xs">Consolidation des données du jour en cours...</span>
            </div>
          ) : digestPreview ? (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-text text-sm">{digestPreview.store_name}</h4>
                  <p className="text-xs text-text-muted">Date : {digestPreview.date_str}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gold font-semibold">Heure d'expédition cible</span>
                  <p className="text-sm font-bold text-text tabular-nums">
                    {digestPreview.scheduled_time || formData.daily_digest_time || '23:00'} (Casablanca)
                  </p>
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border text-center">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Chiffre d'Affaires</span>
                  <span className="text-base font-bold text-gold tabular-nums">{formatCurrency(digestPreview.total_revenue || 0)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border text-center">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Ventes Totales</span>
                  <span className="text-base font-bold text-text tabular-nums">{digestPreview.total_sales_count || 0}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border text-center">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Espèces</span>
                  <span className="text-base font-bold text-emerald-400 tabular-nums">{formatCurrency(digestPreview.cash_total || 0)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border text-center">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Dettes Globales</span>
                  <span className="text-base font-bold text-red-400 tabular-nums">{formatCurrency(digestPreview.total_outstanding_debt || 0)}</span>
                </div>
              </div>

              {/* Stock Alerts in preview */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                    Téléphones en Stock Critique (Total : {digestPreview.low_device_items?.length || 0})
                  </h5>
                </div>
                {digestPreview.low_device_items?.length === 0 ? (
                  <p className="text-xs text-emerald-400">Aucun modèle en rupture critique !</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {digestPreview.low_device_items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated text-xs">
                        <span className="text-text font-medium">{item.model_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 tabular-nums">
                          {item.stock_count} restant{item.stock_count > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Accessories in preview */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    Accessoires sous le Seuil (Total : {digestPreview.low_accessory_items?.length || 0})
                  </h5>
                </div>
                {digestPreview.low_accessory_items?.length === 0 ? (
                  <p className="text-xs text-emerald-400">Tous les accessoires ont un stock suffisant.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {digestPreview.low_accessory_items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated text-xs">
                        <span className="text-text font-medium">{item.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 tabular-nums">
                          {item.current_stock} / seuil {item.reorder_level}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Debtors in preview */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-red-400" />
                    Clients avec Dettes Actives ({digestPreview.debtor_customers?.length || 0})
                  </h5>
                </div>
                {digestPreview.debtor_customers?.length === 0 ? (
                  <p className="text-xs text-emerald-400">Aucune dette impayée !</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {digestPreview.debtor_customers?.map((client: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated text-xs">
                        <div>
                          <span className="text-text font-medium block">{client.name}</span>
                          <span className="text-[10px] text-text-muted">{client.phone}</span>
                        </div>
                        <span className="font-bold text-red-400 tabular-nums">{formatCurrency(client.debt || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-6">Aucune donnée disponible.</p>
          )}

          <div className="flex justify-end pt-3 border-t border-border">
            <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>
              Fermer l'aperçu
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
