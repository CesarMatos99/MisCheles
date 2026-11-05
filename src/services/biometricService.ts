import { localLockCredential } from './localLockCredential';

/** Web lock is a local privacy screen; account access remains controlled by authentication and Firestore rules. */
export const biometricService = {
  async verifyPin(inputPin: string): Promise<boolean> { return localLockCredential.verifyPin(inputPin); },
  async isBiometricAvailable(): Promise<boolean> { return false; },
  async verifyBiometric(): Promise<boolean> { return false; },
};
