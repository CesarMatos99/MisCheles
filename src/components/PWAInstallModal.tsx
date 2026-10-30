import React from 'react';
import { X, Smartphone, Download, Share, PlusSquare, CheckCircle, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Instalar en tu Celular (APK / PWA)</h2>
              <p className="text-xs text-emerald-100">MisCheles App Móvil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>
              Esta aplicación está optimizada para funcionar como una <strong>APK nativa</strong> en Android y celular: pantalla completa, autenticación biométrica y funcionamiento sin internet.
            </span>
          </div>

          {/* If browser supports direct install prompt */}
          {isInstallable && (
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Tu navegador permite instalar la aplicación directamente con un toque:
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Instalar Aplicación en Celular</span>
              </button>
            </div>
          )}

          {/* Manual Android Instructions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              En Android (Google Chrome / Brave / Edge):
            </h4>
            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-4">
              <li>Abre el menú de opciones (los <strong>tres puntos verticales ⋮</strong> en la esquina superior derecha).</li>
              <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</li>
              <li>¡Listo! Se creará el acceso directo con icono APK en el menú de aplicaciones de tu móvil.</li>
            </ol>
          </div>

          {/* iOS Safari Instructions */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              En iPhone / iPad (Safari):
            </h4>
            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-4">
              <li className="flex items-center gap-1.5">
                <span>1. Toca el botón <strong>Compartir</strong></span>
                <Share className="w-3.5 h-3.5 inline text-blue-500" />
                <span>en la barra inferior.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span>2. Desplaza hacia abajo y selecciona <strong>"Agregar al inicio"</strong></span>
                <PlusSquare className="w-3.5 h-3.5 inline text-emerald-500" />
              </li>
              <li>3. Toca <strong>Agregar</strong> en la esquina superior.</li>
            </ol>
          </div>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
