CREATE TABLE "kit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'ppe' NOT NULL,
	"issue_policy" text DEFAULT 'single_use' NOT NULL,
	"interval_days" integer DEFAULT 1 NOT NULL,
	"qty_per_person" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit" text DEFAULT 'each' NOT NULL,
	"size_scheme" text,
	"stock_on_hand" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lead_time_days" integer DEFAULT 2 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kit_items" ADD CONSTRAINT "kit_items_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;