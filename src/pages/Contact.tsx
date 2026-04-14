import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Mail, Phone, CheckCircle } from "lucide-react";

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save to Supabase messages table
    toast({ title: "Message sent!", description: "We'll get back to you as soon as possible." });
    setSubmitted(true);
  };

  return (
    <div className="container py-12 md:py-20 max-w-4xl mx-auto space-y-12 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="font-heading font-bold text-4xl md:text-5xl">Contact Us</h1>
        <p className="text-lg text-muted-foreground">We'd love to hear from you</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact info */}
        <div className="space-y-6">
          <h2 className="font-heading font-bold text-2xl">Get in Touch</h2>
          <div className="space-y-4">
            <a href="mailto:hello@hope4holden.com" className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
              <Mail className="h-5 w-5 text-primary" />
              hello@hope4holden.com
            </a>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p>Jill Stewart: 204-761-3880</p>
                <p>Derrick Stewart: 204-761-6955</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Send a Message</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center space-y-4 py-8">
                <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                <p className="font-medium">Thank you for your message!</p>
                <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", message: "" }); }}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} required />
                </div>
                <Button type="submit" className="w-full">Send Message</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContactPage;
