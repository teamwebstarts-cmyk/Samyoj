import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wa-platform-sidebar-collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);

  return { collapsed, setCollapsed, toggle };
}
