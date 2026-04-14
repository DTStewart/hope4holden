import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Mail, Phone, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("messages").insert({
      sender_name: form.name,
      sender_email: form.email,
      message: form.message,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Message sent!", description: "We'll get back to you as soon as possible." });
    setSubmitted(true);
  };

  return (
    <div>
      <section className="section-dark">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Reach Out</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95]">
            Contact Us
          </h1>
          <p className="text-white/60 text-lg mt-6">We'd love to hear from you.</p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-16 md:py-24 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-5xl">
            {/* Contact info */}
            <div className="space-y-8">
              <div>
                <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40 mb-4">Email</p>
                <a href="mailto:hello@hope4holden.com" className="text-[#1A1A1A] hover:text-primary transition-colors flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  hello@hope4holden.com
                </a>
              </div>
              <div>
                <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40 mb-4">Phone</p>
                <div className="space-y-2 text-[#1A1A1A]/70">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <span>Jill Stewart: 204-761-3880</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <span>Derrick Stewart: 204-761-6955</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
              {submitted ? (
                <div className="text-center space-y-4 py-8">
                  <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                  <p className="font-heading font-bold text-[#1A1A1A]">Thank you for your message!</p>
                  <Button variant="outline" className="rounded border-[#1A1A1A]/20" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", message: "" }); }}>
                    Send Another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[#1A1A1A] font-medium">Name</Label>
                    <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#1A1A1A] font-medium">Email</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-[#1A1A1A] font-medium">Message</Label>
                    <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" disabled={loading}>
                    {loading ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
