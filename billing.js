// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Play Billing adapter.
//
// A Play-installed build can charge in two ways:
//  1. A native shell (Capacitor) that exposes `window.BayyinBilling`.
//  2. A Trusted Web Activity — the PWABuilder package. A TWA may not ship a native
//     bridge, so Chrome gives the page the Digital Goods API + Payment Request;
//     that is the only billing Play allows inside a TWA.
// A plain browser has neither, so `available()` is false there and the paywall says
// subscriptions are sold in the Play app.

import { activate } from './premium.js';

const SKU = {
  monthly: 'premium_monthly',
  yearly: 'premium_yearly',
};

const DIGITAL_GOODS = 'https://play.google.com/billing';
const MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

// Verification endpoint (a small Cloudflare Worker is enough):
//   POST { token, sku } -> { ok: true }
// Set this before a public release: a purchase must never unlock Premium from a
// token the server has not checked.
const VERIFY_URL = '';

function bridge() {
  const api = window.BayyinBilling;
  return api && typeof api.purchase === 'function' ? api : null;
}

/** True when this page runs inside the Play-installed TWA (PWABuilder package). */
function twaBuild() {
  try {
    if (typeof window.getDigitalGoodsService !== 'function') return false;
    return /^android-app:\/\//i.test(document.referrer || '');
  } catch (error) {
    return false;
  }
}

let goodsService = null;

async function goods() {
  if (goodsService) return goodsService;
  if (typeof window.getDigitalGoodsService !== 'function') return null;
  try {
    goodsService = await window.getDigitalGoodsService(DIGITAL_GOODS);
  } catch (error) {
    goodsService = null;
  }
  return goodsService;
}

/** Ask the server about a purchase token. Without a server, testing only. */
async function verified(token, sku) {
  if (!VERIFY_URL) {
    console.warn('Bayyin: VERIFY_URL khali hai — purchase server se verify nahi hui.');
    return Boolean(token);
  }
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, sku }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data && data.ok);
  } catch (error) {
    return false;
  }
}

export function available() {
  return Boolean(bridge()) || twaBuild();
}

export function manageAvailable() {
  return available();
}

export async function buy(planId) {
  const sku = SKU[planId];
  if (!sku) return { ok: false, reason: 'unavailable' };

  const api = bridge();
  if (api) {
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

  const service = await goods();
  if (!service) return { ok: false, reason: 'unavailable' };

  try {
    const details = await service.getDetails([sku]);
    const item = details && details[0];
    if (!item || !item.price) return { ok: false, reason: 'unavailable' };

    const request = new PaymentRequest(
      [{ supportedMethods: DIGITAL_GOODS, data: { sku } }],
      {
        total: {
          label: item.title || 'Bayyin Premium',
          amount: { currency: item.price.currency, value: String(item.price.value) },
        },
      }
    );
    const response = await request.show();
    const token = response && response.details ? response.details.purchaseToken : '';
    try {
      await response.complete('success');
    } catch (error) {
      /* already completed */
    }
    if (!token) return { ok: false, reason: 'error' };

    if (!(await verified(token, sku))) return { ok: false, reason: 'unverified' };

    try {
      await service.acknowledge(token, 'repeatable');
    } catch (error) {
      /* already acknowledged: Play will not refund */
    }

    activate(planId);
    return { ok: true, plan: planId };
  } catch (error) {
    const reason =
      error && error.name === 'AbortError' ? 'cancelled' : (error && error.message) || 'error';
    return { ok: false, reason };
  }
}

export async function restore() {
  const api = bridge();
  if (api && typeof api.restore === 'function') {
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

  const service = await goods();
  if (!service) return { ok: false, reason: 'unavailable' };

  try {
    const list = await service.listPurchases();
    const found = (list || []).find((item) =>
      [SKU.monthly, SKU.yearly].includes(foundSku(item.itemId))
    );
    if (!found) return { ok: false, reason: 'none' };
    if (!(await verified(found.purchaseToken, found.itemId))) {
      return { ok: false, reason: 'unverified' };
    }
    const plan = foundSku(found.itemId) === SKU.yearly ? 'yearly' : 'monthly';
    activate(plan);
    return { ok: true, plan };
  } catch (error) {
    return { ok: false, reason: 'error' };
  }
}

/** A base plan id comes back as "premium_monthly" or "premium_monthly:monthly". */
function foundSku(itemId) {
  return String(itemId || '').split(':')[0];
}

export function manage() {
  const api = bridge();
  if (api && typeof api.manage === 'function') {
    try {
      api.manage();
      return true;
    } catch (error) {
      return false;
    }
  }
  if (twaBuild()) {
    try {
      window.open(MANAGE_URL, '_blank');
      return true;
    } catch (error) {
      return false;
    }
  }
  return false;
}
