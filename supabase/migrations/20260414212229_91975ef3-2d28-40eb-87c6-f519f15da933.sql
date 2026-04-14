
-- Registrations: enforce paid=false, status='pending' on public inserts
DROP POLICY IF EXISTS "Anyone can insert registrations" ON public.registrations;
CREATE POLICY "Anyone can insert registrations"
  ON public.registrations
  FOR INSERT
  TO public
  WITH CHECK (paid = false AND status = 'pending');

-- Donations: enforce paid=false on public inserts
DROP POLICY IF EXISTS "Anyone can insert donations" ON public.donations;
CREATE POLICY "Anyone can insert donations"
  ON public.donations
  FOR INSERT
  TO public
  WITH CHECK (paid = false);

-- Pending orders: enforce status='pending' on public inserts
DROP POLICY IF EXISTS "Anyone can insert pending orders" ON public.pending_orders;
CREATE POLICY "Anyone can insert pending orders"
  ON public.pending_orders
  FOR INSERT
  TO public
  WITH CHECK (status = 'pending');

-- Sponsors: enforce paid=false, approved=false on public inserts
DROP POLICY IF EXISTS "Anyone can insert sponsors" ON public.sponsors;
CREATE POLICY "Anyone can insert sponsors"
  ON public.sponsors
  FOR INSERT
  TO public
  WITH CHECK (paid = false AND approved = false);
