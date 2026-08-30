import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../common/Button';

export const Header: React.FC = () => {
  const [isAutoLockTimer, setIsAutoLockTimer] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/settings', label: 'Settings', icon: '⚙' }
  ];

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">
          <span className="logo-icon">🔒</span>
          <span className="logo-text">Secure Media Vault</span>
        </div>
        
        <nav className="header-nav">
          {navItems.map(item => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="header-right">
        <div className="header-status">
          <div className="status-badge encrypted">
            <span className="status-dot" />
            <span>Encrypted</span>
          </div>
          
          <div className="status-badge local">
            <span className="status-dot" />
            <span>Local Only</span>
          </div>
        </div>
        
        <div className="header-time">
          {currentTime.toLocaleTimeString()}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          icon="🚪"
        >
          Lock
        </Button>
      </div>
    </header>
  );
};