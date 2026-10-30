export const biometricService = {
  // Check if biometric credential authentication is available on device
  async isBiometricAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      if (
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
      ) {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch {
      return false;
    }
    return false;
  },

  // Perform biometric verification
  async verifyBiometric(): Promise<boolean> {
    try {
      if (!window.PublicKeyCredential) {
        return false;
      }
      
      // Attempt WebAuthn assertion challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Simple credential verification call
      const options: CredentialRequestOptions = {
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'preferred',
          rpId: window.location.hostname || 'localhost',
        },
      };

      const assertion = await navigator.credentials.get(options);
      return !!assertion;
    } catch (err: unknown) {
      // If WebAuthn fails due to iframe sandbox or not configured, return false so user can use PIN or biometric simulated fallback
      console.warn('Biometric API notice:', err);
      return false;
    }
  },

  // Validate user PIN
  verifyPin(inputPin: string, storedPin: string): boolean {
    return inputPin.trim() === storedPin.trim();
  },
};
