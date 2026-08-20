# my-vinyls

My vinyl collection, rendered from my Discogs collection.

![preview](docs/preview.png)

## How it works

```
Discogs API ──► packages/discogs (scheduled scrape) ──► list.json ──► apps/web (Next.js, static)
```

A GitHub Actions job scrapes the collection weekly and opens a PR with the
updated `list.json`. The web app imports that file at build time, so every page
is prerendered — there is no Discogs call at request time, and the site has no
runtime dependency on Discogs being up.

Committing the data is deliberate. It's ~100 KB that changes every month or two,
and the PR doubles as a review step: when a new artist shows up without a country
or alias mapping, it's visible in the diff and can be fixed in the same PR.

## Layout

| Path                | What it is                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| `apps/web`          | Next.js + Tailwind + shadcn/ui front end                                 |
| `packages/discogs`  | Discogs scraper, plus the `VinylRecord` type both sides share            |
| `list.json`         | The collection, written by the scraper and read by the app at build time |

`packages/discogs/src/types.ts` is the single source of truth for the record
shape — the web app imports it rather than redeclaring it.

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev         # http://localhost:3000
pnpm test        # unit tests
pnpm typecheck
pnpm lint
pnpm build
```

### Refreshing the collection locally

```bash
cp packages/discogs/.env.dev packages/discogs/.env   # fill in your token
pnpm --filter @my-vinyls/discogs build
pnpm --filter @my-vinyls/discogs gen
```

Get a personal access token from <https://www.discogs.com/settings/developers>.

## Deploying

Vercel, with **Root Directory** set to `apps/web`. Keep *Include files outside
the root directory in the Build Step* enabled (it is by default) — the build
reads `list.json` from the repository root.

## Currency

Prices are recorded in whatever currency the record was bought in. The scraper
resolves each non-KRW purchase to KRW using the exchange rate **on the purchase
date** and stores it as `purchase.priceKrw`, so the app never does currency
maths and totals don't drift as rates move.

Resolved rates are cached in `packages/discogs/fx-rates.json` and committed.
Historical rates never change, so a rate is looked up once and reused forever,
which keeps `list.json` stable between scrapes. If a lookup fails for a new
purchase, a fixed fallback rate is used and left uncached so a later run
corrects it.

## Curation

`packages/discogs/src/constants.ts` holds three hand-maintained maps:

- `ARTIST_ALIAS` — display an artist under their native-script name
- `ARTIST_COUNTRY` / `ALBUM_COUNTRY` — power the *country* grouping

New artists won't have entries. The scrape PR is where you notice and add them.

## Notes for future work

Pointing this at somebody else's collection is not just a config change:

- `purchase.*` comes from **custom collection fields**, whose ids are specific to
  one Discogs account (`PURCHASE_FIELD` in `discogs-parser.ts`). Another user's
  fields have different ids, or don't exist. Resolving them by name via
  `GET /users/{username}/collection/fields` would be the first step.
- Collection notes are private by default, so those fields aren't readable for
  most users without OAuth.
- Discogs uses **OAuth 1.0a**, which has no first-party Auth.js provider.
- Public collections (folder `0`) *are* readable with just an app token, which is
  a much cheaper route to browsing another user's shelf — minus purchase data.

`apps/web/lib/collection.ts` is the seam: everything the UI needs comes from
`getCollection()`, so an alternative source plugs in there.

## Credits

Originally forked from [BayernMuller/vinyl](https://github.com/BayernMuller/vinyl)
and since rewritten from Streamlit to Next.js.
