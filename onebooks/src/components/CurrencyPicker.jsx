import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { WORLD_CURRENCIES } from '../utils/currencies';

/**
 * Searchable currency dropdown backed by the full world-currencies list.
 *
 * Props
 * ─────
 *  value      currency code (e.g. "USD")
 *  onChange   (code) => void
 *  size       "sm" | "md"   – controls padding + font-size
 *  disabled   boolean
 *  ariaLabel  string
 */
const CurrencyPicker = ({
  value,
  onChange,
  size = 'md',
  disabled = false,
  ariaLabel = 'Currency',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = WORLD_CURRENCIES.find((c) => c.code === value);
  const q = search.toLowerCase().trim();
  const filtered = q
    ? WORLD_CURRENCIES.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.label.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q)
      )
    : WORLD_CURRENCIES;

  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  const pad = size === 'sm' ? '8px 12px' : '10px 14px';
  const fs = size === 'sm' ? 13 : 14;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: pad,
          fontSize: fs,
          background: disabled ? '#f8fafc' : '#fff',
          border: '1px solid #d0d7e2',
          borderRadius: 10,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          fontFamily: 'inherit',
          color: '#0f172a',
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{selected.flag}</span>
            <span style={{ fontWeight: 600 }}>{selected.code}</span>
            <span style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              — {selected.label}
            </span>
          </>
        ) : (
          <span style={{ color: '#94a3b8', flex: 1 }}>Select currency…</span>
        )}
        <ChevronDown size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
            zIndex: 3000,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by code, name or country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '8px 12px 8px 32px',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                background: '#f8fafc',
              }}
            />
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No currency matches “{search}”
              </div>
            )}
            {filtered.map((c) => {
              const active = c.code === value;
              return (
                <div
                  key={c.code}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    setSearch('');
                  }}
                  style={{
                    padding: '9px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    background: active ? '#eff6ff' : 'transparent',
                    borderLeft: `3px solid ${active ? '#2563eb' : 'transparent'}`,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{c.flag}</span>
                  <span style={{ fontWeight: 600, minWidth: 42, color: '#0f172a' }}>{c.code}</span>
                  <span style={{ color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.label}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{c.symbol}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrencyPicker;
