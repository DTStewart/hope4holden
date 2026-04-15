import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fixed prices (in dollars) — must match what the frontend displays
const REGISTRATION_PRICE = 600;
const DINNER_PRICE = 45;
const MIN_DONATION = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { items, returnUrl } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Only fetch tiers if there's a sponsorship item
    const hasSponsorships = items.some((i: any) => i.type === "sponsorship");
    let tierMap = new Map<string, { price: number; name: string }>();

    if (hasSponsorships) {
      const { data: allTiers } = await supabase
        .from("sponsorship_tiers")
        .select("id, price, name")
        .eq("active", true);

      for (const t of allTiers || []) {
        tierMap.set(t.id, { price: t.price, name: t.name });
      }
    }

    const validatedItems = [];
    for (const item of items) {
      if (!item.type || typeof item.type !== "string") {
        return new Response(
          JSON.stringify({ error: "Each item must have a type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let serverAmount: number;

      switch (item.type) {
        case "registration":
          serverAmount = REGISTRATION_PRICE;
          break;

        case "sponsorship": {
          const tierId = item.formData?.tierId;
          if (!tierId || !tierMap.has(tierId)) {
            return new Response(
              JSON.stringify({ error: `Invalid sponsorship tier: ${tierId}` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          serverAmount = tierMap.get(tierId)!.price;
          break;
        }

        case "donation": {
          const donationAmount = Number(item.amount);
          if (!donationAmount || donationAmount < MIN_DONATION) {
            return new Response(
              JSON.stringify({ error: `Donation must be at least $${MIN_DONATION}` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          serverAmount = donationAmount;
          break;
        }

        case "dinner": {
          const quantity = Number(item.formData?.quantity);
          if (!quantity || quantity < 1) {
            return new Response(
              JSON.stringify({ error: "Dinner ticket quantity must be at least 1" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          serverAmount = quantity * DINNER_PRICE;
          break;
        }

        default:
          return new Response(
            JSON.stringify({ error: `Unknown item type: ${item.type}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }

      validatedItems.push({
        ...item,
        amount: serverAmount,
      });
    }

    const totalAmount = validatedItems.reduce(
      (sum: number, item: any) => sum + item.amount,
      0
    );

    // Create pending order and Stripe session in parallel
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });

    const lineItems = validatedItems.map((item: any) => ({
      price_data: {
        currency: "cad",
        product_data: {
          name: item.description,
          metadata: { type: item.type },
        },
        unit_amount: Math.round(item.amount * 100),
      },
      quantity: 1,
    }));

    const [orderResult, session] = await Promise.all([
      supabase
        .from("pending_orders")
        .insert({
          items: validatedItems,
          total_amount: totalAmount,
          status: "pending",
        })
        .select("id")
        .single(),
      stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${returnUrl}?success=true`,
        cancel_url: `${returnUrl}?canceled=true`,
        metadata: {
          pending_order_placeholder: "true",
        },
      }),
    ]);

    if (orderResult.error) throw new Error(`Failed to create pending order: ${orderResult.error.message}`);

    // Fire-and-forget: update pending order with stripe session id
    supabase
      .from("pending_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderResult.data.id)
      .then(() => {});

    // Also update session metadata with the order id (non-blocking)
    stripe.checkout.sessions.update(session.id, {
      metadata: { pending_order_id: orderResult.data.id },
    }).catch(() => {});

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: "Checkout failed. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
