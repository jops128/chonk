# Chonk

A mobile character companion for D&D 2024: HP, temporary HP, limited resources,
physical-dice healing, rest resets, ability references, editable stats, and inventory.
The app uses a private secret link, Supabase storage, and GitHub Pages hosting.

## Development

```sh
npm ci
cp .env.example .env.local
npm run dev
npm test
npm run build
```

Set `VITE_SUPABASE_URL` to the project's public URL. The app's demo uses fictional
data and stores changes only on the current device. Real character data and sheet
tokens are never included in the static bundle or public repository.

## Cloud setup

Apply `supabase/migrations/202610140001_character.sql` to the Supabase project.
Deploy `supabase/functions/chonk-sheet` using the CLI, or run
`node scripts/bundle-function.mjs` and paste the generated `.local/chonk-sheet.js`
into the Supabase function editor. The function checks its own secret-link token;
the configuration therefore sets `verify_jwt = false`. The function's server-side
Supabase secret key stays in its runtime environment.

Provision a character server-side with a random 32-byte base64url token. Store only
the SHA-256 hash of that token in `chonk_characters.token_hash`, with a validated
character JSON document in `data`. Give the player the app URL with
`#key=<token>` appended. Anyone with this link can read and edit the character.
The table has RLS enabled and denies the `anon` and `authenticated` roles access.

## Deployment

Set the GitHub repository variable `VITE_SUPABASE_URL`, enable Pages with GitHub
Actions, and push to `main`. The workflow tests and builds the app before deploying.
The Vite base and service-worker scope are `/chonk/`.

Only change the character in the app or through trusted administrative tooling.
Editing stats does not automatically rebuild a character after leveling up;
update resource limits, damage formulas, and reference notes as needed.

## Saving and recovery

Edits are persisted to IndexedDB before saving to cloud. Reopen after a first online
visit to use the sheet offline, then reconnect to sync. Concurrent edits require an
explicit choice between device and cloud versions. Export JSON backups from the
sheet options menu; backups contain character data, without the access token.
Save your secret link separately. A database administrator can rotate access by
replacing the stored token hash with the hash of a new token.
