-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read their pending order" ON public.pending_orders;

-- Add admin-only SELECT policy
CREATE POLICY "Admins can read pending orders"
  ON public.pending_orders
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));