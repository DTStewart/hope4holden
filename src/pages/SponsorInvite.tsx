import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { SponsorMaterialsSection } from "@/components/SponsorMaterialsSection";
import { useSponsorsByOrderId } from "@/hooks/useSponsorsByOrderId";

interface InviteData {
  id: string;
  tier_id: string;
  tier_name: string;
  amount: number;
  token: string;
  expires_at: string;
  used: boolean;
}

export default function SponsorInvite() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [status, setStatus] = useState<"loading" | "valid" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";
  const successOrderId = success ? searchParams.get("order_id") : null;
  const { sponsors: paidSponsors, loading: loadingSponsors, timedOut: sponsorLookupTimedOut } = useSponsorsByOrderId(successOrderId);

  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    facebookHandle: "",
    instagramHandle: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid invite link.");
      return;
    }

    (async () => {
      console.log("[SponsorInvite] Fetching invite for token:", token);
      const { data, error } = await anonSupabase
        .rpc("lookup_sponsor_invite", { invite_token: token })
        .maybeSingle();

      console.log("[SponsorInvite] Query result:", { data, error });

      if (error) {
        console.error("[SponsorInvite] Query error:", error);
        setStatus("error");
        setErrorMsg(`Could not load invite: ${error.message}`);
        return;
      }

      if (!data) {
        setStatus("error");
        setErrorMsg("This invite link is not valid.");
        return;
      }

      if (data.used) {
        setStatus("error");
        setErrorMsg("This invite has already been used.");
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setStatus("error");
        setErrorMsg("This invite has expired.");
        return;
      }

      setInvite(data as InviteData);
      setStatus("valid");
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    setSubmitting(true);
    try {
      const { data, error } = await anonSupabase.functions.invoke("create-checkout", {
        body: {
          items: [
            {
              type: "sponsorship",
              description: `${invite.tier_name} Sponsorship (Invite)`,
              amount: invite.amount,
              formData: {
                businessName: form.businessName,
                contactName: form.contactName,
                contactEmail: form.contactEmail,
                contactPhone: form.contactPhone,
                facebookHandle: form.facebookHandle || undefined,
                instagramHandle: form.instagramHandle || undefined,
                tier: invite.tier_name,
                tierId: invite.tier_id,
                inviteToken: invite.token,
              },
            },
          ],
          returnUrl: `${window.location.origin}/sponsor-invite/${token}`,
        },
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err: any) {
      toast({
        title: "Checkout failed",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-2xl mx-auto animate-fade-in">
          <div className="text-center space-y-6">
            <CheckCircle className="h-20 w-20 text-primary mx-auto" />
            <h1 className="font-heading font-extrabold text-4xl text-[#1A1A1A]">Thank You!</h1>
            <p className="text-[#1A1A1A]/60 text-lg">
              Your sponsorship payment was successful. You can upload your logo and confirm your social handles below — or save the link for later.
            </p>
            <Button onClick={() => navigate("/")} size="lg" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider">
              Back to Home
            </Button>
          </div>

          {loadingSponsors && successOrderId && paidSponsors.length === 0 && (
            <div className="text-center mt-8 text-sm text-[#1A1A1A]/50 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing sponsor materials...
            </div>
          )}
          {sponsorLookupTimedOut && paidSponsors.length === 0 && (
            <div className="bg-accent/10 border border-accent/20 rounded p-6 text-left space-y-2 mt-8">
              <p className="font-heading font-bold text-[#1A1A1A]">Your payment was received.</p>
              <p className="text-sm text-[#1A1A1A]/70">
                We've sent an email with your sponsor logo upload link. If it doesn't arrive within a few
                minutes, please check your spam folder or email{" "}
                <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>
                {" "}and we'll sort it out.
              </p>
            </div>
          )}
          {paidSponsors.map((s) => (
            <SponsorMaterialsSection key={s.id} sponsor={s} />
          ))}
        </div>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
          <XCircle className="h-20 w-20 text-destructive mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Payment Canceled</h1>
          <p className="text-[#1A1A1A]/60">Your payment was not processed. You can try again using the same link.</p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Invalid Invite</h1>
          <p className="text-[#1A1A1A]/60">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-light min-h-[60vh]">
      <div className="container py-16 md:py-24 max-w-2xl mx-auto animate-fade-in">
        <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-2">Complete Your Sponsorship</h1>
        <p className="text-[#1A1A1A]/60 mb-8">
          Thank you for becoming a <strong>{invite!.tier_name}</strong>. Your contribution is <strong>${invite!.amount.toLocaleString()} CAD</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
            <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Sponsor Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="businessName" className="text-[#1A1A1A] font-medium">Business or Sponsor Name *</Label>
                <Input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" placeholder="e.g. Acme Corp or Jane Smith" />
                <p className="text-xs text-[#1A1A1A]/50">How you'll be recognized — on event signage, our sponsor list, and thank-you posts.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName" className="text-[#1A1A1A] font-medium">Contact Name *</Label>
                <Input id="contactName" name="contactName" value={form.contactName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-[#1A1A1A] font-medium">Contact Email *</Label>
                <Input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="text-[#1A1A1A] font-medium">Contact Phone *</Label>
                <Input id="contactPhone" name="contactPhone" type="tel" value={form.contactPhone} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
            </div>
            <Separator className="bg-[#1A1A1A]/10" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facebookHandle" className="text-[#1A1A1A] font-medium">Facebook Handle</Label>
                <Input id="facebookHandle" name="facebookHandle" value={form.facebookHandle} onChange={handleChange} placeholder="@yourhandle" className="rounded border-[#1A1A1A]/15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagramHandle" className="text-[#1A1A1A] font-medium">Instagram Handle</Label>
                <Input id="instagramHandle" name="instagramHandle" value={form.instagramHandle} onChange={handleChange} placeholder="@yourhandle" className="rounded border-[#1A1A1A]/15" />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
            <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Order Summary</p>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-[#1A1A1A]">{invite!.tier_name} Sponsorship</p>
                <p className="text-xs text-[#1A1A1A]/40 font-heading uppercase tracking-wider">Invited Sponsor</p>
              </div>
              <span className="font-heading font-bold text-[#1A1A1A]">${invite!.amount.toLocaleString()}</span>
            </div>
            <Separator className="bg-[#1A1A1A]/10" />
            <div className="flex justify-between font-heading font-extrabold text-lg text-[#1A1A1A]">
              <span>Total</span>
              <span>${invite!.amount.toLocaleString()} CAD</span>
            </div>
          </div>

          <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to payment...</>
            ) : (
              `Pay $${invite!.amount.toLocaleString()} CAD`
            )}
          </Button>

          <p className="text-xs text-[#1A1A1A]/40 text-left">
            Payments are securely processed by Stripe.
          </p>
        </form>
      </div>
    </div>
  );
}
