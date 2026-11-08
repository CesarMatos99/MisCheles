export type AccountAuthLanguage = 'es' | 'en';

const messages = {
  es: {
    notConfigured: 'La autenticación no está configurada. Puedes seguir usando MisCheles sin cuenta.',
    invalidEmail: 'Escribe un correo electrónico válido.',
    credentials: 'No se pudo autenticar con esos datos. Revisa la información e inténtalo de nuevo.',
    passwordPolicy: 'La contraseña no cumple la política de seguridad configurada.',
    passwordConfirmation: 'Las contraseñas no coinciden.',
    invalidName: 'Escribe un nombre de hasta 80 caracteres.',
    providerConflict: 'No se pudo continuar con Google. Prueba el método de acceso que ya utilizabas; no se vincularon cuentas.',
    popupBlocked: 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.',
    cancelled: 'Se canceló el inicio de sesión.',
    network: 'No hay conexión con Firebase. Comprueba tu conexión e inténtalo de nuevo.',
    rateLimited: 'Se alcanzó el límite temporal de solicitudes. Espera un momento e inténtalo de nuevo.',
    recentLogin: 'Vuelve a iniciar sesión para confirmar esta acción sensible.',
    passwordRequired: 'Se requiere la contraseña actual de esta cuenta.',
    passwordProvider: 'Esta operación requiere una cuenta con contraseña.',
    deleteConfirmation: 'Escribe ELIMINAR para confirmar la eliminación.',
    verificationCooldown: 'Espera un minuto antes de solicitar otro correo de verificación.',
    alreadyVerified: 'El correo ya aparece verificado.',
    notVerifiedYet: 'El correo todavía no aparece verificado. Abre el enlace del mensaje y vuelve a comprobarlo.',
    generic: 'No se pudo completar la acción. Inténtalo de nuevo.',
  },
  en: {
    notConfigured: 'Authentication is not configured. You can keep using MisCheles without an account.',
    invalidEmail: 'Enter a valid email address.',
    credentials: 'Could not authenticate with those details. Check them and try again.',
    passwordPolicy: 'The password does not meet the configured security policy.',
    passwordConfirmation: 'The passwords do not match.',
    invalidName: 'Enter a name of up to 80 characters.',
    providerConflict: 'Could not continue with Google. Try the sign-in method you already use; accounts were not linked.',
    popupBlocked: 'The browser blocked the Google window. Allow popups and try again.',
    cancelled: 'Sign-in was cancelled.',
    network: 'Could not connect to Firebase. Check your connection and try again.',
    rateLimited: 'The temporary request limit was reached. Wait a moment and try again.',
    recentLogin: 'Sign in again to confirm this sensitive action.',
    passwordRequired: 'The current account password is required.',
    passwordProvider: 'This action requires an account with a password.',
    deleteConfirmation: 'Type DELETE to confirm account deletion.',
    verificationCooldown: 'Wait one minute before requesting another verification email.',
    alreadyVerified: 'The email is already marked as verified.',
    notVerifiedYet: 'The email is not verified yet. Open the link in your message and check again.',
    generic: 'Could not complete the action. Try again.',
  },
} as const;

type MessageKey = keyof typeof messages.es;

function errorCode(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message.includes('/')) return error.message;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'code' in error) return String((error as { code?: unknown }).code || '');
  return '';
}

export function accountAuthMessageKey(error: unknown): MessageKey {
  const code = errorCode(error);
  if (code === 'FIREBASE_NOT_CONFIGURED') return 'notConfigured';
  if (code === 'INVALID_EMAIL' || code.includes('auth/invalid-email')) return 'invalidEmail';
  if (code === 'PASSWORD_POLICY_INVALID' || code.includes('auth/weak-password') || code.includes('password-does-not-meet-requirements')) return 'passwordPolicy';
  if (code === 'PASSWORD_CONFIRMATION_MISMATCH') return 'passwordConfirmation';
  if (code === 'INVALID_NAME') return 'invalidName';
  if (code.includes('account-exists-with-different-credential') || code.includes('credential-already-in-use')) return 'providerConflict';
  if (code.includes('popup-blocked')) return 'popupBlocked';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'cancelled';
  if (code.includes('network-request-failed')) return 'network';
  if (code.includes('too-many-requests')) return 'rateLimited';
  if (code === 'RECENT_LOGIN_REQUIRED' || code.includes('requires-recent-login')) return 'recentLogin';
  if (code === 'CURRENT_PASSWORD_REQUIRED') return 'passwordRequired';
  if (code === 'PASSWORD_PROVIDER_REQUIRED') return 'passwordProvider';
  if (code === 'DELETE_CONFIRMATION_REQUIRED') return 'deleteConfirmation';
  if (code === 'VERIFICATION_RESEND_COOLDOWN') return 'verificationCooldown';
  if (code === 'EMAIL_ALREADY_VERIFIED') return 'alreadyVerified';
  if (code === 'EMAIL_NOT_VERIFIED') return 'notVerifiedYet';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('email-already-in-use') || code.includes('user-disabled')) return 'credentials';
  return 'generic';
}

export function accountAuthMessage(error: unknown, language: AccountAuthLanguage): string {
  return messages[language][accountAuthMessageKey(error)];
}
