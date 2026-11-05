import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './i18n/LanguageContext';
import { AccountAuthProvider } from './firebase/AccountAuthProvider';
import { WebModeGate } from './onboarding/WebModeGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountAuthProvider><LanguageProvider><WebModeGate><App /></WebModeGate></LanguageProvider></AccountAuthProvider>
  </StrictMode>,
);
