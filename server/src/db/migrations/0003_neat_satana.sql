ALTER TABLE "customers" ADD COLUMN "account_number" varchar(50);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customers_account_number" ON "customers" USING btree ("account_number");