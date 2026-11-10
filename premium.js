// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved.
// Premium system: the trial timeline, the free limits, the plans and the prices
// shown for the region the app is opened in.
//
// Everything is stored on the device (no server). When Google Play Billing is
// connected, `activate(planId)` is the one call a verified purchase makes; a
// store's "restore" asks Play and calls `setPremium(true)` when it finds one.

export const PAYWALL_ON = true;

// First days are a full Premium trial, then the everyday free limits.
export const TRIAL_DAYS = 3;
export const FREE_CHECKS_PER_DAY = 3;

const KEY = 'tc.premium';
const SINCE = 'tc.premiumSince';
const EXPIRES = 'tc.premiumExpires';
const PLAN_KEY = 'tc.premiumPlan';
const CHECKS = 'tc.premiumChecks';

export const PLANS = {
  monthly: { id: 'monthly', sku: 'bayyin_pro_monthly', days: 30 },
  yearly: { id: 'yearly', sku: 'bayyin_pro_yearly', days: 365 },
};

// Two price points: the ₹99 tier (India, Pakistan, Bangladesh, Nepal and Sri
// Lanka in their own currency, about the same as ₹99) and $3.33 everywhere else.
// The amounts below are the ₹99 (and ₹799) tier written in local currency; Play
// itself shows the exact price on its own payment sheet.
const PRICES = {
  IN: { currency: 'INR', locale: 'en-IN', monthly: 99, yearly: 799 },
  PK: { currency: 'PKR', locale: 'en-PK', monthly: 330, yearly: 2640 },
  BD: { currency: 'BDT', locale: 'en-BD', monthly: 140, yearly: 1120 },
  NP: { currency: 'NPR', locale: 'en-NP', monthly: 160, yearly: 1280 },
  LK: { currency: 'LKR', locale: 'en-LK', monthly: 340, yearly: 2720 },
  US: { currency: 'USD', locale: 'en-US', monthly: 3.33, yearly: 29.99 },
};

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    /* private mode */
  }
}

function todayKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// Time zone first: a phone set to "English (US)" but used in India should still
// see rupees, and the time zone follows where the phone actually is.
const ZONES = [
  [/Calcutta|Kolkata/i, 'IN'],
  [/Karachi/i, 'PK'],
  [/Dhaka/i, 'BD'],
  [/Kathmandu/i, 'NP'],
  [/Colombo/i, 'LK'],
];

/** The region the app is opened in, from the phone's time zone and language. */
export function region() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    for (const [pattern, code] of ZONES) {
      if (pattern.test(tz)) return code;
    }
    const lang = navigator.language || '';
    const match = lang.toUpperCase().match(/-([A-Z]{2})$/);
    if (match) return match[1];
  } catch (error) {
    /* fall through to the default */
  }
  return 'US';
}

/** "India" for "IN"; empty when the country has no entry of its own. */
export function regionName(code) {
  if (!PRICES[code]) return '';
  try {
    const name = new Intl.DisplayNames([PRICES[code].locale], { type: 'region' }).of(code);
    if (name) return name;
  } catch (error) {
    /* older browser: show the code */
  }
  return code;
}

function money(amount, info) {
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return `${info.currency} ${amount}`;
  }
}

/** Local price of a plan for the region, e.g. "₹99" or "$3.33". */
export function priceFor(planId) {
  const code = region();
  const info = PRICES[code] || PRICES.US;
  const amount = info[planId];
  return { region: code, currency: info.currency, amount, label: money(amount, info) };
}

export function allPrices() {
  return {
    region: region(),
    monthly: priceFor('monthly'),
    yearly: priceFor('yearly'),
  };
}

function store() {
  let since = Number(read(SINCE, 0)) || 0;
  if (!since) {
    since = Date.now();
    write(SINCE, since);
  }
  let checks = { day: todayKey(), count: 0 };
  try {
    const raw = JSON.parse(read(CHECKS, 'null'));
    if (raw && raw.day === todayKey() && typeof raw.count === 'number') checks = raw;
  } catch (error) {
    checks = { day: todayKey(), count: 0 };
  }
  return {
    paid: read(KEY, '0') === '1',
    planId: read(PLAN_KEY, '') || null,
    expires: Number(read(EXPIRES, 0)) || 0,
    since,
    checks,
  };
}

/** Everything the UI and the gates need. */
export function premiumState() {
  const data = store();
  const active = data.paid && (!data.expires || data.expires > Date.now());
  const days = Math.floor((Date.now() - data.since) / 86400000);
  const trial = !active && days < TRIAL_DAYS;
  const daysLeft = Math.max(0, TRIAL_DAYS - days);
  const limit = active || trial ? Infinity : FREE_CHECKS_PER_DAY;
  const used = data.checks.count;
  return {
    on: PAYWALL_ON,
    paid: active,
    trial,
    premium: !PAYWALL_ON || active || trial,
    phase: !PAYWALL_ON ? 'open' : active ? 'paid' : trial ? 'trial' : 'free',
    trialDaysLeft: daysLeft,
    expires: data.expires,
    planId: data.planId,
    limit,
    used,
    remaining: limit === Infinity ? Infinity : Math.max(0, limit - used),
    prices: allPrices(),
  };
}

/** The one gate the whole app uses. */
export function isPremium() {
  if (!PAYWALL_ON) return true;
  return premiumState().premium;
}

/** Called after a verified store purchase (or from the demo buttons). */
export function activate(planId) {
  const plan = PLANS[planId];
  if (!plan) return premiumState();
  write(KEY, '1');
  write(PLAN_KEY, plan.id);
  write(EXPIRES, Date.now() + plan.days * 86400000);
  return premiumState();
}

export function setPremium(on) {
  write(KEY, on ? '1' : '0');
  if (!on) write(EXPIRES, 0);
  return premiumState();
}

export function cancel() {
  write(KEY, '0');
  write(EXPIRES, 0);
  write(PLAN_KEY, '');
  return premiumState();
}

/** Testing helper: start the 3-day trial again and drop any purchase. */
export function resetDemo() {
  write(KEY, '0');
  write(EXPIRES, 0);
  write(PLAN_KEY, '');
  write(SINCE, Date.now());
  write(CHECKS, JSON.stringify({ day: todayKey(), count: 0 }));
  return premiumState();
}

/** Testing helper: pretend the trial started a few days ago. */
export function skipTrial(days = 4) {
  const since = Number(read(SINCE, 0)) || Date.now();
  write(SINCE, since - days * 86400000);
  return premiumState();
}

export function canCheck() {
  const info = premiumState();
  return info.premium || info.remaining > 0;
}

/** Count a finished recitation check against the free allowance. */
export function recordCheck() {
  const info = premiumState();
  if (info.premium) return;
  const data = store();
  const next = { day: todayKey(), count: data.checks.count + 1 };
  write(CHECKS, JSON.stringify(next));
}
