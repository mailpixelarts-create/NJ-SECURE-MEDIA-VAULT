import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface LoginScreenProps {
  onLogin: (password: string) => Promise<boolean>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const success = await onLogin(password);
      // React Router handles redirect via isAuthenticated prop in App.tsx
    } catch (err: any) {
      setError(err.message);
      setFailedAttempts(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="login-container"
      >
        <div className="login-header">
          <div className="logo">🔒</div>
          <h1>Secure Media Vault</h1>
          <p className="subtitle">Your Private Media, Maximum Security</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="password">Master Password</label>
            <div className="password-input-wrapper">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !password}
            fullWidth
          >
            {isLoading ? 'Unlocking...' : 'Unlock Vault'}
          </Button>

          <div className="login-options">
            <button
              type="button"
              className="link-button"
              onClick={() => window.location.hash = '#/recovery'}
            >
              🔑 Recovery Mode
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => window.location.hash = '#/hardware-key'}
            >
              🖥 Hardware Key
            </button>
          </div>
        </form>

        <div className="security-info">
          <div className="security-badge">
            <span className="status-indicator locked" />
            Auto-Lock: 5 min idle
          </div>
          <div className="security-badge">
            <span className="status-indicator warning" />
            Failed Attempts: {failedAttempts}/5
          </div>
          <div className="security-badge">
            <span className="status-indicator secure" />
            AES-256 Encryption
          </div>
        </div>

        <div className="login-footer">
          🔐 AES-256 • 🛡 Argon2id • 💾 Local Only
        </div>
      </motion.div>
    </div>
  );
};