import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import { useVaultStore } from './store/vaultStore';
import { LoginScreen } from './components/auth/LoginScreen';
import { RecoveryMode } from './components/auth/RecoveryMode';
import { Dashboard } from './components/dashboard/Dashboard';
import { SettingsPanel } from './components/security/SettingsPanel';
import { Toast } from './components/common/Toast';

const App: React.FC = () => {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { initializeVault, isLoading } = useVaultStore();
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated) {
        try {
          await initializeVault();
        } catch (err) {
          console.error('Vault init failed:', err);
        }
      }
    };
    init();
  }, [isAuthenticated]);

  // Listen for auto-lock events from main process
  useEffect(() => {
    if (window.electronAPI?.onAutoLocked) {
      window.electronAPI.onAutoLocked(() => {
        useAuthStore.getState().logout();
        window.location.hash = '#/login';
      });
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="loading-logo"
        >
          🔒
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Secure Media Vault
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Initializing encrypted vault...
        </motion.p>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <HashRouter>
        <AnimatePresence mode="wait">
          <Routes>
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LoginScreen onLogin={async (password) => {
                    const success = await useAuthStore.getState().login(password);
                    return success;
                  }} />
                )
              }
            />
            
            <Route
              path="/recovery"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <RecoveryMode />
                )
              }
            />
            
            <Route
              path="/dashboard"
              element={
                isAuthenticated ? (
                  <Dashboard />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            
            <Route
              path="/settings"
              element={
                isAuthenticated ? (
                  <SettingsPanel />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            
            <Route
              path="/"
              element={
                <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
              }
            />
          </Routes>
        </AnimatePresence>
      </HashRouter>
      
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </>
  );
};

export default App;