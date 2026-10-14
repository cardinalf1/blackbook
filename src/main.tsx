import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import App from './App.tsx';
import { initApiAuth } from './services/api/client';
import './index.css';

// Swap the one-time ?token= for a session cookie and remove it from the address bar right away.
void initApiAuth().catch(() => undefined);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
