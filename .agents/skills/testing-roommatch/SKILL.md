---
name: testing-roommatch
description: Test Roommatch feature changes end-to-end. Use when verifying backend/frontend changes, Supabase-backed workflows, or role-based admin/landlord/broker/tenant UI flows.
---

# Roommatch Testing

## Devin Secrets Needed

- `ROOMMATCH_SUPABASE_URL`
- `ROOMMATCH_SUPABASE_ANON_KEY`
- `ROOMMATCH_SUPABASE_SERVICE_KEY`
- `ROOMMATCH_ADMIN_TEST_EMAIL`
- `ROOMMATCH_ADMIN_TEST_PASSWORD`
- `ROOMMATCH_LANDLORD_TEST_EMAIL`
- `ROOMMATCH_LANDLORD_TEST_PASSWORD`
- Broker/tenant test credentials may also be needed for broker or renter UI flows; request them as saved secrets if they are not already available.

## Standard Local Checks

Run these from the repo root after code changes:

```bash
npm --prefix /home/ubuntu/repos/roommatch run test:backend
npm --prefix /home/ubuntu/repos/roommatch run lint:frontend
npm --prefix /home/ubuntu/repos/roommatch run build:frontend
```

The backend test command should finish with all tests passing. The frontend lint/build commands should exit with code 0.

## Supabase Migration Readiness

Before UI testing a feature that adds database objects, verify the target Supabase project has the newest migration applied. Use the service-role Supabase client with secret environment variables and select one row from the new table(s). A missing migration often appears as:

```text
Could not find the table 'public.<table_name>' in the schema cache
```

If a table is missing, do not claim browser E2E passed. Ask the user to run the new `database/migration_v*.sql` file in Supabase SQL Editor, or request appropriate DB access if they want Devin to run DDL.

## Browser Workflow Guidance

- Start backend on `http://localhost:5000` and frontend on `http://localhost:5173`.
- Use admin credentials to verify `/admin/*` workflows.
- Use landlord credentials for room posting/editing workflows.
- Use broker credentials for `/broker/leads`, `/broker/commissions`, and other broker workflows.
- Record browser tests only when actually interacting with the UI; do not record shell-only checks.

## Broker Commission Flow

For commission-related changes:

1. Confirm `broker_leads`, `broker_lead_rooms`, and `broker_commissions` exist in Supabase.
2. As broker, close a lead that has an assigned or recommended room and enter a specific commission amount.
3. Verify `/broker/commissions` shows the amount as pending collection.
4. As admin, open `/admin/commissions`, mark the commission collected, then paid to broker.
5. Verify timestamps/statuses update and the broker page reflects the final status.
