# Aurora Software Labs — WhatsApp Support Bot

This repository upgrades the former RentLog-only ping bot into a multi-product **Aurora Software Labs automated support assistant**. It uses Baileys to link an existing WhatsApp or WhatsApp Business phone as a companion device.

**Important:** Baileys is a third-party, unofficial WhatsApp Web library. Linked-device automation might breach WhatsApp's terms or lead to restrictions. For a long-term public business bot, the official WhatsApp Business Platform Cloud API is preferable.

## What the bot does

- Replies to incoming **one-to-one text messages**. It never initiates messages or responds in groups, broadcasts, channels, or status feeds.
- Offers a numbered menu for **Aurora Software Labs**, **RentLog PRO**, **CropGuard**, **Aurora Crew Hub** and **Aurora Identity Hub**.
- Uses verified public details from the aurorasoftwarelabs, rentlog, cropguard and thecrewid repositories.
- Answers common installation, features, offline-data, events, games and privacy questions with a curated answer library.
- Sends customers to the official Aurora contact form, product intake form, support email and ticket-status page when human support is needed.
- Supports **optional** Groq or OpenRouter AI fallback. No AI key is required to use the normal bot. AI is **off** by default.

This bot does not access customer databases or create tickets. Photos, screenshots, documents and voice notes are not interpreted.

## Step 1 — Local setup on Windows (PowerShell)

Install Node.js 20+ and Git. Then run:

~~~powershell
git clone https://github.com/aurorasoftware-labs/rentlog-whatsapp-bot.git
cd rentlog-whatsapp-bot
npm install
npm run check
npm test
npm start
~~~

The GitHub repository is private: sign in with the GitHub account that has access.

On the phone you want to use for Aurora support, open **WhatsApp / WhatsApp Business → Settings → Linked devices → Link a device** and scan the terminal QR. When linked, the terminal prints **Aurora Software Labs WhatsApp Bot connected**.

### Pair without scanning the QR

For headless hosting, enter the *bot account's* international phone number, country code included, **digits only**:

~~~powershell
$env:PAIRING_PHONE_NUMBER="919876543210"  # Replace with your actual number
npm start
~~~

The console prints a one-time pairing code. In WhatsApp **Linked devices**, select the option to link using a phone number and enter that code. Do not disclose the code. The linked WhatsApp profile name and photo must be changed on the **phone**, not in this code.

### Test it

Message the bot from a **different WhatsApp account**, not the account it is linked to:

1. Send **hi** — the Aurora menu should appear.
2. Send **2**, then **backup** — RentLog backup instructions should appear.
3. Send **3**, then **wheat** — CropGuard's supported crops should appear.
4. Send **4**, then **event** — Crew Hub event guidance should appear.
5. Send **6** — the official human support route should appear.
6. Send **ping** — receive an Aurora-branded pong.

To restrict testing to particular numbers, set the optional ALLOWED_NUMBERS variable to a comma-separated list of allowed numbers. WhatsApp's newer LID-style identities cannot reliably be mapped to phone numbers by this bot, so allowlist testing might need a dedicated number without this filter.

## Step 2 — Put it online with Render

For reliable always-on linked-device operation, use a **paid Render Background Worker with a persistent disk**. Render's free instances do not provide persistent disks and may sleep or restart.

1. Visit https://dashboard.render.com, connect your GitHub account and choose **New → Background Worker**, using this private repository.
2. Choose a Node runtime (Node 20+), a suitable paid worker plan, and **Build Command: npm install** / **Start Command: npm start**.
3. Attach a persistent disk, for example **1 GB**, mounted at **/var/data**.
4. In Render environment settings add **AUTH_DIR=/var/data/auth_info**. This is essential; otherwise re-deploying can erase the WhatsApp session.
5. For headless pairing, optionally add **PAIRING_PHONE_NUMBER** using the full international bot number without spaces or punctuation. In worker **Logs**, follow the pairing instructions and then remove that variable if desired.
6. Deploy. Read the logs until they say **connected**. Send **hi** from a separate WhatsApp account to verify replies.
7. Restart the worker once to check that authentication persists without requiring a new QR or pairing code.

The code also exposes an optional HTTP health endpoint if a hosting platform sets PORT or HEALTH_PORT: **GET /health** (liveness) and **GET /ready** (WhatsApp readiness). A background worker does not require a public web endpoint.

**Render services, disks, phone account linkage and profile settings are not created by GitHub code changes.** You must configure these in Render and on the WhatsApp phone. Do not deploy the bot to a sleeping free service and assume it can answer 24/7.

## Step 3 — Optional AI answers

The deterministic knowledge base works without AI. To enable an external AI fallback in PowerShell:

~~~powershell
$env:AI_PROVIDER="groq"
$env:AI_MODEL="llama-3.3-70b-versatile" # Confirm the available model with Groq
$env:GROQ_API_KEY="YOUR_SECRET_VALUE"
npm start
~~~

Alternatively set **AI_PROVIDER=openrouter**, an **AI_MODEL** supported by OpenRouter, and **OPENROUTER_API_KEY**. Use provider secrets in Render, not source code. To disable: **AI_PROVIDER=off**.

**Privacy:** When AI is enabled, unhandled **message text** is sent to the selected AI service. The code does not send chat IDs, phone numbers, images or message history, but the text itself could contain information typed by the sender. Ensure your privacy notice and consent arrangements cover this transfer. Without AI, question text is processed in the running bot only.

## Environment reference

The [.env.example](.env.example) file lists possible settings. This application reads real **process environment variables** and does not auto-load an .env file.

| Setting | Purpose |
| --- | --- |
| AUTH_DIR | Private folder for WhatsApp linked-device session; use persistent storage |
| PAIRING_PHONE_NUMBER | Optional code-based link; country code plus number, digits only |
| ALLOWED_NUMBERS | Optional testing allowlist, comma-separated |
| LOG_LEVEL | Default warn |
| PORT or HEALTH_PORT | Optional health HTTP server |
| AI_PROVIDER | off (default), groq or openrouter |
| AI_MODEL | Required if using AI; choose a supported provider model |
| GROQ_API_KEY | Secret; required with Groq |
| OPENROUTER_API_KEY | Secret; required with OpenRouter |

Keep sessions and secrets private. The [.gitignore](.gitignore) excludes local authentication and environment files.

## Update the bot

- Change public product facts and supported intents in **src/knowledge.js**.
- Change menu and routing logic in **src/replies.js**.
- Change AI behavior in **src/ai.js** and the safe response rules in **prompt.txt**.
- Run **npm test** and **npm run check** after changes. GitHub Actions runs both checks on branches and pull requests.

Official sources used: https://aurorasoftwarelabs.pages.dev/products , https://rentlogpro.pages.dev/ , https://cropguard.pages.dev/ and the thecrewid repository documentation. Product features and availability can differ by release, customer deployment and permission.

## Troubleshooting

**QR appears every restart:** Ensure AUTH_DIR is on the persistent disk and the folder is writable. Do not commit authentication files to GitHub.

**WhatsApp logged out:** Link the device again from the original phone. Remove old authentication data only when deliberately re-pairing.

**No answer:** Check the connected log; send a direct text from another WhatsApp account; verify that no testing allowlist blocks it. Group and status messages are intentionally ignored.

**AI returns an error or rate limit:** Deterministic bot replies still work. Check API key, provider model and quota; disable AI while investigating.

**Public operation and compliance:** Follow WhatsApp's business messaging rules. For an approved business integration, migrate to the official Cloud API with its webhook, account and message-template requirements rather than relying indefinitely on a linked-device automation library.

## Free Oracle Cloud Always Free deployment

For an Oracle Cloud Ubuntu ARM64 VM, follow the complete **[Oracle Always Free setup guide](deploy/oracle/README.md)**. After you create an Always Free VM and log in, the provided `deploy/oracle/setup.sh` installer configures Node.js, a dedicated systemd service, private credentials, reboot recovery, and persistent WhatsApp authentication. **The bot is not deployed or paired until these steps are completed.**
