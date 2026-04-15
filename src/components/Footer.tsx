import { Link } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import h4hLogo from "@/assets/h4h-logo.png";

const Footer = () => {
  const [email, setEmail] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const { error } = await supabase.from("email_subscribers").insert({ email });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already subscribed!", description: "This email is already on our list." });
      } else {
        toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Thank you!", description: "You've been added to our mailing list." });
    }
    setEmail("");
  };

  return (
    <footer className="bg-[#1A1A1A] text-white">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <img src={h4hLogo} alt="Hope 4 Holden" className="h-12 w-auto invert" />
            </Link>
            <p className="text-sm text-white/50 leading-relaxed">
              Raising funds for the Ataxia Telangiectasia Children's Project to help find a cure.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-primary">Quick Links</h4>
            <div className="flex flex-col gap-2 text-sm text-white/60">
              <Link to="/register" className="hover:text-primary transition-colors">Join Us</Link>
              <Link to="/sponsor" className="hover:text-primary transition-colors">Sponsor</Link>
              <Link to="/donate" className="hover:text-primary transition-colors">Donate</Link>
              <Link to="/about" className="hover:text-primary transition-colors">About</Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-primary">Contact</h4>
            <div className="flex flex-col gap-2 text-sm text-white/60">
              <a href="mailto:hello@hope4holden.com" className="hover:text-primary transition-colors">
                hello@hope4holden.com
              </a>
              <span>Jill: 204-761-3880</span>
              <span>Derrick: 204-761-6955</span>
              <a href="https://www.atcp.org" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                ATCP Website →
              </a>
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-primary">Stay Updated</h4>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded"
                required
              />
              <Button type="submit" size="sm" className="shrink-0 rounded bg-primary text-white hover:bg-[#4A7C09]">
                Join
              </Button>
            </form>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 text-xs text-white/30">
          <p>© {new Date().getFullYear()} Hope 4 Holden. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
