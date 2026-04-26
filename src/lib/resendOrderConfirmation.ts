import { adminSupabase } from "@/integrations/supabase/adminClient";

interface LineItem {
  type: string;
  description: string;
  amount: number;
}

interface BasePayload {
  recipientEmail: string;
  recipientName?: string;
  lineItems: LineItem[];
  totalAmount: number;
  hasRegistration?: boolean;
  hasSponsorship?: boolean;
  hasDinner?: boolean;
  isDinnerOnly?: boolean;
  idempotencySource: string; // unique id for the underlying record
}

async function send(payload: BasePayload) {
  const { recipientEmail, idempotencySource, ...rest } = payload;
  const { error } = await adminSupabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "order-confirmation",
      recipientEmail,
      // include timestamp so manual resends always go out (one logical resend = one click)
      idempotencyKey: `order-confirm-resend-${idempotencySource}-${Date.now()}`,
      templateData: {
        recipientEmail,
        ...rest,
      },
    },
  });
  if (error) throw error;
}

export function resendForRegistration(r: any) {
  return send({
    recipientEmail: r.captain_email,
    recipientName: r.captain_name,
    lineItems: [
      { type: "registration", description: `Team Registration — ${r.team_name}`, amount: r.amount ?? 800 },
    ],
    totalAmount: r.amount ?? 800,
    hasRegistration: true,
    idempotencySource: `reg-${r.id}`,
  });
}

export function resendForSponsor(s: any) {
  return send({
    recipientEmail: s.contact_email,
    recipientName: s.contact_name,
    lineItems: [
      { type: "sponsorship", description: `${s.tier_name} Sponsorship — ${s.business_name}`, amount: s.amount },
    ],
    totalAmount: s.amount,
    hasSponsorship: true,
    idempotencySource: `spo-${s.id}`,
  });
}

export function resendForDonation(d: any) {
  return send({
    recipientEmail: d.donor_email,
    recipientName: d.donor_name,
    lineItems: [{ type: "donation", description: "Donation", amount: d.amount }],
    totalAmount: d.amount,
    idempotencySource: `don-${d.id}`,
  });
}

export function resendForDinner(d: any) {
  return send({
    recipientEmail: d.guest_email,
    recipientName: d.guest_name,
    lineItems: [
      { type: "dinner", description: `Dinner Tickets × ${d.quantity}`, amount: d.amount },
    ],
    totalAmount: d.amount,
    hasDinner: true,
    isDinnerOnly: true,
    idempotencySource: `din-${d.id}`,
  });
}
