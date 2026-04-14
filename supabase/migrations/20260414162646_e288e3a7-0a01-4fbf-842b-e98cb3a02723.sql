
-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. Settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. Sponsorship tiers
CREATE TABLE public.sponsorship_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsorship_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active tiers" ON public.sponsorship_tiers FOR SELECT USING (true);
CREATE POLICY "Admins can manage tiers" ON public.sponsorship_tiers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 4. Registrations
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  business_name TEXT,
  captain_name TEXT NOT NULL,
  captain_email TEXT NOT NULL,
  captain_phone TEXT NOT NULL,
  captain_address TEXT,
  captain_city TEXT,
  captain_province TEXT,
  captain_postal_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert registrations" ON public.registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage registrations" ON public.registrations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 5. Sponsors
CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  tier_id UUID REFERENCES public.sponsorship_tiers(id),
  tier_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  logo_url TEXT,
  stripe_session_id TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved sponsors" ON public.sponsors FOR SELECT USING (approved = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert sponsors" ON public.sponsors FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage sponsors" ON public.sponsors FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 6. Donations
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  amount INTEGER NOT NULL,
  wants_recurring BOOLEAN NOT NULL DEFAULT false,
  stripe_session_id TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert donations" ON public.donations FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage donations" ON public.donations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 7. Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage messages" ON public.messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 8. Email subscribers
CREATE TABLE public.email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON public.email_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage subscribers" ON public.email_subscribers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 9. Pending orders
CREATE TABLE public.pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert pending orders" ON public.pending_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read their pending order" ON public.pending_orders FOR SELECT USING (true);
CREATE POLICY "Admins can manage pending orders" ON public.pending_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 10. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sponsors_updated_at BEFORE UPDATE ON public.sponsors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sponsorship_tiers_updated_at BEFORE UPDATE ON public.sponsorship_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pending_orders_updated_at BEFORE UPDATE ON public.pending_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Storage bucket for sponsor logos
INSERT INTO storage.buckets (id, name, public) VALUES ('sponsor-logos', 'sponsor-logos', true);

CREATE POLICY "Sponsor logos are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'sponsor-logos');
CREATE POLICY "Admins can upload sponsor logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sponsor-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sponsor logos" ON storage.objects FOR UPDATE USING (bucket_id = 'sponsor-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sponsor logos" ON storage.objects FOR DELETE USING (bucket_id = 'sponsor-logos' AND public.has_role(auth.uid(), 'admin'));

-- 12. Seed default settings
INSERT INTO public.settings (key, value) VALUES
  ('registration_open', 'true'::jsonb),
  ('total_spots', '36'::jsonb),
  ('spots_remaining', '36'::jsonb);

-- 13. Seed default sponsorship tiers
INSERT INTO public.sponsorship_tiers (name, price, benefits, sort_order) VALUES
  ('Title', 5000, '["Premier logo placement on all materials","Exclusive hole signage","4 complimentary golfer registrations","Speaking opportunity at dinner","Social media recognition"]'::jsonb, 1),
  ('Gold', 2500, '["Logo on tournament materials","Hole signage","2 complimentary golfer registrations","Social media recognition"]'::jsonb, 2),
  ('Silver', 1000, '["Logo on tournament materials","Hole signage","Social media recognition"]'::jsonb, 3),
  ('Hole', 500, '["Signage at designated hole","Recognition on website"]'::jsonb, 4);
