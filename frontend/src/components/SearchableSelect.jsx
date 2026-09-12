import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  children,
  placeholder = '-- Select Option --',
  searchPlaceholder = 'Type to search...',
  disabled = false,
  required = false,
  className = '',
  name,
  id,
  dark = false,
  valueKey = 'value',
  labelKey = 'label',
  sublabelKey = 'sublabel',
  badgeKey = 'badge',
  renderOption,
  renderSelected,
  allowClear = false,
  minSearchItems = 4
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options from options prop or React children <option>
  const normalizedOptions = useMemo(() => {
    let list = [];
    if (Array.isArray(options) && options.length > 0) {
      list = options.map((opt) => {
        if (opt === null || opt === undefined) return { value: '', label: '' };
        if (typeof opt === 'string' || typeof opt === 'number') {
          return { value: String(opt), label: String(opt) };
        }
        const val = opt[valueKey] !== undefined ? opt[valueKey] : (opt.id !== undefined ? opt.id : opt.value);
        const lbl = opt[labelKey] !== undefined ? opt[labelKey] : (opt.name !== undefined ? opt.name : (opt.label || String(val)));
        const sub = opt[sublabelKey] !== undefined ? opt[sublabelKey] : (opt.phone || opt.code || opt.route_name || opt.territory || opt.employee_code || null);
        const badge = opt[badgeKey] !== undefined ? opt[badgeKey] : null;
        return {
          ...opt,
          value: val !== undefined && val !== null ? String(val) : '',
          label: lbl !== undefined && lbl !== null ? String(lbl) : '',
          sublabel: sub ? String(sub) : null,
          badge: badge ? String(badge) : null
        };
      });
    } else if (children) {
      React.Children.forEach(children, (child) => {
        if (child && child.props) {
          const val = child.props.value !== undefined ? String(child.props.value) : '';
          const lbl = child.props.children ? String(child.props.children) : val;
          list.push({ value: val, label: lbl });
        }
      });
    }
    return list;
  }, [options, children, valueKey, labelKey, sublabelKey, badgeKey]);

  // Current selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null) return null;
    const strVal = String(value);
    return normalizedOptions.find((opt) => String(opt.value) === strVal) || null;
  }, [normalizedOptions, value]);

  // Filter options based on search input
  const filteredOptions = useMemo(() => {
    if (!search || !search.trim()) return normalizedOptions;
    const s = search.toLowerCase().trim();
    return normalizedOptions.filter((opt) => {
      const matchLabel = opt.label && String(opt.label).toLowerCase().includes(s);
      const matchValue = opt.value && String(opt.value).toLowerCase().includes(s);
      const matchSub = opt.sublabel && String(opt.sublabel).toLowerCase().includes(s);
      return matchLabel || matchValue || matchSub;
    });
  }, [normalizedOptions, search]);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const buttonRef = useRef(null);

  // Handle item selection
  const handleSelect = (option) => {
    if (disabled) return;
    const newVal = option ? option.value : '';
    setIsOpen(false);
    setSearch('');
    if (onChange) {
      // Send both synthetic event (for <select> compatibility) and direct value
      const syntheticEvent = {
        target: {
          name: name || '',
          value: newVal
        }
      };
      onChange(syntheticEvent, option);
    }
    // Return focus to button after selection
    setTimeout(() => {
      buttonRef.current?.focus();
    }, 10);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightIndex]) {
        handleSelect(filteredOptions[highlightIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      // When tabbing away from open dropdown, auto-select highlighted option if searching or close gracefully
      if (search && filteredOptions[highlightIndex]) {
        const selected = filteredOptions[highlightIndex];
        const newVal = selected.value;
        if (onChange) {
          onChange({ target: { name: name || '', value: newVal } }, selected);
        }
      }
      setIsOpen(false);
      // Do not call preventDefault so native Tab advances to the next form field!
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightIndex];
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  // Theme styles
  const baseButtonClass = dark
    ? 'bg-slate-900 border-slate-700 text-slate-100 hover:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:border-blue-400'
    : 'bg-white border-slate-300 text-slate-900 hover:border-[#004c8f] focus-visible:ring-2 focus-visible:ring-[#004c8f] focus-visible:border-[#004c8f]';

  const menuBgClass = dark
    ? 'bg-slate-900 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const searchBgClass = dark
    ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500'
    : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#004c8f]';

  const itemHoverClass = dark
    ? 'hover:bg-slate-800 text-slate-200'
    : 'hover:bg-blue-50 text-slate-800';

  const activeItemClass = dark
    ? 'bg-blue-950/80 text-blue-300 font-bold border-l-4 border-blue-500'
    : 'bg-blue-50 text-[#004c8f] font-bold border-l-4 border-[#004c8f]';

  const isShowSearch = normalizedOptions.length >= minSearchItems;

  return (
    <div className="relative w-full select-none" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Hidden input for HTML form submission if needed */}
      {name && <input type="hidden" name={name} id={id} value={value || ''} required={required} />}

      {/* Main trigger button */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all shadow-2xs text-left cursor-pointer focus:outline-none disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed ${baseButtonClass} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate flex-1">
          {selectedOption && selectedOption.value !== '' ? (
            renderSelected ? (
              renderSelected(selectedOption)
            ) : (
              <div className="flex items-center gap-2 truncate">
                {selectedOption.badge && (
                  <span className="font-mono font-black text-[#004c8f] bg-blue-100 px-2 py-0.5 rounded text-[11px] shrink-0 border border-blue-200">
                    {selectedOption.badge}
                  </span>
                )}
                <span className="truncate font-bold">{selectedOption.label}</span>
                {selectedOption.sublabel && (
                  <span className="text-[10px] text-slate-400 font-normal truncate">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </div>
            )
          ) : (
            <span className={dark ? 'text-slate-500 font-normal' : 'text-slate-400 font-normal'}>
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedOption && selectedOption.value !== '' && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect({ value: '', label: '' });
              }}
              className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute left-0 right-0 top-full mt-1.5 rounded-2xl border shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100 ${menuBgClass}`}>
          {/* Inline Search Input */}
          {isShowSearch && (
            <div className={`p-2.5 border-b sticky top-0 z-10 flex items-center gap-2 ${dark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none transition-colors ${searchBgClass}`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-slate-400 hover:text-slate-200 text-[10px] font-bold px-1.5 py-0.5 bg-slate-700/50 rounded cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto divide-y divide-slate-100/10 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 font-medium">
                No matching options found {search ? `for "${search}"` : ''}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightIndex;

                return (
                  <div
                    key={opt.value + '_' + idx}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`p-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? activeItemClass
                        : isHighlighted
                        ? itemHoverClass
                        : ''
                    }`}
                  >
                    {renderOption ? (
                      renderOption(opt, isSelected)
                    ) : (
                      <div className="truncate pr-2 flex items-center gap-2">
                        {opt.badge && (
                          <span className="font-mono font-black text-[#004c8f] bg-blue-100 text-[10px] px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                            {opt.badge}
                          </span>
                        )}
                        <div>
                          <div className="font-extrabold truncate text-xs">{opt.label}</div>
                          {opt.sublabel && (
                            <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                              {opt.sublabel}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with counts if many options */}
          {normalizedOptions.length > 5 && (
            <div className={`px-3 py-1.5 border-t text-[10px] font-bold flex justify-between items-center ${dark ? 'bg-slate-950/70 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
              <span>Showing {filteredOptions.length} of {normalizedOptions.length} items</span>
              {search && <span>Filtered</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
