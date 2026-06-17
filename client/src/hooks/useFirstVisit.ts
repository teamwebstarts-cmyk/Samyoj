import { useEffect, useState } from 'react';

export function useFirstVisit(key: string): [boolean, () => void] {
  const storageKey = `wa-hint-dismissed:${key}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(storageKey));
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return [visible, dismiss];
}
