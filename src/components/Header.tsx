import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Lock,
  Download,
  Smartphone,
  User,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { MONTH_NAMES_ES } from '../constants/categories';
import { UserProfile } from '../types';

interface HeaderProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLockApp: () => void;
  onOpenProfile: () => void;
  onOpenMonthSetup: () => void;
  onOpenInstallModal: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({
  year,
  month,
  onMonthChange,
  isDarkMode,
  onToggleTheme,
  onLockApp,
  onOpenProfile,
  onOpenMonthSetup,
  onOpenInstallModal,
  profile,
}) => {
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const handlePrevMonth = () => {
    let nextMonth = month - 1;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    onMonthChange(nextYear, nextMonth);
  };

  const handleNextMonth = () => {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    onMonthChange(nextYear, nextMonth);
  };

  const availableYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Profile */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 p-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition group text-left"
            title="Ver Perfil y Configuración"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm border border-emerald-500/20">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <span>{profile.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="hidden sm:block">
              <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight">
                {profile.name}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> MisCheles
              </span>
            </div>
          </button>
        </div>

        {/* Center: Month & Year Selector */}
        <div className="relative">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-2xl p-1 shadow-inner border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              <span>{MONTH_NAMES_ES[month - 1]} {year}</span>
            </button>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Popover Month/Year Dropdown Picker */}
          {showDatePicker && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Seleccionar Período
                </span>
                <select
                  value={year}
                  onChange={(e) => onMonthChange(Number(e.target.value), month)}
                  className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES_ES.map((name, idx) => {
                  const mIndex = idx + 1;
                  const isCurrent = mIndex === month;
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        onMonthChange(year, mIndex);
                        setShowDatePicker(false);
                      }}
                      className={`py-2 px-1 text-xs font-semibold rounded-xl transition ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                <button
                  onClick={() => {
                    const now = new Date();
                    onMonthChange(now.getFullYear(), now.getMonth() + 1);
                    setShowDatePicker(false);
                  }}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Mes Actual
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Tools: Configure Month, Install APK, Theme, Lock */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Configure Month Setup button */}
          <button
            onClick={onOpenMonthSetup}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            title="Configurar Cobro y Presupuesto del Mes"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-500" />
            <span>Presupuesto Mes</span>
          </button>

          {/* Install APK / PWA button */}
          <button
            onClick={onOpenInstallModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300/50 dark:border-emerald-800/50 transition active:scale-95"
            title="Instalar en Celular (APK)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Instalar Celular</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Lock App (Biometric/PIN) */}
          <button
            onClick={onLockApp}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition"
            title="Bloquear Aplicación"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
