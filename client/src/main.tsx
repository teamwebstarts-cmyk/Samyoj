import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupGlobalErrorHandlers } from './utils/errors';
import './index.css';

setupGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
