// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved.
// Premium switch. While PAYWALL_ON is false every feature is open (testing).
// When Google Play Billing is connected, set PAYWALL_ON = true and call
// setPremium(true) after a verified purchase.
export const PAYWALL_ON = false;

export function isPremium() {
  if (!PAYWALL_ON) return true;
  try {
    return localStorage.getItem('tc.premium') === '1';
  } catch (error) {
    return false;
  }
}

export function setPremium(on) {
  try {
    localStorage.setItem('tc.premium', on ? '1' : '0');
  } catch (error) {
    /* ignore */
  }
}
