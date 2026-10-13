import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSupportDrawer } from '../contexts/SupportDrawerContext';

/** Legacy /help bookmarks open the right drawer, not a full page. */
export default function HelpDrawerRedirect() {
  const { openSupport } = useSupportDrawer();

  useEffect(() => {
    openSupport();
  }, [openSupport]);

  return <Navigate to="/" replace />;
}
