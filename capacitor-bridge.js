// © 2026 F A FS — Bayyin (بيّن). All rights reserved. See LICENSE.
//
// Native wrapper adapter. In a browser (and in the TWA) `window.Capacitor` is
// undefined and this does nothing. In the Capacitor build it points
// `window.BayyinBilling` at the Play Billing plugin, which is the only place a
// subscription offerToken can come from. See native/README.md.

(function () {
  const Capacitor = window.Capacitor;
  if (!Capacitor || !Capacitor.Plugins || !Capacitor.Plugins.BayyinBilling) return;
  const plugin = Capacitor.Plugins.BayyinBilling;

  window.BayyinBilling = {
    // billing.js calls offers(sku) and accepts an array or JSON text.
    offers: async (sku) => {
      const result = await plugin.offers({ sku: String(sku || '') });
      return result && Array.isArray(result.offers) ? result.offers : [];
    },

    // billing.js calls purchase(sku, offerToken) and awaits { ok, plan }.
    purchase: async (sku, offerToken) =>
      plugin.purchase({ sku: String(sku || ''), offerToken: String(offerToken || '') }),

    restore: async () => plugin.restore(),

    manage: async () => plugin.manage(),
  };
})();
