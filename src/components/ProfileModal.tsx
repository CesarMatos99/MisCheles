import React, { useState, useRef } from 'react';
import {
  X,
  User,
  Camera,
  Shield,
  KeyRound,
  Fingerprint,
  CheckCircle2,
  DollarSign,
  Mail,
  Wallet,
  Check,
} from 'lucide-react';
import { UserProfile } from '../types';
import { storageService } from '../services/storage';
import { CURRENCY_OPTIONS } from '../constants/categories';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
}

const ACCENT_COLORS = [
  { name: 'Esmeralda', value: '#059669' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Violeta', value: '#7c3aed' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Naranja', value: '#ea580c' },
  { name: 'Turquesa', value: '#0f766e' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  accentColor,
  onAccentColorChange,
}) => {
  const [name, setName] = useState<string>(profile.name);
  const [email, setEmail] = useState<string>(profile.email);
  const [photoUrl, setPhotoUrl] = useState<string>(profile.photoUrl || '');
  const [currency, setCurrency] = useState<string>(profile.currency);
  const [pinCode, setPinCode] = useState<string>(profile.pinCode || '1234');
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(profile.biometricsEnabled);
  const [pinLockEnabled, setPinLockEnabled] = useState<boolean>(profile.pinLockEnabled);
  const [monthlyTargetIncome, setMonthlyTargetIncome] = useState<string>(
    profile.monthlyTargetIncome > 0 ? String(profile.monthlyTargetIncome) : '60000'
  );
  const [feedback, setFeedback] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      name: name.trim() || 'Usuario',
      email: email.trim(),
      photoUrl,
      currency,
      pinCode: pinCode.trim() || '1234',
      biometricsEnabled,
      pinLockEnabled,
      monthlyTargetIncome: parseFloat(monthlyTargetIncome) || 0,
    };

    storageService.saveProfile(updated);
    onProfileUpdated(updated);
    setFeedback('Perfil actualizado con éxito');
    setTimeout(() => {
      setFeedback('');
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Perfil y Seguridad</h2>
              <p className="text-xs text-emerald-100">Personalización y Bloqueo Biométrico</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {/* Avatar Photo Section */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-4 border-emerald-500/30 overflow-hidden shadow-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {name ? name.charAt(0).toUpperCase() : 'U'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 text-white shadow hover:bg-emerald-700 transition active:scale-95"
                title="Subir foto desde el celular o computadora"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Toca la cámara para subir tu foto de perfil
            </p>
          </div>

          {/* Name & Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. César Matos"
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cesarmatos99@gmail.com"
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Currency and Target Income */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Cobro Base Mes
              </label>
              <input
                type="number"
                min="0"
                value={monthlyTargetIncome}
                onChange={(e) => setMonthlyTargetIncome(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <section className="py-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Color de la aplicación</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Elige el color principal. Se mantiene en modo claro y oscuro.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {ACCENT_COLORS.map((color) => {
                const selected = accentColor.toLowerCase() === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={`Usar color ${color.name}`}
                    aria-pressed={selected}
                    title={color.name}
                    onClick={() => onAccentColorChange(color.value)}
                    className="flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:ring-offset-slate-900"
                    style={{ backgroundColor: color.value, outline: selected ? `3px solid ${color.value}` : undefined }}
                  >
                    {selected && <Check className="h-5 w-5 text-white" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Security & Biometrics Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Seguridad y Autenticación</span>
            </div>

            {/* Biometrics Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Desbloqueo Biométrico
                  </p>
                  <p className="text-[10px] text-slate-500">Usa huella dactilar o Face ID al abrir la app</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={biometricsEnabled}
                  onChange={(e) => setBiometricsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* PIN Code Setup */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    PIN de Respaldo (4 dígitos)
                  </p>
                  <p className="text-[10px] text-slate-500">Código numérico para acceder a la app</p>
                </div>
              </div>
              <input
                type="password"
                maxLength={4}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                className="w-16 text-center tracking-widest font-mono text-sm py-1 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {feedback && (
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar Perfil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
