#Sprint 1
2569-10-01
#(1)
ALTER TABLE public.debt_year_detail
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'OPEN',
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
#(2)

CREATE TABLE IF NOT EXISTS public.payment_allocations (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
payment_slip_id int8 NOT NULL,
house_no text NOT NULL,
fiscal_year int4 NOT NULL,
allocation_type varchar(30) NOT NULL,
allocated_amount numeric NOT NULL DEFAULT 0,
sequence_no int4 NOT NULL,
created_at timestamptz DEFAULT now()
);

#Sprint 2
2569-10-02
#(1)
