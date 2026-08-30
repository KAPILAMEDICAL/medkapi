-- Enables typo-tolerant, partial-word product/company search (Master
-- Prompt §7: "search must tolerate spelling mistakes, partial words").
-- pg_trgm provides trigram similarity; GIN indexes keep it fast even
-- against a catalog of thousands of products.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_composition_trgm_idx" ON "Product" USING GIN ("composition" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Company_name_trgm_idx" ON "Company" USING GIN ("name" gin_trgm_ops);
