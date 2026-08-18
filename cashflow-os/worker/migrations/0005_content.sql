-- Storefront content overrides: per-product marketing copy lives in a JSON
-- column merged over the built-in defaults, so every headline, section, and
-- FAQ can be edited from the owner dashboard without redeploys.
ALTER TABLE products ADD COLUMN content TEXT NOT NULL DEFAULT '';
