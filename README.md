# Hey Culligan Man

A browser-playable version of the 1965 shifting-pipeline board game.

## Play Locally

Open `index.html` in a browser, or serve the folder with any static file server.

## Build The Deploy Folder

Run:

```sh
./build.sh
```

This creates `dist/` with only the files needed by the live game. Generator scripts, slicers, source scans, and backups stay out of the published site.

## Deploy The Game

The game is a static site. Deploy the repository root to Cloudflare Pages, GitHub Pages, Netlify, or any static host.

Recommended:

1. Push this folder to GitHub.
2. Create a Cloudflare Pages project from the repo.
3. Use `./build.sh` as the build command.
4. Use `dist` as the output directory.
5. Add your custom domain in Cloudflare Pages.

## Online Multiplayer

Online rooms use WebRTC. The browser game needs a small Cloudflare Worker only for invite-code signaling.

The worker source lives in `workers/`.

Basic flow:

1. Create a Cloudflare KV namespace.
2. Put the KV namespace id in `workers/wrangler.toml`.
3. Deploy the Worker with Wrangler.
4. In the game, choose Online Multiplayer and paste the Worker URL when prompted.

The game remembers the signaling URL in local storage.

## Development Checks

Run:

```sh
node --check script.js
node sanity-check.js
```

`sanity-check.js` validates tile data, rotation behavior, one-shot Soft Water turns, finish behavior, and the initial route.
