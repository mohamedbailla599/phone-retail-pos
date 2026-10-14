import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/auth';
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import ScannerPage from './pages/ScannerPage';
import DevicesPage from './pages/DevicesPage';
import AccessoriesPage from './pages/AccessoriesPage';
import { ExchangesPage } from './pages/ExchangesPage';
import DashboardPage from './pages/DashboardPage';
import RepairsPage from './pages/RepairsPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ReturnsRefundsPage from './pages/ReturnsRefundsPage';
import SettingsPage from './pages/SettingsPage';
import { useSettingsStore } from './store/settingsStore';
import { Loader2 } from 'lucide-react';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setAuth, setOperator, operator, setLoading, isLoading } = useAuthStore();
  const { fetchSettings } = useSettingsStore();

  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      try {
        const data = await authApi.me();
        if (mounted) {
          setAuth(data.user);
          if (data.operator) {
            setOperator(data.operator);
          } else if (operator) {
            // Re-sync operator session with backend
            authApi.selectOperator(operator.id).then((res) => {
              if (mounted) setOperator(res.operator);
            }).catch(() => {});
          }
          // Preload store settings for receipts and configuration
          fetchSettings().catch(() => {});
        }
      } catch (err) {
        if (mounted) {
          setAuth(null);
          setOperator(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchMe();
    return () => {
      mounted = false;
    };
  }, [setAuth, setOperator, setLoading]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <AuthInitializer>
        <Routes>
          <Route path="/" element={<Navigate to="/pos" replace />} />
          
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/pos" element={
            <ProtectedRoute>
              <POSPage />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/scanner/:transactionId" element={
            <ProtectedRoute>
              <ScannerPage />
            </ProtectedRoute>
          } />

          <Route path="/devices" element={
            <ProtectedRoute>
              <DevicesPage />
            </ProtectedRoute>
          } />

          <Route path="/accessories" element={
            <ProtectedRoute>
              <AccessoriesPage />
            </ProtectedRoute>
          } />

          <Route path="/exchanges" element={
            <ProtectedRoute>
              <ExchangesPage />
            </ProtectedRoute>
          } />

          <Route path="/returns" element={
            <ProtectedRoute>
              <ReturnsRefundsPage />
            </ProtectedRoute>
          } />

          <Route path="/repairs" element={
            <ProtectedRoute>
              <RepairsPage />
            </ProtectedRoute>
          } />

          <Route path="/customers" element={
            <ProtectedRoute>
              <CustomersPage />
            </ProtectedRoute>
          } />

          <Route path="/reports" element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          } />

          <Route path="/audit-logs" element={
            <ProtectedRoute>
              <AuditLogsPage />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </AuthInitializer>
    </Router>
  );
}

export default App;
