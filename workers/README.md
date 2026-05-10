# Hey Culligan Signaling Worker

This Worker only handles short invite codes for WebRTC setup. Gameplay still runs in the browsers.

## Deploy Sketch

1. Create a Cloudflare KV namespace.
2. Put that namespace id into `wrangler.toml`.
3. From this `workers` folder, deploy with Wrangler.
4. In the game, click `Host Online` and paste the deployed Worker URL when prompted.

Room codes expire after one hour.
