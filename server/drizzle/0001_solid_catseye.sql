ALTER TABLE "work_activities" ADD COLUMN "notion_page_id" text;--> statement-breakpoint
ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_notion_page_id_unique" UNIQUE("notion_page_id");