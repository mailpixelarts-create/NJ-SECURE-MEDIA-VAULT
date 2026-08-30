import React from 'react';
import { motion } from 'framer-motion';

interface ProgressProps {
  value: number;
  max?: number;
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  showPercentage = true,
  showLabel = false,
  label,
  size = 'md',
  variant = 'primary',
  animated = true,
  className = ''
}) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  
  const sizeClasses = {
    sm: 'progress-sm',
    md: 'progress-md',
    lg: 'progress-lg'
  };
  
  const variantClasses = {
    primary: 'progress-primary',
    success: 'progress-success',
    warning: 'progress-warning',
    danger: 'progress-danger'
  };
  
  return (
    <div className={`progress-wrapper ${className}`}>
      {showLabel && label && (
        <div className="progress-label">
          <span>{label}</span>
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      
      <div className={`progress-bar ${sizeClasses[size]}`}>
        <motion.div
          className={`progress-fill ${variantClasses[variant]}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: animated ? 0.3 : 0 }}
        />
      </div>
      
      {!showLabel && showPercentage && (
        <span className="progress-percentage">{percentage}%</span>
      )}
    </div>
  );
};