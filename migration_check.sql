CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;
DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'finance') THEN
        CREATE SCHEMA finance;
    END IF;
END $EF$;

CREATE TABLE finance.financial_reports (
    "Id" uuid NOT NULL,
    user_id uuid NOT NULL,
    original_filename text NOT NULL,
    file_size_kb integer,
    report_type text NOT NULL,
    period text,
    status text NOT NULL,
    output_pdf_url text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT "PK_financial_reports" PRIMARY KEY ("Id")
);

CREATE TABLE public.plans (
    "Id" uuid NOT NULL,
    name text NOT NULL,
    description text,
    monthly_coin_allowance integer NOT NULL,
    price_usd numeric NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT "PK_plans" PRIMARY KEY ("Id")
);

CREATE TABLE public.users (
    "Id" uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    company_name text,
    locale text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT "PK_users" PRIMARY KEY ("Id")
);

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250916104045_InitialCreate', '9.0.9');

COMMIT;

