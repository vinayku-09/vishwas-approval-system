CREATE TABLE "undertakings" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"status" text NOT NULL,
	"due_date" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"undertaking_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"undertaking_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "undertakings_application_idx" ON "undertakings" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "undertakings_status_idx" ON "undertakings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evidence_undertaking_idx" ON "evidence" USING btree ("undertaking_id");--> statement-breakpoint
CREATE INDEX "verifications_undertaking_idx" ON "verifications" USING btree ("undertaking_id");
