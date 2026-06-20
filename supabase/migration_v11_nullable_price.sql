-- Migration v11: allow ordering before the price is known.
-- Residents order with just a menu name; price stays NULL until the orderer
-- fills in the restaurant's actual price per person after the bill arrives.
-- A NULL price contributes 0 to "spent" (balances view uses sum(), which
-- skips NULLs), so a person isn't charged until their meal is priced.

alter table orders alter column price drop not null;
alter table orders alter column price drop default;
