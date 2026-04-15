import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

async function sendTransactionalEmail(
  functionsBaseUrl: string,
  serviceRoleKey: string,
  payload: {
    templateName: string;
    recipientEmail: string;
    idempotencyKey: string;
    templateData?: Record<string, any>;
  }
) {
  const response = await fetch(`${functionsBaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`send-transactional-email failed (${response.status}): ${errorBody}`);
  }
}

async function notifyAdmins(
  supabase: any,
  functionsBaseUrl: string,
  serviceRoleKey: string,
  templateName: string,
  templateData: Record<string, any>
) {
  try {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) return;

    for (const role of adminRoles) {
      const { data: userData } = await supabase.auth.admin.getUserById(role.user_id);
      if (!userData?.user?.email) continue;

      await sendTransactionalEmail(functionsBaseUrl, serviceRoleKey, {
        templateName,
        recipientEmail: userData.user.email,
        idempotencyKey: `${templateName}-${Date.now()}-${role.user_id}`,
        templateData,
      });
    }
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}

Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }
    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    let event: Stripe.Event;
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const pendingOrderId = session.metadata?.pending_order_id;

      if (!pendingOrderId) {
        console.error("No pending_order_id in session metadata");
        return new Response("OK", { status: 200 });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: order, error: orderError } = await supabase
        .from("pending_orders")
        .select("*")
        .eq("id", pendingOrderId)
        .single();

      if (orderError || !order) {
        console.error("Pending order not found:", orderError?.message);
        return new Response("OK", { status: 200 });
      }

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
            await supabase.rpc("decrement_spots");
            await notifyAdmins(
              supabase,
              SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY,
              "admin-new-registration",
              {
                teamName: formData.teamName || "Unknown Team",
                captainName: formData.captainName || "",
                captainEmail: formData.captainEmail || "",
              }
            );
            break;

          case "sponsorship": {
            const uploadToken = crypto.randomUUID();
            const { data: sponsorRow } = await supabase
              .from("sponsors")
              .insert({
                business_name: formData.businessName || "",
                contact_name: formData.contactName || "",
                contact_email: formData.contactEmail || "",
                contact_phone: formData.contactPhone,
                tier_name: formData.tier || "",
                tier_id: formData.tierId || null,
                amount: item.amount,
                stripe_session_id: session.id,
                paid: true,
                logo_upload_token: uploadToken,
              })
              .select("id")
              .single();

            if (formData.tierId) {
              await supabase.rpc("decrement_sponsor_slots", { _tier_id: formData.tierId });
            }

            const siteUrl = Deno.env.get("SITE_URL") || "https://hope4holden.lovable.app";
            const uploadUrl = `${siteUrl}/sponsor-upload/${uploadToken}`;
            if (formData.contactEmail) {
              try {
                await sendTransactionalEmail(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                  templateName: "sponsor-logo-upload",
                  recipientEmail: formData.contactEmail,
                  idempotencyKey: `sponsor-upload-${sponsorRow?.id || uploadToken}`,
                  templateData: {
                    businessName: formData.businessName || "",
                    tierName: formData.tier || "",
                    uploadUrl,
                  },
                });
              } catch (err) {
                console.error("Failed to send sponsor logo upload email:", err);
              }
            }

            await notifyAdmins(
              supabase,
              SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY,
              "admin-new-sponsorship",
              {
                businessName: formData.businessName || "",
                contactName: formData.contactName || "",
                contactEmail: formData.contactEmail || "",
                tierName: formData.tier || "",
                amount: item.amount,
              }
            );
            break;
          }

          case "donation":
            await supabase.from("donations").insert({
              donor_name: formData.donorName || "Anonymous",
              donor_email: formData.donorEmail || "",
              amount: item.amount,
              wants_recurring: formData.wantsRecurring || false,
              stripe_session_id: session.id,
              paid: true,
              donor_address: formData.street || null,
              donor_city: formData.city || null,
              donor_province: formData.province || null,
              donor_postal_code: formData.postalCode || null,
            });
            await notifyAdmins(
              supabase,
              SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY,
              "admin-new-donation",
              {
                donorName: formData.donorName || "Anonymous",
                donorEmail: formData.donorEmail || "",
                amount: item.amount,
              }
            );
            break;

          case "dinner":
            await supabase.from("dinners").insert({
              guest_name: formData.guestName || "Unknown",
              guest_email: formData.guestEmail || "",
              guest_phone: formData.guestPhone || "",
              quantity: formData.quantity || 1,
              amount: item.amount,
              stripe_session_id: session.id,
              paid: true,
            });
            break;
        }
      }

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