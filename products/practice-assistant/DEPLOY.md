# Deploying the demo (Fly.io)

One-time setup — exact commands, run from `products/practice-assistant/`:

```bash
# 1. Install flyctl and sign up/log in (free tier is fine for the demo)
curl -L https://fly.io/install.sh | sh
fly auth signup        # or: fly auth login

# 2. Create the app (name must be globally unique — change it in fly.toml too
#    if "bams-practice-assistant" is taken)
fly apps create bams-practice-assistant

# 3. Set the only required secret
fly secrets set ANTHROPIC_API_KEY=sk-ant-...   # from console.anthropic.com

# 4. Ship it
fly deploy

# 5. Open the live demo
fly open                # → https://bams-practice-assistant.fly.dev
```

The root URL redirects to the demo page (`/widget/demo.html`), which embeds the
widget against the Lakeside Dental mock EMR — safe to hand to any prospect.

## Custom domain (demo.bamstechnology.com)

```bash
fly certs add demo.bamstechnology.com
```

Then in Cloudflare DNS for bamstechnology.com, add a `CNAME` record:
`demo` → `bams-practice-assistant.fly.dev`, **DNS-only (grey cloud)** so
Fly can issue the certificate. When `fly certs check demo.bamstechnology.com`
shows verified, the demo is live at https://demo.bamstechnology.com.

## Later: adding a real client

```bash
# athenahealth sandbox credentials for the sunrise example client
fly secrets set SUNRISE_ATHENA_CLIENT_ID=... SUNRISE_ATHENA_CLIENT_SECRET=...
fly deploy
```

Each new practice = a JSON file in `clients/` + its EMR credential secrets.
Redeploys pick up new configs automatically (they're baked into the image).

## Notes

- Machines auto-stop when idle (`min_machines_running = 0`), so the demo costs
  ~nothing between visits; first request after idle takes a few seconds.
- Demo tier keeps in-memory sessions — a machine restart drops active chats.
  That's fine for a demo; a paying pilot needs the persistence work in the
  README's HIPAA section first.
- `AUDIT_LOG_PATH` is unset in the demo, so audit lines go to `fly logs`.
```
