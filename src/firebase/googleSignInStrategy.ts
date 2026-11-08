export function googleSignInStrategy(viewportWidth: number): 'redirect' | 'popup' {
  return viewportWidth <= 767 ? 'redirect' : 'popup';
}
