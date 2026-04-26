-- Session 1.5 / FILE 5
--
-- event_expenses: cost-side ledger for the tournament. Combined with
-- contact_activities revenue in get_financial_summary to compute net.
-- Amounts in cents (matches Session 1.5 cents convention).

CREATE TABLE public.event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL,
  vendor TEXT NOT NULL,

  category TEXT NOT NULL CHECK (category IN (
    'venue',
    'food_beverage',
    'prizes',
    'merchandise_cogs',
    'printing',
    'tech_software',
    'payment_processing',
    'marketing',
    'auction_items_purchased',
    'other'
  )),

  description TEXT,

  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),

  payment_method TEXT CHECK (payment_method IN (
    'corporate_card',
    'personal_card_reimbursed',
    'cheque',
    'eft',
    'cash',
    'other'
  )),

  tournament_year INTEGER NOT NULL,

  receipt_url TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_event_expenses_year ON public.event_expenses(tournament_year);
CREATE INDEX idx_event_expenses_category ON public.event_expenses(category);

ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage event expenses"
  ON public.event_expenses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_event_expenses_updated_at
  BEFORE UPDATE ON public.event_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


COMMENT ON TABLE public.event_expenses IS
  'Cost-side ledger for the tournament. Joined with contact_activities revenue in get_financial_summary to compute net funds available.';
COMMENT ON COLUMN public.event_expenses.amount_cents IS
  'Expense amount in cents. BIGINT matches the Session 1.5 cents convention used by the financial RPCs.';
COMMENT ON COLUMN public.event_expenses.receipt_url IS
  'Storage URL or external link to the receipt/invoice. No bucket convention enforced yet.';
