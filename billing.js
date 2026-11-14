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
//
// Nothing unlocks Premium on the strength of the payment sheet's word alone: what
// the page acts on is the list Play itself answers with for the account that paid
// (`listPurchases()`). That is also what catches a subscription that lapsed, was
// cancelled or refunded — the app follows the store down as well as up.

import {
  activate,
  cancel as deactivate,
  isPlayBuild,
  premiumState,
  saveStorePrices,
} from './premium.js';

const SKU = {
  monthly: 'premium_monthly',
  yearly: 'premium_yearly',
};

const DIGITAL_GOODS = 'https://play.google.com/billing';
const MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

// Optional second check, a small Cloudflare Worker that asks Google's Play
// Developer API about the token:
//   POST { token, sku } -> { ok: true }
// It stays empty for now: Play's own list is the check. A tampered page is the
// only thing a server would add, and it can be switched on later without the app
// changing anywhere else.
const VERIFY_URL = '';

function bridge() {
  const api = window.BayyinBilling;
  return api && typeof api.purchase === 'function' ? api : null;
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

/**
 * Ask a server about a purchase token, when one is configured. Without a server
 * Play's own list is the check, so a token Play handed out counts.
 */
async function verified(token, sku) {
  if (!VERIFY_URL) return Boolean(token);
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

// `isPlayBuild()` remembers the TWA once it has been seen. The referrer can be
// lost on a later navigation inside the app, and without this the paywall then
// told a Play-installed app that subscriptions were not available at all.
export function available() {
  return Boolean(bridge()) || isPlayBuild();
}

export function manageAvailable() {
  return available();
}

/** { currency, value, amount } from a Digital Goods item, or null. */
function priceRecord(item) {
  const price = item && item.price;
  if (!price) return null;
  const currency = String(price.currency || '').toUpperCase();
  const value = String(price.value === undefined || price.value === null ? '' : price.value);
  const amount = Number(value);
  if (!currency || !isFinite(amount) || amount <= 0) return null;
  return { currency, value, amount };
}

/** Keep the prices Play quoted, so the paywall shows what it will charge. */
function rememberPrices(items) {
  const map = {};
  for (const item of items || []) {
    const sku = foundSku(item && item.itemId);
    const record = priceRecord(item);
    if (!record) continue;
    if (sku === SKU.monthly) map.monthly = record;
    else if (sku === SKU.yearly) map.yearly = record;
  }
  saveStorePrices(map);
}

async function details(service) {
  try {
    const list = await service.getDetails([SKU.monthly, SKU.yearly]);
    const items = Array.isArray(list) ? list : [];
    rememberPrices(items);
    return items;
  } catch (error) {
    return [];
  }
}

/** Read Play's own prices for both plans (they are cached for the paywall). */
export async function refreshPrices() {
  const service = await goods();
  if (!service) return false;
  return (await details(service)).length > 0;
}

async function purchases(service) {
  try {
    const list = await service.listPurchases();
    return { ok: true, items: Array.isArray(list) ? list : [] };
  } catch (error) {
    return { ok: false, items: [] };
  }
}

/** The purchase to act on: the plan asked for first, then any of the two. */
function pick(items, sku) {
  const wanted = [sku, SKU.monthly, SKU.yearly];
  for (const id of wanted) {
    if (!id) continue;
    const found = (items || []).find((item) => foundSku(item && item.itemId) === id);
    if (found) return found;
  }
  return null;
}

function planOf(item) {
  return foundSku(item && item.itemId) === SKU.yearly ? 'yearly' : 'monthly';
}

async function acknowledge(service, token) {
  if (!token) return;
  try {
    await service.acknowledge(token, 'repeatable');
  } catch (error) {
    /* already acknowledged: Play will not refund */
  }
}

/**
 * Turn what Play reports into the app's state. The store's list is the check: a
 * purchase unlocks Premium only when Play names it for this account; a token
 * Play's payment sheet handed back is accepted when the list has not caught up
 * yet, since it is Play's own receipt for the same purchase.
 */
async function settle(service, sku, token) {
  const list = await purchases(service);
  const found = list.ok ? pick(list.items, sku) : null;
  const receipt = found ? found.purchaseToken : token;

  if (!receipt) return { ok: false, reason: list.ok ? 'none' : 'error' };
  if (!(await verified(receipt, found ? found.itemId : sku))) {
    return { ok: false, reason: 'unverified' };
  }

  await acknowledge(service, receipt);
  const plan = found ? planOf(found) : sku === SKU.yearly ? 'yearly' : 'monthly';
  activate(plan);
  return { ok: true, plan };
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

  const items = await details(service);
  const item = items.find((entry) => foundSku(entry && entry.itemId) === sku);
  if (!item) return { ok: false, reason: 'unavailable' };

  const total = priceRecord(item);
  if (!total) return { ok: false, reason: 'unavailable' };
  if (typeof PaymentRequest !== 'function') return { ok: false, reason: 'unavailable' };

  let token = '';
  try {
    const request = new PaymentRequest(
      [{ supportedMethods: DIGITAL_GOODS, data: { sku } }],
      {
        total: {
          label: item.title || 'Bayyin Premium',
          amount: { currency: total.currency, value: total.value },
        },
      }
    );
    const response = await request.show();
    token =
      response && response.details && response.details.purchaseToken
        ? String(response.details.purchaseToken)
        : '';
    try {
      await response.complete('success');
    } catch (error) {
      /* already completed */
    }
  } catch (error) {
    if (error && error.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: (error && error.message) || 'error' };
  }

  return settle(service, sku, token);
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

  // Prices as Play has them now, even for someone who never bought anything.
  await details(service);

  const list = await purchases(service);
  if (!list.ok) return { ok: false, reason: 'error' };

  const found = pick(list.items, '');
  if (found) {
    if (!(await verified(found.purchaseToken, found.itemId))) {
      return { ok: false, reason: 'unverified' };
    }
    await acknowledge(service, found.purchaseToken);
    const plan = planOf(found);
    activate(plan);
    return { ok: true, plan };
  }

  // Play answers for the account that paid: nothing listed means the
  // subscription lapsed, was cancelled or refunded, so Premium follows it down.
  // A gift runs on its own clock and `cancel()` leaves it alone.
  const state = premiumState();
  if (state.planId && state.planId !== 'gift') deactivate();

  return { ok: false, reason: 'none' };
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
  try {
    window.open(MANAGE_URL, '_blank');
    return true;
  } catch (error) {
    return false;
  }
}
