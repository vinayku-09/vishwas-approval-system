CREATE TABLE "course_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"application_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"undertaking_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposed_branches" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"id" text PRIMARY KEY NOT NULL,
	"pathname" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" text NOT NULL,
	"institution_id" text NOT NULL,
	"region" text NOT NULL,
	"is_draft" integer DEFAULT 1 NOT NULL,
	"uploaded_at" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "undertakings" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"status" text NOT NULL,
	"due_date" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"undertaking_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "course_proposals_institution_idx" ON "course_proposals" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "course_proposals_application_idx" ON "course_proposals" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "course_proposals_status_idx" ON "course_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evidence_undertaking_idx" ON "evidence" USING btree ("undertaking_id");--> statement-breakpoint
CREATE INDEX "proposed_branches_proposal_idx" ON "proposed_branches" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "stored_files_institution_idx" ON "stored_files" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "stored_files_region_idx" ON "stored_files" USING btree ("region");--> statement-breakpoint
CREATE INDEX "stored_files_sha256_idx" ON "stored_files" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "stored_files_pathname_idx" ON "stored_files" USING btree ("pathname");--> statement-breakpoint
CREATE INDEX "undertakings_application_idx" ON "undertakings" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "undertakings_status_idx" ON "undertakings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "verifications_undertaking_idx" ON "verifications" USING btree ("undertaking_id");