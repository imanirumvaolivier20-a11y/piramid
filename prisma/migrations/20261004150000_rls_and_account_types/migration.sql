-- ───────────── Account types ─────────────
-- Lookup rows live in a migration so every environment has them.
INSERT INTO "AccountType"
  ("key", "label", "description", "sortOrder", "selectable", "canOwnProjects", "canBeHired", "canManageWorkers")
VALUES
  ('COMPANY',   'Construction Company',               'Run several projects with your own team.',            1, true, true,  true,  true),
  ('ENGINEER',  'Individual Engineer',                'Freelance engineer working across client projects.',  2, true, true,  true,  true),
  ('WORKER',    'Construction Company Worker',        'Join a company using its invite code.',               3, true, false, false, false),
  ('HOMEOWNER', 'Individual — Building My Own House', 'Follow and control the construction of your house.',  4, true, true,  false, true),
  ('ARCHITECT', 'Architect',                          'Design and supervise projects for clients.',          5, true, false, true,  false),
  ('SUPPLIER',  'Material / Hardware Supplier',       'Supply materials to construction projects.',          6, true, false, false, false)
ON CONFLICT ("key") DO NOTHING;

-- ───────────── Row-level security ─────────────
-- The app runs tenant queries as the non-privileged role `piramid_app`
-- (via SET LOCAL ROLE) with `app.user_id` set to the signed-in user.
-- See src/lib/db.ts.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'piramid_app') THEN
    CREATE ROLE piramid_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO piramid_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO piramid_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO piramid_app;

CREATE FUNCTION app_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')
$$;

-- The helpers below are SECURITY DEFINER so they can read across tables
-- without re-triggering the policies that call them.

CREATE FUNCTION app_account_ids() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg("accountId"), '{}')
  FROM "Membership"
  WHERE "userId" = app_user_id()
$$;

-- True when the user reaches a project they do not own:
-- through a pending/active contract, or as an assigned worker.
CREATE FUNCTION app_has_project_link(pid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Contract" c
    WHERE c."projectId" = pid
      AND c."status" IN ('PENDING', 'ACTIVE')
      AND c."contractorAccountId" = ANY (app_account_ids())
  ) OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "Worker" w ON w."id" = pm."workerId"
    WHERE pm."projectId" = pid AND w."userId" = app_user_id()
  )
$$;

CREATE FUNCTION app_can_access_project(pid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p."id" = pid AND p."accountId" = ANY (app_account_ids())
  ) OR app_has_project_link(pid)
$$;

CREATE FUNCTION app_can_access_report(rid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "DailyReport" r
    WHERE r."id" = rid AND app_can_access_project(r."projectId")
  )
$$;

-- Workers from another account's roster are visible once they are
-- assigned to a project the user can access.
CREATE FUNCTION app_can_see_worker(wid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."workerId" = wid AND app_can_access_project(pm."projectId")
  )
$$;

ALTER TABLE "Project"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyReport"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyReportPhoto"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyReportMaterial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyReportWage"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Worker"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkerCategory"      ENABLE ROW LEVEL SECURITY;

-- Only the owning account may create or change a project.
CREATE POLICY tenant_isolation ON "Project" TO piramid_app
  USING ("accountId" = ANY (app_account_ids()) OR app_has_project_link("id"))
  WITH CHECK ("accountId" = ANY (app_account_ids()));

-- A contractor keeps seeing its own contracts after they end.
CREATE POLICY tenant_isolation ON "Contract" TO piramid_app
  USING (app_can_access_project("projectId") OR "contractorAccountId" = ANY (app_account_ids()));

CREATE POLICY tenant_isolation ON "ProjectMember" TO piramid_app
  USING (app_can_access_project("projectId"));

CREATE POLICY tenant_isolation ON "DailyReport" TO piramid_app
  USING (app_can_access_project("projectId"));

CREATE POLICY tenant_isolation ON "Expense" TO piramid_app
  USING (app_can_access_project("projectId"));

CREATE POLICY tenant_isolation ON "DailyReportPhoto" TO piramid_app
  USING (app_can_access_report("reportId"));

CREATE POLICY tenant_isolation ON "DailyReportMaterial" TO piramid_app
  USING (app_can_access_report("reportId"));

CREATE POLICY tenant_isolation ON "DailyReportWage" TO piramid_app
  USING (app_can_access_report("reportId"));

CREATE POLICY tenant_isolation ON "Worker" TO piramid_app
  USING ("accountId" = ANY (app_account_ids()) OR app_can_see_worker("id"))
  WITH CHECK ("accountId" = ANY (app_account_ids()));

CREATE POLICY tenant_isolation ON "WorkerCategory" TO piramid_app
  USING ("accountId" = ANY (app_account_ids()));
