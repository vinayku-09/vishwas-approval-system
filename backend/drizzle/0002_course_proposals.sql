CREATE TABLE "course_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"application_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposed_branches" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "course_proposals_institution_idx" ON "course_proposals" USING btree ("institution_id");
--> statement-breakpoint
CREATE INDEX "course_proposals_application_idx" ON "course_proposals" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "course_proposals_status_idx" ON "course_proposals" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "proposed_branches_proposal_idx" ON "proposed_branches" USING btree ("proposal_id");
