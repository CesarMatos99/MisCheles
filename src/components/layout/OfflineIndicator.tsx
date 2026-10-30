import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-amber-600/90 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-white shadow-xl animate-bounce">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Modo sin conexión — Tus datos se guardan localmente en el móvil</span>
    </div>
  );
};
