import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const SidebarContext = createContext({ open: false, setOpen: () => {}, toggle: () => {}, close: () => {} });

export const SidebarProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle, close }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
