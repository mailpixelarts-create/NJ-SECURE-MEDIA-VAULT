import React, { forwardRef } from 'react';

interface InputProps {
  id?: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'search';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  maxLength?: number;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  error,
  label,
  icon,
  className = '',
  maxLength,
  required = false
}, ref) => {
  return (
    <div className={`input-wrapper ${error ? 'input-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      
      <div className="input-container">
        {icon && <span className="input-icon">{icon}</span>}
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          required={required}
          className="input-field"
        />
      </div>
      
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';