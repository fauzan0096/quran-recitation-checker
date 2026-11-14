// © 2026 F A FS — Bayyin (بيّن). All rights reserved.
// Premium system: the trial timeline, the free limits, the plans and the prices
// shown for the region the app is opened in.
//
// Everything is stored on the device (no server). When Google Play Billing is
// connected, `activate(planId)` is the one call a verified purchase makes; a
// store's "restore" asks Play and calls `setPremium(true)` when it finds one.
//
// A gift code (see gift.js) is the third way: the owner, and the people the owner
// chooses, get Premium without a purchase.

import { giftState } from './gift.js';

export const PAYWALL_ON = true;

// A Play build can be either a native shell that exposes `window.BayyinBilling`
// or the Play-installed TWA (the PWABuilder package). A TWA has no native bridge:
// Chrome gives the page the Digital Goods API and an `android-app://` referrer
// instead, which is how billing.js spots it too. The in-app trial must stay off on
// both, because on Play the trial is Play's own free-trial offer.
//
// Once the app has seen itself in a Play build, that is remembered: inside a TWA a
// later page (…/?demo=1, say) loads with an ordinary referrer, and the demo switches
// must not come back for that reason.
const PLAY_FLAG = 'tc.playBuild';

export function isPlayBuild() {
  try {
    if (read(PLAY_FLAG, '0') === '1') return true;
    let play = false;
    if (window.BayyinBilling) play = true;
    else if (
      typeof window.getDigitalGoodsService === 'function' &&
      /^android-app:\/\//i.test(document.referrer || '')
    ) {
      play = true;
    }
    if (play) write(PLAY_FLAG, '1');
    return play;
  } catch (error) {
    return false;
  }
}

// Demo switches ("Premium chalu karein", "Trial khatam") are for testing only.
// They appear with ?demo=1 in the URL, and never on a Play build: there a
// purchase must come from Play Billing (see billing.js).
export const DEMO_UI = (() => {
  try {
    if (isPlayBuild()) return false;
    return new URLSearchParams(window.location.search).has('demo');
  } catch (error) {
    return false;
  }
})();

// First days are a full Premium trial, then the everyday free limits.
export const TRIAL_DAYS = 3;
export const FREE_CHECKS_PER_DAY = 3;

const KEY = 'tc.premium';
const SINCE = 'tc.premiumSince';
const EXPIRES = 'tc.premiumExpires';
const PLAN_KEY = 'tc.premiumPlan';
const CHECKS = 'tc.premiumChecks';

export const PLANS = {
  monthly: { id: 'monthly', sku: 'bayyin_premium', days: 30 },
  yearly: { id: 'yearly', sku: 'premium_yearly', days: 365 },
};

// Two price points. The South Asian row is the ₹99 tier, set by hand in Play
// Console. Everywhere else the $3.33 / $29.99 tier is converted into the money of
// the country the phone is in, so nobody is shown dollars in a country that does
// not use them. Play's own payment sheet always shows the exact price it charges.
const SOUTH_ASIA = {
  IN: { currency: 'INR', monthly: 99, yearly: 799 },
  PK: { currency: 'PKR', monthly: 330, yearly: 2640 },
  BD: { currency: 'BDT', monthly: 140, yearly: 1120 },
  NP: { currency: 'NPR', monthly: 160, yearly: 1280 },
  LK: { currency: 'LKR', monthly: 340, yearly: 2720 },
};

const BASE = { currency: 'USD', monthly: 3.33, yearly: 29.99 };

// Country → currency (ISO 4217), so the paywall speaks the money of the place.
const COUNTRY_CURRENCY = {
  AE: 'AED', AF: 'AFN', AG: 'XCD', AI: 'XCD', AL: 'ALL', AM: 'AMD', AO: 'AOA', AR: 'ARS',
  AS: 'USD', AT: 'EUR', AU: 'AUD', AW: 'AWG', AZ: 'AZN',
  BA: 'BAM', BB: 'BBD', BD: 'BDT', BE: 'EUR', BF: 'XOF', BG: 'BGN', BH: 'BHD', BI: 'BIF',
  BJ: 'XOF', BM: 'BMD', BN: 'BND', BO: 'BOB', BQ: 'USD', BR: 'BRL', BS: 'BSD', BT: 'BTN',
  BW: 'BWP', BY: 'BYN', BZ: 'BZD',
  CA: 'CAD', CC: 'AUD', CD: 'CDF', CF: 'XAF', CG: 'XAF', CH: 'CHF', CI: 'XOF', CK: 'NZD',
  CL: 'CLP', CM: 'XAF', CN: 'CNY', CO: 'COP', CR: 'CRC', CU: 'CUP', CV: 'CVE', CW: 'ANG',
  CX: 'AUD', CY: 'EUR', CZ: 'CZK',
  DE: 'EUR', DJ: 'DJF', DK: 'DKK', DM: 'XCD', DO: 'DOP', DZ: 'DZD',
  EC: 'USD', EE: 'EUR', EG: 'EGP', ER: 'ERN', ES: 'EUR', ET: 'ETB',
  FI: 'EUR', FJ: 'FJD', FK: 'FKP', FM: 'USD', FO: 'DKK', FR: 'EUR',
  GA: 'XAF', GB: 'GBP', GD: 'XCD', GE: 'GEL', GG: 'GBP', GH: 'GHS', GI: 'GBP', GL: 'DKK',
  GM: 'GMD', GN: 'GNF', GQ: 'XAF', GR: 'EUR', GT: 'GTQ', GU: 'USD', GW: 'XOF', GY: 'GYD',
  HK: 'HKD', HN: 'HNL', HR: 'EUR', HT: 'HTG', HU: 'HUF',
  ID: 'IDR', IE: 'EUR', IL: 'ILS', IM: 'GBP', IN: 'INR', IQ: 'IQD', IR: 'IRR', IS: 'ISK',
  IT: 'EUR',
  JE: 'GBP', JM: 'JMD', JO: 'JOD', JP: 'JPY',
  KE: 'KES', KG: 'KGS', KH: 'KHR', KI: 'AUD', KM: 'KMF', KN: 'XCD', KP: 'KPW', KR: 'KRW',
  KW: 'KWD', KY: 'KYD', KZ: 'KZT',
  LA: 'LAK', LB: 'LBP', LC: 'XCD', LI: 'CHF', LK: 'LKR', LR: 'LRD', LS: 'LSL', LT: 'EUR',
  LU: 'EUR', LV: 'EUR', LY: 'LYD',
  MA: 'MAD', MC: 'EUR', MD: 'MDL', ME: 'EUR', MG: 'MGA', MH: 'USD', MK: 'MKD', ML: 'XOF',
  MM: 'MMK', MN: 'MNT', MO: 'MOP', MP: 'USD', MR: 'MRU', MS: 'XCD', MT: 'EUR', MU: 'MUR',
  MV: 'MVR', MW: 'MWK', MX: 'MXN', MY: 'MYR', MZ: 'MZN',
  NA: 'NAD', NC: 'XPF', NE: 'XOF', NF: 'AUD', NG: 'NGN', NI: 'NIO', NL: 'EUR', NO: 'NOK',
  NP: 'NPR', NR: 'AUD', NU: 'NZD', NZ: 'NZD',
  OM: 'OMR',
  PA: 'PAB', PE: 'PEN', PF: 'XPF', PG: 'PGK', PH: 'PHP', PK: 'PKR', PL: 'PLN', PN: 'NZD',
  PR: 'USD', PS: 'ILS', PT: 'EUR', PW: 'USD', PY: 'PYG',
  QA: 'QAR',
  RO: 'RON', RS: 'RSD', RU: 'RUB', RW: 'RWF',
  SA: 'SAR', SB: 'SBD', SD: 'SDG', SE: 'SEK', SG: 'SGD', SH: 'SHP', SI: 'EUR', SK: 'EUR',
  SL: 'SLE', SM: 'EUR', SN: 'XOF', SO: 'SOS', SR: 'SRD', SS: 'SSP', ST: 'STN', SV: 'USD',
  SY: 'SYP', SZ: 'SZL',
  TC: 'USD', TD: 'XAF', TG: 'XOF', TH: 'THB', TJ: 'TJS', TK: 'NZD', TL: 'USD', TM: 'TMT',
  TN: 'TND', TO: 'TOP', TR: 'TRY', TT: 'TTD', TV: 'AUD', TW: 'TWD', TZ: 'TZS',
  UA: 'UAH', UG: 'UGX', US: 'USD', UY: 'UYU', UZ: 'UZS',
  VA: 'EUR', VC: 'XCD', VE: 'VES', VG: 'USD', VI: 'USD', VN: 'VND', VU: 'VUV',
  WF: 'XPF', WS: 'WST',
  XK: 'EUR',
  YE: 'YER',
  ZA: 'ZAR', ZM: 'ZMW', ZW: 'USD',
};

// About how many units one US dollar buys — only used to write the amount in the
// local money. Rounded on purpose: the real price is the one Play charges.
const RATES = {
  AED: 3.67, AFN: 70, ALL: 92, AMD: 390, ANG: 1.79, AOA: 900, ARS: 950, AUD: 1.52,
  AWG: 1.79, AZN: 1.7, BAM: 1.8, BBD: 2, BDT: 120, BGN: 1.8, BHD: 0.376, BIF: 2900,
  BMD: 1, BND: 1.34, BOB: 6.9, BRL: 5.5, BSD: 1, BTN: 84, BWP: 13.6, BYN: 3.3, BZD: 2,
  CAD: 1.37, CDF: 2850, CHF: 0.88, CLP: 950, CNY: 7.2, COP: 4100, CRC: 520, CUP: 24,
  CVE: 101, CZK: 23, DJF: 178, DKK: 6.8, DOP: 60, DZD: 134, EGP: 48, ERN: 15, ETB: 125,
  EUR: 0.92, FJD: 2.25, FKP: 0.79, GBP: 0.79, GEL: 2.7, GHS: 15, GMD: 70, GNF: 8600,
  GTQ: 7.7, GYD: 209, HKD: 7.8, HNL: 25, HTG: 132, HUF: 360, IDR: 15800, ILS: 3.7,
  INR: 88, IQD: 1310, IRR: 42000, ISK: 138, JMD: 157, JOD: 0.709, JPY: 150, KES: 130,
  KGS: 86, KHR: 4100, KMF: 450, KPW: 900, KRW: 1340, KWD: 0.307, KYD: 0.83, KZT: 480,
  LAK: 21500, LBP: 89500, LKR: 340, LRD: 195, LSL: 18, LYD: 4.8, MAD: 10, MDL: 18,
  MGA: 4600, MKD: 57, MMK: 2100, MNT: 3400, MOP: 8, MRU: 40, MUR: 46, MVR: 15.4,
  MWK: 1750, MXN: 18, MYR: 4.7, MZN: 64, NAD: 18, NGN: 1600, NIO: 37, NOK: 10.7,
  NPR: 160, NZD: 1.65, OMR: 0.385, PAB: 1, PEN: 3.8, PGK: 3.9, PHP: 57, PKR: 330,
  PLN: 4, PYG: 7500, QAR: 3.64, RON: 4.6, RSD: 108, RUB: 95, RWF: 1350, SAR: 3.75,
  SBD: 8.4, SDG: 600, SEK: 10.5, SGD: 1.34, SHP: 0.79, SLE: 22, SOS: 570, SRD: 35,
  SSP: 1300, STN: 22.5, SYP: 13000, SZL: 18, THB: 36, TJS: 10.6, TMT: 3.5, TND: 3.1,
  TOP: 2.35, TRY: 34, TTD: 6.8, TWD: 32, TZS: 2700, UAH: 41, UGX: 3700, USD: 1,
  UYU: 40, UZS: 12700, VES: 40, VND: 25000, VUV: 120, WST: 2.7, XAF: 605, XCD: 2.7,
  XOF: 605, XPF: 110, YER: 250, ZAR: 18, ZMW: 27,
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

// The language the phone reports is the best clue for the country: Android gives
// "en-IN", "ur-PK", "ar-SA" and so on. The time zone is only the fallback, for a
// phone whose language carries no country at all (a plain "en").
const ZONES = [
  [/Calcutta|Kolkata/i, 'IN'],
  [/Karachi/i, 'PK'],
  [/Dhaka/i, 'BD'],
  [/Kathmandu/i, 'NP'],
  [/Colombo/i, 'LK'],
  [/Riyadh/i, 'SA'],
  [/Dubai|Muscat/i, 'AE'],
  [/Qatar/i, 'QA'],
  [/Kuwait/i, 'KW'],
  [/Bahrain/i, 'BH'],
  [/Istanbul/i, 'TR'],
  [/Jakarta|Pontianak|Makassar|Jayapura/i, 'ID'],
  [/Kuala_Lumpur|Kuching/i, 'MY'],
  [/Singapore/i, 'SG'],
  [/Bangkok/i, 'TH'],
  [/Manila/i, 'PH'],
  [/Ho_Chi_Minh|Saigon/i, 'VN'],
  [/Shanghai|Chongqing|Urumqi|Harbin/i, 'CN'],
  [/Hong_Kong/i, 'HK'],
  [/Taipei/i, 'TW'],
  [/Tokyo/i, 'JP'],
  [/Seoul/i, 'KR'],
  [/Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin/i, 'AU'],
  [/Auckland/i, 'NZ'],
  [/Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns/i, 'CA'],
  [/London|Belfast/i, 'GB'],
  [/Dublin/i, 'IE'],
  [/Paris/i, 'FR'],
  [/Berlin/i, 'DE'],
  [/Madrid/i, 'ES'],
  [/Rome/i, 'IT'],
  [/Amsterdam/i, 'NL'],
  [/Brussels/i, 'BE'],
  [/Zurich/i, 'CH'],
  [/Vienna/i, 'AT'],
  [/Stockholm/i, 'SE'],
  [/Oslo/i, 'NO'],
  [/Copenhagen/i, 'DK'],
  [/Helsinki/i, 'FI'],
  [/Warsaw/i, 'PL'],
  [/Prague/i, 'CZ'],
  [/Moscow/i, 'RU'],
  [/Kyiv|Kiev/i, 'UA'],
  [/Cairo/i, 'EG'],
  [/Lagos/i, 'NG'],
  [/Nairobi/i, 'KE'],
  [/Johannesburg|Cape_Town/i, 'ZA'],
  [/Casablanca/i, 'MA'],
  [/Tunis/i, 'TN'],
  [/Algiers/i, 'DZ'],
  [/Baghdad/i, 'IQ'],
  [/Tehran/i, 'IR'],
  [/Kabul/i, 'AF'],
  [/Tashkent/i, 'UZ'],
  [/Almaty|Astana/i, 'KZ'],
  [/Baku/i, 'AZ'],
  [/Bishkek/i, 'KG'],
  [/Dushanbe/i, 'TJ'],
  [/Ashgabat/i, 'TM'],
  [/Sao_Paulo|Rio_Branco/i, 'BR'],
  [/Buenos_Aires/i, 'AR'],
  [/Mexico_City|Monterrey|Cancun|Tijuana/i, 'MX'],
  [/Bogota/i, 'CO'],
  [/Lima/i, 'PE'],
  [/Santiago/i, 'CL'],
  [/Caracas/i, 'VE'],
];

/** "en-IN" / "en_IN" → "IN"; empty when the tag has no country. */
function countryOf(tag) {
  const text = String(tag || '');
  if (!text) return '';
  try {
    const region = new Intl.Locale(text).region;
    if (region) return region.toUpperCase();
  } catch (error) {
    /* older browser: use the plain pattern below */
  }
  const match = text.toUpperCase().match(/[-_]([A-Z]{2})\b/);
  return match ? match[1] : '';
}

/**
 * The region the app is opened in. The time zone is asked first, because it is
 * where the phone actually is: an Indian phone whose language is set to plain
 * English very often reports "en-US", and reading that as the United States is
 * exactly how some people were shown a dollar price for a rupee plan. Only when
 * the zone says nothing (a US zone, or one not in the list) does the language's
 * country decide, and "US" is the last resort.
 */
export function region() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    for (const [pattern, code] of ZONES) {
      if (pattern.test(tz)) return code;
    }
  } catch (error) {
    /* no Intl: fall through to the language */
  }
  const tags = [];
  try {
    if (navigator.language) tags.push(navigator.language);
  } catch (error) {
    /* no navigator: fall through */
  }
  try {
    if (Array.isArray(navigator.languages)) tags.push(...navigator.languages);
  } catch (error) {
    /* ignore */
  }
  for (const tag of tags) {
    const code = countryOf(tag);
    if (code && COUNTRY_CURRENCY[code]) return code;
  }
  return 'US';
}

/** "India" for "IN"; the code itself when the browser cannot name it. */
export function regionName(code) {
  try {
    const name = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(code);
    if (name) return name;
  } catch (error) {
    /* older browser: show the code */
  }
  return code || '';
}

/** A tidy number so a converted price never looks like 3,481.37. */
function niceAmount(value) {
  if (value >= 100000) return Math.round(value / 1000) * 1000;
  if (value >= 10000) return Math.round(value / 500) * 500;
  if (value >= 1000) return Math.round(value / 100) * 100;
  if (value >= 100) return Math.round(value / 10) * 10;
  if (value >= 10) return Math.round(value);
  return Math.round(value * 100) / 100;
}

/** "₹99", "3.67 SAR", "¥500" — written the way the phone writes money. */
function money(amount, currency) {
  try {
    return new Intl.NumberFormat(navigator.language || undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return `${currency} ${amount}`;
  }
}

// The price Play itself will charge, as `getDetails()` reported it (billing.js
// saves it there). While it is known it is shown instead of a converted number,
// so the paywall and the Play payment sheet always name the same money — the
// table below is only the guess for a browser, where nothing can be charged.
const STORE_PRICES = 'tc.storePrices';
const STORE_PRICES_TTL = 30 * 86400000;

/** billing.js calls this with { monthly: {currency, value}, yearly: {...} }. */
export function saveStorePrices(map) {
  if (!map) return;
  let out = {};
  try {
    out = JSON.parse(read(STORE_PRICES, 'null')) || {};
  } catch (error) {
    out = {};
  }
  let saved = false;
  for (const key of ['monthly', 'yearly']) {
    const item = map[key];
    if (!item) continue;
    const currency = String(item.currency || '').toUpperCase();
    const value = Number(item.value);
    if (!currency || !isFinite(value) || value <= 0) continue;
    out[key] = { currency, value };
    saved = true;
  }
  if (!saved) return;
  out.at = Date.now();
  write(STORE_PRICES, JSON.stringify(out));
}

function storePrices() {
  try {
    const data = JSON.parse(read(STORE_PRICES, 'null'));
    if (!data || !data.at || Date.now() - data.at > STORE_PRICES_TTL) return null;
    return data;
  } catch (error) {
    return null;
  }
}

/** Local price of a plan: Play's own price when the store has answered. */
export function priceFor(planId) {
  const code = region();
  const key = planId === 'yearly' ? 'yearly' : 'monthly';

  const fromStore = storePrices();
  const quoted = fromStore && fromStore[key];
  if (quoted) {
    return {
      region: code,
      currency: quoted.currency,
      amount: quoted.value,
      label: money(quoted.value, quoted.currency),
      store: true,
    };
  }

  const fixed = SOUTH_ASIA[code];
  if (fixed) {
    const amount = fixed[key];
    return { region: code, currency: fixed.currency, amount, label: money(amount, fixed.currency) };
  }

  const currency = COUNTRY_CURRENCY[code] || BASE.currency;
  const rate = RATES[currency] || 1;
  const amount = niceAmount(BASE[key] * rate);
  return { region: code, currency, amount, label: money(amount, currency) };
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
  // A gift code counts as Premium for as long as it lasts; a lifetime one (0 days)
  // has no expiry at all, so `expires` stays 0 and the state reads it as "for good".
  const gift = giftState();
  const bought = read(KEY, '0') === '1';
  const boughtUntil = Number(read(EXPIRES, 0)) || 0;
  const giftUntil = gift.lifetime ? 0 : gift.until;
  return {
    paid: bought || gift.active,
    bought,
    gift,
    planId: read(PLAN_KEY, '') || (gift.active ? 'gift' : null),
    expires: bought ? boughtUntil : giftUntil,
    since,
    checks,
  };
}

/** Everything the UI and the gates need. */
export function premiumState() {
  const data = store();
  const active = data.paid && (!data.expires || data.expires > Date.now());
  const days = Math.floor((Date.now() - data.since) / 86400000);
  // On Play, the 3-day trial is a Play "free trial" offer on the subscription.
  // The app must not hand out Premium on its own there (Play policy).
  const trial = !active && !isPlayBuild() && days < TRIAL_DAYS;
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
    gift: data.gift,
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
