ALTER TABLE "customers" ADD COLUMN "customer_code" varchar(50);--> statement-breakpoint
CREATE INDEX "idx_customers_customer_code" ON "customers" USING btree ("customer_code");