export interface WebAppCheckPolicyInput {
  enabled: boolean;
  productionBuild: boolean;
  usingEmulators: boolean;
  siteKey: string;
}

/** Require explicit production intent, a registered site key, and non-emulator Firebase. */
export function shouldEnableWebAppCheck(input: WebAppCheckPolicyInput): boolean {
  return input.enabled && input.productionBuild && !input.usingEmulators && input.siteKey.trim().length > 0;
}
