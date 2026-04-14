import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // If webhook secret is configured, verify signature
    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    let event: Stripe.Event;

    if (STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const pendingOrderId = session.metadata?.pending_order_id;

      if (!pendingOrderId) {
        console.error("No pending_order_id in session metadata");
        return new Response("OK", { status: 200 });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get pending order
      const { data: order, error: orderError } = await supabase
        .from("pending_orders")
        .select("*")
        .eq("id", pendingOrderId)
        .single();

      if (orderError || !order) {
        console.error("Pending order not found:", orderError?.message);
        return new Response("OK", { status: 200 });
      }

      // Process each item
      const items = order.items as any[];
      for (const item of items) {
        const formData = item.formData || {};

        switch (item.type) {
          case "registration":
            await supabase.from("registrations").insert({
              team_name: formData.teamName || "Unknown Team",
              business_name: formData.teamName,
              captain_name: formData.captainName || "",
              captain_email: formData.captainEmail || "",
              captain_phone: formData.captainPhone || "",
              captain_address: formData.street,
              captain_city: formData.city,
              captain_province: formData.province,
              captain_postal_code: formData.postalCode,
              status: "confirmed",
              stripe_session_id: session.id,
              paid: true,
            });

            // Decrement spots
            const { data: spotsSetting } = await supabase
              .from("settings")
              .select("value")
              .eq("key", "spots_remaining")
              .single();

            if (spotsSetting) {
              const current = Number(spotsSetting.value);
              if (current > 0) {
                await supabase
                  .from("settings")
                  .update({ value: (current - 1) as any })
                  .eq("key", "spots_remaining");
              }
            }
            break;

          case "sponsorship":
            await supabase.from("sponsors").insert({
              business_name: formData.businessName || "",
              contact_name: formData.contactName || "",
              contact_email: formData.contactEmail || "",
              contact_phone: formData.contactPhone,
              tier_name: formData.tier || "",
              tier_id: formData.tierId || null,
              amount: item.amount,
              stripe_session_id: session.id,
              paid: true,
            });
            break;

          case "donation":
            await supabase.from("donations").insert({
              donor_name: formData.donorName || "Anonymous",
              donor_email: formData.donorEmail || "",
              amount: item.amount,
              wants_recurring: formData.wantsRecurring || false,
              stripe_session_id: session.id,
              paid: true,
            });
            break;
        }
      }

      // Mark order as completed
      await supabase
        .from("pending_orders")
        .update({ status: "completed", stripe_session_id: session.id })
        .eq("id", pendingOrderId);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
});
