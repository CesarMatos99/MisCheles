import { firebaseAuthAdapter } from './firebaseAuthAdapter';
import { createAccountAuthService } from './accountAuthService';

export { createAccountAuthService } from './accountAuthService';
export const accountAuth = createAccountAuthService(firebaseAuthAdapter);
