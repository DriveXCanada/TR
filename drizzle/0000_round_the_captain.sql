CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"default_unit" text DEFAULT 'g' NOT NULL,
	"unit_cost" numeric(10, 4) DEFAULT '0' NOT NULL,
	"pack_size" numeric(10, 3),
	"pack_unit" text,
	"pack_cost" numeric(10, 2),
	"have_on_hand" numeric(10, 3) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"day" date NOT NULL,
	"slot" text NOT NULL,
	"dish_text" text NOT NULL,
	"verdict" text NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"checked_by" uuid,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_slot_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_slot_id" uuid NOT NULL,
	"recipe_id" uuid,
	"ad_hoc_name" text
);
--> statement-breakpoint
CREATE TABLE "menu_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"day" date NOT NULL,
	"slot" text NOT NULL,
	"servings" integer
);
--> statement-breakpoint
CREATE TABLE "operation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'assistant' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"meal_schedule" jsonb DEFAULT '["breakfast","lunch","supper"]'::jsonb NOT NULL,
	"per_person_per_day" numeric(10, 2) DEFAULT '25.00' NOT NULL,
	"currency" text DEFAULT 'CAD' NOT NULL,
	"kiosk_token" text NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"purge_after" date,
	"status" text DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty_per_serving" numeric(10, 4) DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'g' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'main' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"method" text,
	"burners" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_demands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"ics_role" text NOT NULL,
	"day" date NOT NULL,
	"target" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"volunteer_id" uuid NOT NULL,
	"key" text NOT NULL,
	"severity" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "travel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"volunteer_id" uuid,
	"direction" text NOT NULL,
	"day" date NOT NULL,
	"from_loc" text,
	"to_loc" text,
	"flight" text,
	"dep" text,
	"arr" text,
	"rental" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"pin_hash" text NOT NULL,
	"is_master" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"ics_role" text NOT NULL,
	"phone" text,
	"email" text,
	"on_site" boolean DEFAULT true NOT NULL,
	"arrive_date" date,
	"arrive_meal" text,
	"depart_date" date,
	"depart_meal" text,
	"epipen_carrying" boolean DEFAULT false NOT NULL,
	"epipen_location" text,
	"likes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dislikes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"morale" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"free_note" text,
	"source" text DEFAULT 'lead' NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_checks" ADD CONSTRAINT "meal_checks_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_checks" ADD CONSTRAINT "meal_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_slot_items" ADD CONSTRAINT "menu_slot_items_menu_slot_id_menu_slots_id_fk" FOREIGN KEY ("menu_slot_id") REFERENCES "public"."menu_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_slot_items" ADD CONSTRAINT "menu_slot_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_slots" ADD CONSTRAINT "menu_slots_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_members" ADD CONSTRAINT "operation_members_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_members" ADD CONSTRAINT "operation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_demands" ADD CONSTRAINT "resource_demands_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel" ADD CONSTRAINT "travel_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel" ADD CONSTRAINT "travel_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_slots_op_day_slot_idx" ON "menu_slots" USING btree ("operation_id","day","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "operation_members_op_user_idx" ON "operation_members" USING btree ("operation_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operations_kiosk_token_idx" ON "operations" USING btree ("kiosk_token");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_demands_op_role_day_idx" ON "resource_demands" USING btree ("operation_id","ics_role","day");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");