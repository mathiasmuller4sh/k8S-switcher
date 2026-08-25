import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  isLoading?: boolean;
  iconOnly?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  icon,
  isLoading,
  iconOnly,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClass = 'ui-button';
  const variantClass = `ui-button-${variant}`;
  const loadingClass = isLoading ? 'ui-button-loading' : '';
  const iconOnlyClass = iconOnly ? 'ui-button-icon-only' : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${loadingClass} ${iconOnlyClass} ${className}`.trim().replace(/\s+/g, ' ')}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="ui-button-icon loading-spin"><Loader2 size={16} className="animate-spin" /></span>
      ) : icon ? (
        <span className="ui-button-icon">{icon}</span>
      ) : null}
      {children && <span className="ui-button-text">{children}</span>}
    </button>
  );
}
