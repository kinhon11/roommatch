---
name: testing-roommatch
description: Test RoommieMatch locally through the UI and core checks. Use when verifying landlord, admin, tenant, broker, room posting, deposit, appointment, or marketplace flows.
---

# RoommieMatch Testing

## Devin Secrets Needed

- `ROOMMATCH_SUPABASE_URL`
- `ROOMMATCH_SUPABASE_ANON_KEY`
- `ROOMMATCH_SUPABASE_SERVICE_KEY`
- `ROOMMATCH_LANDLORD_TEST_EMAIL`
- `ROOMMATCH_LANDLORD_TEST_PASSWORD`
- `ROOMMATCH_ADMIN_TEST_EMAIL`
- `ROOMMATCH_ADMIN_TEST_PASSWORD`

Do not write secret values into repo files. Local `.env` files may already exist in a session; verify key presence without printing values.

## Local setup checks

From the repo root, install dependencies if needed:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Run the full verified check command:

```bash
npm --prefix /home/ubuntu/repos/roommatch test
```

This runs encoding checks, backend tests, frontend lint, and frontend build.

## Running the app locally

Start backend:

```bash
npm --prefix /home/ubuntu/repos/roommatch/backend run dev
```

Start frontend:

```bash
npm --prefix /home/ubuntu/repos/roommatch/frontend run dev -- --host 0.0.0.0
```

Open `http://localhost:5173/login` in the browser. Use the secure secret substitution for test account credentials.

## Landlord post-room flow

- Log in as the landlord test account.
- Landlord login should redirect to `/landlord/dashboard`.
- Use the navbar `Đăng tin` link or open `/landlord/post`.
- Fill required fields: title, price, address, city, and description.
- For deposit-related changes, verify `Tiền cọc yêu cầu` directly after editing `Giá thuê (VNĐ/tháng)`.
- Submit with `Đăng tin ngay`.
- Success should show `Đăng tin thành công! Bài đang chờ Admin duyệt.` and then navigate to `/landlord/my-rooms`.
- The new room should appear with status `Chờ duyệt`.

## Database verification pattern

For post-room tests, it is useful to query Supabase with the service key from backend `.env` and select only non-secret fields such as `title`, `price`, `deposit_amount`, and `status`. Do not print credentials.
