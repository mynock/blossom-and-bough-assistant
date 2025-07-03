CREATE TABLE "plant_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_activity_id" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plant_list" ADD CONSTRAINT "plant_list_work_activity_id_work_activities_id_fk" FOREIGN KEY ("work_activity_id") REFERENCES "public"."work_activities"("id") ON DELETE no action ON UPDATE no action;