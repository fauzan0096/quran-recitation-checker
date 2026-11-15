// © 2026 F A FS — Bayyin (بيّن). All rights reserved. See LICENSE.
//
// Adapter for the native wrapper only (never loaded by the web app). It turns the
// Capacitor plugin into the small object `billing.js` looks for, so the same
// application code keeps working in the browser, in the TWA and in the native
// build.
//
// Load it after Capacitor (e.g. at the end of the wrapper's index.html, or from
// the plugin's load()), or copy the body into the wrapper's own entry script.

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
