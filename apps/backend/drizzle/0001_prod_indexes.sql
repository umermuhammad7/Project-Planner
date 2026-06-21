CREATE INDEX "idx_event_members_member" ON "event_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_chores_assigned_to" ON "chores" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_reward_prizes_family" ON "reward_prizes" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_recipes_family" ON "recipes" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plan_items_plan" ON "meal_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_family" ON "notifications" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_connections_user" ON "calendar_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_connections_family" ON "calendar_connections" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_ai_conversations_user" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_conversations_family" ON "ai_conversations" USING btree ("family_id");
