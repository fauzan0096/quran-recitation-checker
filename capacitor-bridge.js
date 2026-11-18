// © 2026 F A FS — Bayyin (بيّن). All rights reserved. See LICENSE.
//
// Native wrapper adapter. In a browser (and in the TWA) `window.Capacitor` is
// undefined and this does nothing. In the Capacitor build it points
// `window.BayyinBilling` at the Play Billing plugin, which is the only place a
// subscription offerToken can come from. See native/README.md.
//
// Capacitor may finish setting up its plugins after this module runs, so the
// install is tried now and again on the events Capacitor fires.

(function () {
  let installed = false;

  function install() {
    if (installed) return true;
    const Capacitor = window.Capacitor;
    if (!Capacitor || !Capacitor.Plugins || !Capacitor.Plugins.BayyinBilling) return false;
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

    installed = true;
    return true;
  }

  if (install()) return;
  document.addEventListener('capacitor:ready', install);
  document.addEventListener('DOMContentLoaded', install);
  window.addEventListener('load', install);
  window.setTimeout(install, 1200);
})();
