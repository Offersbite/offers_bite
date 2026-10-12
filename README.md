# OffersBite

OffersBite uses a React/Vite frontend and a FastAPI backend backed by MongoDB.
Docker setup is intentionally deferred.

## Run locally

1. Start MongoDB locally or provide an Atlas connection URI.
2. In `backend/`, create/activate a virtual environment, install
   `requirements.txt`, then run `python -m uvicorn app.main:app --reload --port 8000`.
3. In `frontend/`, run `npm install` and `npm run dev`.
4. Open the Vite URL (normally [http://localhost:5173](http://localhost:5173)).

The backend loads settings from the project-root `.env` file. Use
`.env.example` as a variable-name template, keeping actual database and OAuth
credentials private. `MONGODB_URI` selects MongoDB; `MONGODB_DATABASE` defaults
to `cardperks`; `COOKIE_SECURE=false` is suitable only for local HTTP. Set
`COOKIE_SECURE=true` behind HTTPS.

Backend startup connects to MongoDB and creates required indexes. It does not
seed or overwrite catalogue data automatically. To load the example catalogue
into MongoDB (existing records with matching IDs are left unchanged), run once
from `backend/`:

```powershell
python -m scripts.seed_catalogue
```

Master-card and offer screens read records from MongoDB through the API; the
example catalogue lives in `backend/data/catalogue.json` only as seed input.

## Accounts and APIs

- `POST /api/auth/register` — begin signup and send a verification code (`202`).
- `POST /api/auth/verify-email` — verify the 4-digit email code and start a session.
- `POST /api/auth/resend-verification` — request another verification code.
- `POST /api/auth/login` — authenticate and start a session.
- `POST /api/auth/logout` — revoke the current session.
- `GET /api/auth/me` — return the signed-in account.
- `GET /api/profile`, `PATCH /api/profile` — read/update the display name.
- `GET /api/cards/master` — read the card catalogue.
- `GET /api/offers?day=0..6&category=FOOD` — read active offers from MongoDB.
- `GET /api/wallet`, `POST /api/wallet`, `DELETE /api/wallet/{card_id}` — manage the signed-in user's cards.
- `GET /api/offers/matched?day=0..6` — list offers unlocked by the user's cards.
- Admin-only `/api/admin` endpoints manage users, card catalogue entries, and offers.

## Administrator access

Create and email-verify an account first. From `backend/`, promote it with:

```powershell
python -m scripts.promote_admin offersbite@gmail.com
```

The admin workspace has separate Users, Cards, and Offers pages. It supports
user search, verified-user role changes, suspension, account creation through
email verification, and account deletion, plus create/update/delete for card
variants and offers. Its management views adapt to mobile screens.
Card and offer records use full-width tables with searchable filters,
pagination, icon actions, and modal create/edit forms. Offer filters include
bank, merchant, card, and valid day. The household wallet keeps its card-style
rows in a full-width searchable list with bank, type, network, and holder
filters, pagination, and a modal to add a card.
Deactivation and deletion revoke sessions; an administrator cannot remove
their own access or delete/demote the last active administrator. Catalogue
cards referenced by a wallet or offer cannot be deleted.

The Offers page supports `.xlsx` bulk uploads across all worksheets. It stores
the original workbook columns and sheet/row provenance with each offer, links
credit/debit offers to matching catalogue cards (creating missing card
variants), and keeps non-card payment offers or unverified schedules out of
card matching. Blank/`N/A` expiry dates are treated as no expiry. Uploads are
limited to 10 MB and 10,000 offer rows; invalid workbooks report row-specific
errors before any rows are written. Re-uploading an identical workbook is
blocked.

The app includes a light/dark theme toggle. The selected theme is saved in the
browser and applied to sign-in and the authenticated workspace.

Passwords are hashed with Argon2. Session tokens are random, stored only as
hashes in MongoDB, and sent to the browser in an HttpOnly, SameSite=Lax cookie
with a 30-day expiry. Sessions are revoked on logout and expire automatically.
Email verification codes are valid for 10 minutes, limited to five attempts,
and have a 60-second resend cooldown. Configure `OTP_HASH_SECRET` with at least
32 random characters. OTP messages are sent through the Gmail API; API
responses never include an OTP.

## Gmail API authorization

1. In Google Cloud, enable Gmail API, configure the OAuth consent screen, and
   add the Gmail account as a test user if the app is in Testing mode.
2. If an OAuth secret was ever shared, revoke/rotate it and use the replacement.
   Store the replacement client ID and secret in the project-root `.env`.
3. For the OAuth Web client, add the exact authorized redirect URI
   `http://localhost:8765/` and set `GOOGLE_REDIRECT_URI` to the same value in
   `.env`.
4. Install backend dependencies, then from `backend/` run:

   ```powershell
   python -m pip install -r requirements.txt
   python -m scripts.authorize_gmail
   ```

   The browser opens Google consent for the `gmail.send` scope. On success, the
   script writes `GOOGLE_REDIRECT_URI` and `GOOGLE_REFRESH_TOKEN` to the
   project-root `.env`.
5. Set `GMAIL_FROM_EMAIL` to the same Gmail account that granted consent and
   set a random `OTP_HASH_SECRET`. Restart the backend after changing `.env`.

All Gmail OAuth settings are read from the project-root `.env`. Do not commit
OAuth client secrets or refresh tokens. Gmail OAuth consent in Testing mode
may cause refresh tokens to expire; if sending stops, authorize again or
publish/configure the OAuth app appropriately. For deployment, inject the same
values through a deployment secret manager.

The `/docs` endpoint provides interactive API documentation. On Windows, use
`python -m uvicorn` rather than the standalone `uvicorn` command if application
control blocks the `uvicorn.exe` launcher.

## MongoDB model

- `users` — account/profile fields with the bounded household wallet embedded.
- `sessions` — separate expiring session records with a TTL index.
- `pending_registrations` — short-lived signup verification challenges with a TTL index.
- `master_cards` — shared card catalogue.
- `merchant_offers` — offer rules, valid days, and applicable card IDs.

The API returns card and offer fields in the existing frontend's expected
snake_case shape; user-supplied IDs are not used to select wallet ownership.
