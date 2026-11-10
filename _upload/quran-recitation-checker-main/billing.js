// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Play Billing adapter.
//
// A browser cannot charge money. When Bayyin is shipped on Play Store it runs
// inside a Trusted Web Activity / Capacitor shell that exposes one small bridge:
//
//   window.BayyinBilling = {
//     purchase(sku)  -> Promise<{ ok, token?, error? }>
//     restore()      -> Promise<{ ok, sku?, token? }>
//     manage()       -> opens Play's subscription management screen
//   }
//
// The native side must verify the token with Play Developer API / RTDN and only
// then answer ok. Until that bridge exists (plain web / preview), available()
// is false and the paywall says subscriptions are only sold in the Play app.

import { activate } from './premium.js';

const SKU = {
  monthly: 'bayyin_pro_monthly',
  yearly: 'bayyin_pro_yearly',
};

function bridge() {
  const api = window.BayyinBilling;
  return api && typeof api.purchase === 'function' ? api : null;
}

export function available() {
  return Boolean(bridge());
}

export function manageAvailable() {
  const api = bridge();
  return Boolean(api && typeof api.manage === 'function');
}

export async function buy(planId) {
  const api = bridge();
  if (!api) return { ok: false, reason: 'unavailable' };
  const sku = SKU[planId];
  if (!sku) return { ok: false, reason: 'unavailable' };

  try {
    const result = await api.purchase(sku);
    if (result && result.ok) {
      activate(planId);
      return { ok: true, plan: planId };
    }
    return { ok: false, reason: (result && result.error) || 'cancelled' };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : 'error' };
  }
}

export async function restore() {
  const api = bridge();
  if (!api || typeof api.restore !== 'function') return { ok: false, reason: 'unavailable' };
  try {
    const result = await api.restore();
    if (result && result.ok && result.sku) {
      const plan = String(result.sku).includes('yearly') ? 'yearly' : 'monthly';
      activate(plan);
      return { ok: true, plan };
    }
    return { ok: false, reason: 'none' };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : 'error' };
  }
}

export function manage() {
  const api = bridge();
  if (!api || typeof api.manage !== 'function') return false;
  try {
    api.manage();
    return true;
  } catch (error) {
    return false;
  }
}
