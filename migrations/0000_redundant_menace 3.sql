DROP TABLE IF EXISTS "agent_metrics" CASCADE;
DROP TABLE IF EXISTS "agents" CASCADE;
DROP TABLE IF EXISTS "analytics_sessions" CASCADE;
DROP TABLE IF EXISTS "benchmarks" CASCADE;
DROP TABLE IF EXISTS "concessions" CASCADE;
DROP TABLE IF EXISTS "counterparts" CASCADE;
DROP TABLE IF EXISTS "dimension_results" CASCADE;
DROP TABLE IF EXISTS "dimensions" CASCADE;
DROP TABLE IF EXISTS "events" CASCADE;
DROP TABLE IF EXISTS "experiment_runs" CASCADE;
DROP TABLE IF EXISTS "experiments" CASCADE;
DROP TABLE IF EXISTS "influencing_techniques" CASCADE;
DROP TABLE IF EXISTS "interactions" CASCADE;
DROP TABLE IF EXISTS "markets" CASCADE;
DROP TABLE IF EXISTS "negotiation_products" CASCADE;
DROP TABLE IF EXISTS "negotiation_rounds" CASCADE;
DROP TABLE IF EXISTS "negotiation_tactics" CASCADE;
DROP TABLE IF EXISTS "negotiations" CASCADE;
DROP TABLE IF EXISTS "offers" CASCADE;
DROP TABLE IF EXISTS "performance_metrics" CASCADE;
DROP TABLE IF EXISTS "personality_types" CASCADE;
DROP TABLE IF EXISTS "policies" CASCADE;
DROP TABLE IF EXISTS "product_dimension_values" CASCADE;
DROP TABLE IF EXISTS "product_results" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "registrations" CASCADE;
DROP TABLE IF EXISTS "round_states" CASCADE;
DROP TABLE IF EXISTS "simulation_queue" CASCADE;
DROP TABLE IF EXISTS "simulation_runs" CASCADE;
DROP TABLE IF EXISTS "simulations" CASCADE;
DROP TABLE IF EXISTS "negotiation_contexts" CASCADE;
DROP TABLE IF EXISTS "zopa_configurations" CASCADE;
DROP TABLE IF EXISTS "negotiation_dimensions" CASCADE;
DROP TABLE IF EXISTS "tactics" CASCADE;
DROP TABLE IF EXISTS "analyticsSessions" CASCADE;
DROP TABLE IF EXISTS "performanceMetrics" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TYPE IF EXISTS "agent_kind" CASCADE;
DROP TYPE IF EXISTS "agent_role" CASCADE;
DROP TYPE IF EXISTS "counterpart_kind" CASCADE;
DROP TYPE IF EXISTS "event_kind" CASCADE;
DROP TYPE IF EXISTS "negotiation_status" CASCADE;
DROP TYPE IF EXISTS "side" CASCADE;
DROP TYPE IF EXISTS "value_kind" CASCADE;
CREATE TYPE "public"."agent_kind" AS ENUM('llm', 'rule', 'human', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."agent_role" AS ENUM('buyer', 'seller', 'coach', 'observer', 'other');--> statement-breakpoint
CREATE TYPE "public"."counterpart_kind" AS ENUM('retailer', 'manufacturer', 'distributor', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('message', 'action', 'tool');--> statement-breakpoint
CREATE TYPE "public"."negotiation_status" AS ENUM('planned', 'running', 'completed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('buyer', 'seller');--> statement-breakpoint
CREATE TYPE "public"."value_kind" AS ENUM('integer', 'numeric', 'text', 'boolean', 'json');--> statement-breakpoint
CREATE TABLE "agent_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" numeric(10, 4),
	"details" jsonb DEFAULT '{}'::jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid,
	"simulation_id" uuid,
	"role" "agent_role",
	"agent_kind" "agent_kind",
	"model_name" text,
	"system_prompt" text,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policy_id" uuid,
	"hyperparams" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"personality_profile" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_name" text NOT NULL,
	"start_time" timestamp with time zone DEFAULT now(),
	"end_time" timestamp with time zone,
	"total_negotiations" integer DEFAULT 0,
	"successful_negotiations" integer DEFAULT 0,
	"average_duration_ms" integer,
	"total_api_cost" numeric(10, 4),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"dataset" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"field_path" text,
	"before_value" jsonb,
	"after_value" jsonb
);
--> statement-breakpoint
CREATE TABLE "counterparts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "counterpart_kind" NOT NULL,
	"power_balance" numeric(5, 2),
	"style" text,
	"constraints_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dimension_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_run_id" uuid NOT NULL,
	"dimension_name" text NOT NULL,
	"final_value" numeric(15, 4) NOT NULL,
	"target_value" numeric(15, 4) NOT NULL,
	"achieved_target" boolean NOT NULL,
	"priority_score" integer NOT NULL,
	"improvement_over_batna" numeric(15, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dimension_results_unique_run_dimension" UNIQUE("simulation_run_id","dimension_name")
);
--> statement-breakpoint
CREATE TABLE "dimensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"value_type" "value_kind" NOT NULL,
	"unit" text,
	"spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "dimensions_registration_code_unique" UNIQUE("registration_id","code")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"event_kind" "event_kind" NOT NULL,
	"role" text,
	"agent_id" uuid,
	"name" text,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"simulation_id" uuid,
	"batch_label" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_summary" text
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benchmark_id" uuid,
	"name" text NOT NULL,
	"hypothesis" text,
	"design" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencing_techniques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"beschreibung" text NOT NULL,
	"anwendung" text NOT NULL,
	"wichtige_aspekte" jsonb NOT NULL,
	"key_phrases" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"step_no" integer,
	"agent_id" uuid,
	"observation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reward" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"country_code" text,
	"currency_code" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiation_products" (
	"negotiation_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "negotiation_products_negotiation_id_product_id_pk" PRIMARY KEY("negotiation_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "negotiation_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "negotiation_rounds_unique_round" UNIQUE("negotiation_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "negotiation_tactics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"beschreibung" text NOT NULL,
	"anwendung" text NOT NULL,
	"wichtige_aspekte" jsonb NOT NULL,
	"key_phrases" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"market_id" uuid,
	"counterpart_id" uuid,
	"title" text DEFAULT 'Untitled Negotiation',
	"description" text,
	"scenario" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "negotiation_status" DEFAULT 'planned' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"agent_id" uuid,
	"price" numeric(15, 2),
	"quantity" numeric(15, 2),
	"currency_code" text,
	"unit" text,
	"terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"accepted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid,
	"agent_id" uuid,
	"tactic_id" uuid,
	"effectiveness_score" numeric(5, 2),
	"response_time_ms" integer,
	"api_tokens_used" integer,
	"api_cost" numeric(8, 4),
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personality_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archetype" text NOT NULL,
	"behavior_description" text NOT NULL,
	"advantages" text NOT NULL,
	"risks" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "personality_types_archetype_unique" UNIQUE("archetype")
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_dimension_values" (
	"product_id" uuid NOT NULL,
	"dimension_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text,
	"is_current" boolean DEFAULT true,
	CONSTRAINT "product_dimension_values_product_id_dimension_id_measured_at_pk" PRIMARY KEY("product_id","dimension_id","measured_at")
);
--> statement-breakpoint
CREATE TABLE "product_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_run_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"target_price" numeric(15, 4) NOT NULL,
	"min_max_price" numeric(15, 4) NOT NULL,
	"estimated_volume" integer NOT NULL,
	"agreed_price" numeric(15, 4) NOT NULL,
	"price_vs_target" numeric(10, 2),
	"absolute_delta_from_target" numeric(15, 4),
	"price_vs_min_max" numeric(10, 2),
	"absolute_delta_from_min_max" numeric(15, 4),
	"within_zopa" boolean DEFAULT true,
	"zopa_utilization" numeric(5, 2),
	"subtotal" numeric(15, 2) NOT NULL,
	"target_subtotal" numeric(15, 2) NOT NULL,
	"delta_from_target_subtotal" numeric(15, 2),
	"performance_score" numeric(5, 2),
	"dimension_key" text,
	"negotiation_round" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gtin" text,
	"brand" text,
	"category_path" text,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "products_registration_gtin_unique" UNIQUE("registration_id","gtin")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization" text NOT NULL,
	"company" text,
	"country" text,
	"negotiation_type" text,
	"negotiation_frequency" text,
	"goals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"beliefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"intentions" text,
	"internal_analysis" text,
	"batna_assessment" numeric(5, 2),
	"walk_away_threshold" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_states_unique_round" UNIQUE("round_id")
);
--> statement-breakpoint
CREATE TABLE "simulation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"simulation_id" uuid,
	"total_simulations" integer NOT NULL,
	"priority" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"running_count" integer DEFAULT 0,
	"pending_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"estimated_completion_at" timestamp with time zone,
	"max_concurrent" integer DEFAULT 1,
	"current_concurrent" integer DEFAULT 0,
	"estimated_total_cost" numeric(10, 4),
	"actual_total_cost" numeric(10, 4) DEFAULT '0',
	"error_count" integer DEFAULT 0,
	"last_error" text,
	"crash_recovery_checkpoint" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "simulation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid,
	"simulation_id" uuid,
	"queue_id" uuid,
	"technique_id" uuid,
	"tactic_id" uuid,
	"personality_id" text,
	"zopa_distance" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"outcome" text,
	"outcome_reason" text,
	"total_rounds" integer,
	"run_number" integer,
	"execution_order" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"deal_value" numeric(15, 2),
	"other_dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conversation_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actual_cost" numeric(10, 4),
	"cost_efficiency_score" numeric(10, 4),
	"technique_effectiveness_score" numeric(5, 2),
	"tactic_effectiveness_score" numeric(5, 2),
	"tactical_summary" text,
	"langfuse_trace_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"negotiation_id" uuid,
	"name" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"num_rounds" integer,
	"seed" integer,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "agent_metrics" ADD CONSTRAINT "agent_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessions" ADD CONSTRAINT "concessions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparts" ADD CONSTRAINT "counterparts_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dimension_results" ADD CONSTRAINT "dimension_results_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dimensions" ADD CONSTRAINT "dimensions_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_round_id_negotiation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."negotiation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_benchmark_id_benchmarks_id_fk" FOREIGN KEY ("benchmark_id") REFERENCES "public"."benchmarks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_round_id_negotiation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."negotiation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_products" ADD CONSTRAINT "negotiation_products_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_products" ADD CONSTRAINT "negotiation_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_rounds" ADD CONSTRAINT "negotiation_rounds_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_counterpart_id_counterparts_id_fk" FOREIGN KEY ("counterpart_id") REFERENCES "public"."counterparts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_round_id_negotiation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."negotiation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_tactic_id_negotiation_tactics_id_fk" FOREIGN KEY ("tactic_id") REFERENCES "public"."negotiation_tactics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_dimension_values" ADD CONSTRAINT "product_dimension_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_dimension_values" ADD CONSTRAINT "product_dimension_values_dimension_id_dimensions_id_fk" FOREIGN KEY ("dimension_id") REFERENCES "public"."dimensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_results" ADD CONSTRAINT "product_results_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_results" ADD CONSTRAINT "product_results_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_states" ADD CONSTRAINT "round_states_round_id_negotiation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."negotiation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_queue" ADD CONSTRAINT "simulation_queue_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_queue" ADD CONSTRAINT "simulation_queue_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_queue_id_simulation_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."simulation_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_technique_id_influencing_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."influencing_techniques"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_tactic_id_negotiation_tactics_id_fk" FOREIGN KEY ("tactic_id") REFERENCES "public"."negotiation_tactics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_dimension_values_dimension_idx" ON "product_dimension_values" USING btree ("dimension_id");--> statement-breakpoint
CREATE INDEX "product_results_simulation_run_idx" ON "product_results" USING btree ("simulation_run_id");--> statement-breakpoint
CREATE INDEX "product_results_product_idx" ON "product_results" USING btree ("product_id");