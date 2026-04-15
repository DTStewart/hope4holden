CREATE TABLE public.dinners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount INTEGER NOT NULL,
  stripe_session_id TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dinners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dinners"
  ON public.dinners FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert dinners"
  ON public.dinners FOR INSERT
  WITH CHECK (paid = false);