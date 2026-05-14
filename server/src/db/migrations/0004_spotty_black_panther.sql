ALTER TABLE "customers" ADD COLUMN "customer_group" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_customers_customer_group" ON "customers" USING btree ("customer_group");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customer_group_check" CHECK ("customers"."customer_group" IN (1, 2, 3, 4));