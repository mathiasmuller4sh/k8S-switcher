import { X, Search } from 'lucide-react';
import { RefObject } from 'react';

interface ListFilterFieldProps {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  placeholder?: string;
  visible: boolean;
}

export function ListFilterField({ value, onChange, onClose, inputRef, placeholder = "Filter...", visible }: ListFilterFieldProps) {
  if (!visible) return null;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      gap: '8px',
      backdropFilter: 'blur(4px)'
    }}>
      <Search size={14} className="text-muted" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-color)',
          fontSize: '0.85rem',
          outline: 'none',
          flex: 1
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      />
      <button 
        onClick={onClose}
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          color: 'var(--text-color)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '4px',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
      >
        <X size={14} />
      </button>
    </div>
  );
}
