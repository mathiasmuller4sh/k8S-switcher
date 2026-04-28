import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Star, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  onToggleFavorite?: (value: string) => void;
  isFavorite?: (value: string) => boolean;
  onClear?: () => void;
}

export function SelectDropdown({
  options,
  value,
  onChange,
  label,
  disabled,
  className = '',
  onToggleFavorite,
  isFavorite,
  onClear
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure the element is mounted before focusing
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      // Clear search when closing
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort options: favorites first, then alphabetical
  const sortedOptions = [...filteredOptions].sort((a, b) => {
    if (isFavorite) {
      const aFav = isFavorite(a.value);
      const bFav = isFavorite(b.value);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
    }
    return a.label.localeCompare(b.label);
  });

  return (
    <div className={`ui-select-container ${className}`.trim()} ref={dropdownRef}>
      {label && <label className="ui-select-label">{label}</label>}
      <div 
        className={`ui-select-element custom-select ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="ui-select-selected-value">
          {selectedOption ? selectedOption.label : <span className="ui-select-placeholder">Select...</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {onClear && value && (
            <div 
              className="ui-select-clear-btn" 
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Clear selection"
            >
              <X size={14} />
            </div>
          )}
          <ChevronDown className="ui-select-icon" size={16} />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="ui-select-dropdown-menu">
          <div className="ui-select-search-wrapper">
            <input
              ref={searchInputRef}
              type="text"
              className="ui-select-search-input"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="ui-select-options-list">
            {sortedOptions.length === 0 ? (
              <div className="ui-select-empty">No options found</div>
            ) : (
              sortedOptions.map((opt) => {
                const fav = isFavorite ? isFavorite(opt.value) : false;
                return (
                  <div 
                    key={opt.value} 
                    className={`ui-select-option ${value === opt.value ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    <span className="ui-select-option-label">{opt.label}</span>
                    {onToggleFavorite && (
                      <span 
                        className={`ui-select-favorite-btn ${fav ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent selecting the option
                          onToggleFavorite(opt.value);
                        }}
                      >
                        <Star size={16} className={fav ? 'fill-current' : ''} />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
