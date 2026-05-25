CREATE TABLE "qbo_credentials" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"realm_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
