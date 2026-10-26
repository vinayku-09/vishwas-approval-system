CREATE TABLE "affiliations" (
	"id" text PRIMARY KEY NOT NULL,
	"inspector_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"application_id" text NOT NULL,
	"created_at" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"created_at" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text NOT NULL,
	"region" text NOT NULL,
	"created_at" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspectors" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"chain_index" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"created_at" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"recipient_role" text,
	"region" text,
	"institution_name" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signoffs" (
	"application_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "affiliations_inspector_idx" ON "affiliations" USING btree ("inspector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_logs_idempotency_key_uq" ON "alert_logs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "alert_logs_application_idx" ON "alert_logs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "compliance_documents_application_idx" ON "compliance_documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "documents_application_idx" ON "documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "escalations_status_idx" ON "escalations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escalations_region_idx" ON "escalations" USING btree ("region");--> statement-breakpoint
CREATE INDEX "inspections_application_idx" ON "inspections" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "inspectors_domain_idx" ON "inspectors" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_application_index_uq" ON "ledger" USING btree ("application_id","chain_index");--> statement-breakpoint
CREATE INDEX "ledger_application_idx" ON "ledger" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_key_uq" ON "notifications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");