// © 2026 F A FS — Bayyin (بيّن). All rights reserved. See LICENSE.
//
// Reference Capacitor plugin for the native wrapper. It is what a TWA cannot do:
// it lists a subscription's offers and passes the chosen offerToken into the Play
// billing flow, so a launch offer (bayyin-launch) really appears in the sheet.
//
// This file is not built on this device. Put it in
//   android/app/src/main/java/app/bayyin/BayyinBillingPlugin.kt
// add the Play Billing dependency (com.android.billingclient:billing:7.1.1) and
// register it in MainActivity with registerPlugin(BayyinBillingPlugin.class).

package app.bayyin

import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "BayyinBilling")
class BayyinBillingPlugin : Plugin(), PurchasesUpdatedListener {

    private var billing: BillingClient? = null
    private var pending: PluginCall? = null

    override fun load() {
        billing = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases()
            .build()
        billing?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                // A purchase that was started before a crash is answered here.
            }

            override fun onBillingServiceDisconnected() {
                // The next call reconnects through queryProductDetailsAsync.
            }
        })
    }

    /** All the offers of a subscription, with the token each one needs. */
    @PluginMethod
    fun offers(call: PluginCall) {
        val sku = call.getString("sku")
        if (sku.isNullOrEmpty()) {
            call.resolve(JSObject().put("offers", JSArray()))
            return
        }
        billing?.queryProductDetailsAsync(queryFor(sku)) { result, list ->
            val offers = JSArray()
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                list?.forEach { details ->
                    details.subscriptionOfferDetails?.forEach { offer ->
                        val id = offer.offerId
                        if (!id.isNullOrEmpty()) {
                            offers.put(
                                JSObject()
                                    .put("offerId", id)
                                    .put("offerToken", offer.offerToken)
                                    .put("basePlanId", offer.basePlanId)
                            )
                        }
                    }
                }
            }
            call.resolve(JSObject().put("offers", offers))
        } ?: call.resolve(JSObject().put("offers", JSArray()))
    }

    /** Opens the Play sheet for a product, on the offer whose token is given. */
    @PluginMethod
    fun purchase(call: PluginCall) {
        val sku = call.getString("sku")
        if (sku.isNullOrEmpty()) {
            call.reject("No product id")
            return
        }
        val wantedToken = call.getString("offerToken") ?: ""

        billing?.queryProductDetailsAsync(queryFor(sku)) { result, list ->
            val details = list?.firstOrNull { it.productId == sku }
            if (result.responseCode != BillingClient.BillingResponseCode.OK || details == null) {
                call.reject("Product not available (${result.responseCode})")
                return@queryProductDetailsAsync
            }

            val params = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
            val offer = details.subscriptionOfferDetails
                ?.firstOrNull { it.offerToken == wantedToken }
                ?: details.subscriptionOfferDetails?.firstOrNull { it.offerId == "bayyin-launch" }
            if (offer != null) params.setOfferToken(offer.offerToken)

            val flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(listOf(params.build()))
                .build()

            pending = call
            val launched = billing?.launchBillingFlow(activity, flow)
            if (launched == null || launched.responseCode != BillingClient.BillingResponseCode.OK) {
                pending = null
                call.reject("Could not open the Play sheet")
            }
        } ?: call.reject("Billing is not connected")
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        val call = pending ?: return
        pending = null

        if (result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.resolve(JSObject().put("ok", false).put("error", "cancelled"))
            return
        }
        if (result.responseCode != BillingClient.BillingResponseCode.OK || purchases.isNullOrEmpty()) {
            call.resolve(JSObject().put("ok", false).put("error", "error ${result.responseCode}"))
            return
        }

        var found = false
        purchases.forEach { purchase ->
            if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return@forEach
            found = true
            if (!purchase.isAcknowledged) {
                val ack = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
                billing?.acknowledgePurchase(ack) { /* Play will not refund */ }
            }
        }
        call.resolve(
            JSObject()
                .put("ok", found)
                .put("plan", "monthly")
        )
    }

    /** What Play already has for this account. */
    @PluginMethod
    fun restore(call: PluginCall) {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billing?.queryPurchasesAsync(params) { result, list ->
            val purchase = list?.firstOrNull { it.purchaseState == Purchase.PurchaseState.PURCHASED }
            if (result.responseCode == BillingClient.BillingResponseCode.OK && purchase != null) {
                call.resolve(
                    JSObject()
                        .put("ok", true)
                        .put("sku", purchase.products.firstOrNull() ?: "")
                )
            } else {
                call.resolve(JSObject().put("ok", false))
            }
        } ?: call.resolve(JSObject().put("ok", false))
    }

    /** Play's own subscription page, where a plan is cancelled. */
    @PluginMethod
    fun manage(call: PluginCall) {
        try {
            val intent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/account/subscriptions")
            )
            activity.startActivity(intent)
        } catch (error: Exception) {
            /* no browser: nothing more to do */
        }
        call.resolve()
    }

    private fun queryFor(sku: String): QueryProductDetailsParams {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(sku)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        return QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(product))
            .build()
    }
}
