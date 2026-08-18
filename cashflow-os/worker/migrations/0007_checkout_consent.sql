-- Audit trail for the consent a buyer gives before paying.
--
-- Recorded when the checkout session is created, which is the moment the
-- buyer actually ticks the box. The purchase row does not exist yet at that
-- point (it is written by the paid webhook afterwards), so consent is stored
-- in its own table keyed by the Lemon Squeezy checkout id and then stamped
-- onto the purchase when the webhook lands. Keeping the standalone row means
-- an abandoned checkout still leaves evidence that consent was given.
--
-- policy_version lets a future change to the terms be told apart from
-- agreements made under the current wording.
CREATE TABLE IF NOT EXISTS checkout_consents (
  id TEXT PRIMARY KEY,
  checkout_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  product_keys TEXT NOT NULL DEFAULT '[]',
  bundle_key TEXT NOT NULL DEFAULT '',
  policy_version TEXT NOT NULL DEFAULT '',
  consent_text TEXT NOT NULL DEFAULT '',
  -- Coarse evidence only. No IP address and no user agent: they are personal
  -- data that would then need to be purged on account deletion, and the
  -- signed-in user id plus timestamp already identify who agreed and when.
  source TEXT NOT NULL DEFAULT 'cart',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS checkout_consents_user_idx ON checkout_consents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_consents_checkout_idx ON checkout_consents (checkout_id);

-- Denormalised onto the purchase so the owner can see, on the order itself,
-- that consent was given and under which version of the policies.
ALTER TABLE purchases ADD COLUMN consent_at TEXT NOT NULL DEFAULT '';
ALTER TABLE purchases ADD COLUMN consent_policy_version TEXT NOT NULL DEFAULT '';
