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
const EXTRA_GOLFER_PRICE = 150;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Short reference id so a customer's "Ref: abc123" complaint can be grep'd from logs.
  const refId = crypto.randomUUID().slice(0, 8);

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
    let tierMap = new Map<string, { price: number; name: string; max_slots: number | null }>();

    if (hasSponsorships) {
      const { data: allTiers } = await supabase
        .from("sponsorship_tiers")
        .select("id, price, name, max_slots")
        .eq("active", true);

      for (const t of allTiers || []) {
        tierMap.set(t.id, { price: t.price, name: t.name, max_slots: t.max_slots });
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
        case "registration": {
          const inviteToken = item.formData?.inviteToken;
          if (inviteToken) {
            // Invite-based registration: team_size and amount are admin-set on
            // the invite row and are the ONLY authoritative values. Any
            // client-supplied amount or teamSize is ignored; we read the invite
            // server-side and trust only its stored values. The invite is burned
            // (used = true) by stripe-webhook on confirmed payment, not here.
            // Mirrors the sponsorship invite path below.
            const { data: invite } = await supabase
              .from("registration_invites")
              .select("amount, team_size, used, expires_at")
              .eq("token", inviteToken)
              .maybeSingle();

            if (!invite) {
              return new Response(
                JSON.stringify({ error: "Registration invite not found." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            if (invite.used) {
              return new Response(
                JSON.stringify({ error: "This registration invite has already been used." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            if (new Date(invite.expires_at).getTime() < Date.now()) {
              return new Response(
                JSON.stringify({ error: "This registration invite has expired." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // amount is stored in dollars, same units as the flat price.
            serverAmount = invite.amount;
            // Stamp the admin-set team_size and source onto the item so the
            // webhook sets team_size and amount_paid from the trusted invite,
            // never from anything the payer typed.
            item.formData = { ...item.formData, teamSize: invite.team_size };
            item.registration_source = "admin_link";
          } else {
            // Public (non-invite) registration path: unchanged flat team price.
            serverAmount = REGISTRATION_PRICE;
          }
          break;
        }

        case "sponsorship": {
          const tierId = item.formData?.tierId;
          if (!tierId || !tierMap.has(tierId)) {
            return new Response(
              JSON.stringify({ error: `Invalid sponsorship tier: ${tierId}` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const tier = tierMap.get(tierId)!;
          const inviteToken = item.formData?.inviteToken;
          const hasInviteToken = !!inviteToken;

          // If no invite token, block sold-out tiers (max_slots === 0)
          if (!hasInviteToken && tier.max_slots !== null && tier.max_slots <= 0) {
            return new Response(
              JSON.stringify({ error: `The ${tier.name} tier is sold out.` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (hasInviteToken) {
            // Invite-based purchase: the amount is whatever the admin set on the
            // invite (deliberately hand-adjusted, e.g. a tier split between two
            // co-sponsors). The tier price is NOT authoritative here, and the
            // client-supplied amount is ignored entirely — we read the invite
            // server-side and trust only its stored amount. The invite is burned
            // (used = true) by stripe-webhook on confirmed payment, not here.
            const { data: invite } = await supabase
              .from("sponsor_invites")
              .select("amount, used, expires_at")
              .eq("token", inviteToken)
              .maybeSingle();

            if (!invite) {
              return new Response(
                JSON.stringify({ error: "Sponsorship invite not found." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            if (invite.used) {
              return new Response(
                JSON.stringify({ error: "This sponsorship invite has already been used." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            if (new Date(invite.expires_at).getTime() < Date.now()) {
              return new Response(
                JSON.stringify({ error: "This sponsorship invite has expired." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // amount is stored in dollars, same units as tier.price.
            serverAmount = invite.amount;
          } else {
            // No invite: allow the buyer to pay AT OR ABOVE the tier price (e.g.,
            // Fairway Friend is $250 minimum but supporters can choose to give
            // more). Never allow less than tier.price.
            const requested = Number(item.amount);
            serverAmount = requested && requested > tier.price ? requested : tier.price;
          }
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

        case "extra_golfers": {
          // Validate token and golfer count against the invite row
          const inviteToken = item.formData?.inviteToken;
          if (!inviteToken) {
            return new Response(
              JSON.stringify({ error: "Missing extra-golfer invite token" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const { data: invite } = await supabase
            .from("extra_golfer_invites")
            .select("id, golfer_count, used")
            .eq("token", inviteToken)
            .maybeSingle();
          if (!invite) {
            return new Response(
              JSON.stringify({ error: "Extra-golfer invite not found" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (invite.used) {
            return new Response(
              JSON.stringify({ error: "This payment link has already been used." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          serverAmount = invite.golfer_count * EXTRA_GOLFER_PRICE;
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

    // Channel kill-switch gate. Map each item to its sales channel and reject the
    // whole checkout BEFORE creating any pending order or Stripe session if any
    // touched channel is disabled. Deliberately NOT enforced in stripe-webhook:
    // a session that already exists must be allowed to complete, otherwise the
    // customer is charged and then errored.
    const channelForType = (type: string): string | null => {
      switch (type) {
        case "registration":
        case "extra_golfers":
          return "registration";
        case "sponsorship":
          return "sponsorship";
        case "donation":
          return "donation";
        case "dinner":
          return "dinner";
        case "auction":
          return "auction";
        default:
          return null;
      }
    };

    const touchedChannels = [
      ...new Set(
        validatedItems
          .map((i: any) => channelForType(i.type))
          .filter((c): c is string => c !== null)
      ),
    ];

    if (touchedChannels.length > 0) {
      const { data: channelRows, error: channelError } = await supabase
        .from("sales_channels")
        .select("channel, enabled, disabled_message")
        .in("channel", touchedChannels);

      // Fail-open on read: only reject a channel we can positively confirm is
      // disabled. A query error or a missing row leaves the channel enabled so a
      // schema hiccup never hard-breaks checkout for the whole public site.
      if (channelError) {
        console.error(`[${refId}] sales_channels read failed, allowing checkout:`, channelError.message);
      } else {
        const disabled = (channelRows || []).find((c: any) => c.enabled === false);
        if (disabled) {
          const friendly: Record<string, string> = {
            registration: "Team registration",
            dinner: "Dinner tickets",
            donation: "Donations",
            sponsorship: "Sponsorships",
            auction: "The auction",
          };
          const message =
            (disabled.disabled_message && String(disabled.disabled_message).trim()) ||
            `${friendly[disabled.channel] ?? "This option"} is currently unavailable.`;
          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const totalAmount = validatedItems.reduce(
      (sum: number, item: any) => sum + item.amount,
      0
    );

    // Create pending order FIRST so we have the ID for Stripe metadata
    const { data: orderData, error: orderError } = await supabase
      .from("pending_orders")
      .insert({
        items: validatedItems,
        total_amount: totalAmount,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError) throw new Error(`Failed to create pending order: ${orderError.message}`);

    // Now create Stripe session with the order ID already in metadata
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${returnUrl}?success=true&order_id=${orderData.id}`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: {
        pending_order_id: orderData.id,
      },
    });

    // Await the session-id update — if it silently fails, the post-payment
    // success page can't find the sponsor rows (it looks up by stripe_session_id).
    const { error: sessionLinkError } = await supabase
      .from("pending_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderData.id);
    if (sessionLinkError) {
      console.error(`[${refId}] Failed to link pending_order to stripe session:`, sessionLinkError.message);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${refId}] Checkout error:`, error);
    return new Response(
      JSON.stringify({ error: `Checkout failed. Please try again. (Ref: ${refId})` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
