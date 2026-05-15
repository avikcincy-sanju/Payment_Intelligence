import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AssumptionsProvider } from './context/AssumptionsContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssumptionsProvider>
      <App />
    </AssumptionsProvider>
  </StrictMode>
);
