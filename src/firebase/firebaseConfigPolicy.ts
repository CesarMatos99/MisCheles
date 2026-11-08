export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
}

export function hasFirebaseWebConfig(config: FirebaseWebConfig, usingEmulators = false): boolean {
  return Boolean(
    config.apiKey.trim()
    && config.authDomain.trim()
    && config.projectId.trim()
    && config.appId.trim()
    && config.messagingSenderId.trim()
    && (usingEmulators || config.projectId.trim() !== 'demo-mischeles'),
  );
}
