# Run the Aurora Software Labs WhatsApp bot on an Android phone (Termux)

**Cost: no monthly cloud hosting fee.** This uses the existing Baileys-based Node.js bot as a WhatsApp linked device. It does not require root, a public IP address, port forwarding, Oracle Cloud or Render.

**Limitations:** Android/Samsung may terminate background processes even after battery exemptions. The bot cannot reply if the phone is off, offline, out of battery, or Termux is stopped. This is best for trials and modest-volume support, not business-critical 24/7 uptime. Baileys is an unofficial library and using unofficial WhatsApp clients could restrict your account. For long-term business use, consider Meta's official Cloud API.

## 1. Install the Android apps

- Install **Termux** from https://f-droid.org/packages/com.termux/ (preferred) or an official Termux GitHub release.
- Install **Termux:Boot** from https://f-droid.org/packages/com.termux.boot/ to start the bot after a phone restart. Termux and Termux:Boot **must be from the same distribution source** (e.g., both F-Droid); otherwise Android signature checks may block installation.
- Launch **Termux:Boot once** by tapping its icon so Android grants its boot permission.
- On Samsung, open **Settings → Apps → Termux → Battery → Unrestricted**, and **Settings → Battery → Background usage limits → Never sleeping apps**, then add Termux and Termux:Boot where the device permits. Don't put either app into Deep sleeping apps. Menu paths may vary.

Avoid the experimental Termux Play Store build for this setup unless you understand its limitations.

## 2. Install packages using Termux

Open Termux and enter:

    pkg update && pkg upgrade -y
    pkg install -y git gh nodejs-lts npm tmux
    node -v

Node must be v20 or newer. If a package isn't available, use the Termux package manager to select a working mirror and retry.

## 3. Clone the private bot repository

    gh auth login
    gh repo clone aurorasoftware-labs/rentlog-whatsapp-bot
    cd ~/rentlog-whatsapp-bot
    npm install
    npm run check
    npm test

Use the **GitHub browser login/device verification** flow; never paste tokens into scripts or chats. This repository is private, so a signed-in GitHub account with access is necessary.

## 4. Configure WhatsApp pairing

Create a private config file **outside the repository**:

    mkdir -p ~/.config
    nano ~/.config/aurora-whatsapp-bot.env

Insert the following, replacing the example with **your bot WhatsApp phone number** (country code + number, digits only):

    PAIRING_PHONE_NUMBER=919876543210
    AI_PROVIDER=off
    LOG_LEVEL=warn

Save: **Ctrl+O**, **Enter**, then **Ctrl+X**. Secure the file:

    chmod 600 ~/.config/aurora-whatsapp-bot.env

This config is loaded automatically by the included Termux startup runner. You don't need AI keys: the built-in product FAQ works without them.

## 5. Start the bot

    bash ~/rentlog-whatsapp-bot/deploy/termux/start.sh
    tail -n 80 -f ~/.local/state/aurora-whatsapp-bot/bot.log

Wait for **WhatsApp pairing code** to appear. On the WhatsApp account that will be used as Aurora support, open **Linked devices → Link a device → Link with phone number instead** (availability can vary by app/account version) and enter the displayed one-time code. WhatsApp may show a confirmation prompt.

You can run both Termux and the primary WhatsApp/WhatsApp Business app on the **same Android phone**, switching between them to enter the code. If that linking method is not offered, use the standard QR method and scan the QR displayed on **another screen** using the WhatsApp phone.

Once linked, the logs should say **Aurora Software Labs WhatsApp Bot connected**. Do not post pairing codes or full logs publicly; log files may temporarily contain the pairing code. Use **Ctrl+C** to leave the log viewer; the bot will continue inside tmux.

Credentials are saved to **~/.local/state/aurora-whatsapp-bot/auth**, in Termux private app storage. They survive ordinary app restarts and phone reboots, but **uninstalling Termux, clearing its data or resetting the phone destroys this storage**. Keep only encrypted backups of the session and treat them like passwords.

## 6. Start the bot automatically after reboot

Install Termux:Boot and open it once as described in Step 1. Then, in Termux:

    mkdir -p ~/.termux/boot
    cat > ~/.termux/boot/start-aurora-bot <<'EOF'
    #!/data/data/com.termux/files/usr/bin/bash
    bash "$HOME/rentlog-whatsapp-bot/deploy/termux/start.sh"
    EOF
    chmod +x ~/.termux/boot/start-aurora-bot

**Important:** When pasting this multiline block, remove any leading spaces before the three lines within the heredoc if your terminal adds them. The closing EOF must be on its own line.

The startup launcher calls **termux-wake-lock** and starts one named tmux session. The session's runner restarts Node after crashes, as long as Android has not killed Termux itself. A wake lock can increase battery consumption; keep the phone cool and avoid prolonged unsafe charging.

## 7. Test and manage

Send a direct **hi** from a **different WhatsApp number**. Test **2** then **backup**, **4** then **event**, and **6** for support. The bot intentionally ignores group messages.

Commands in Termux:

    # Read the last 100 log lines (may contain pairing codes)
    tail -n 100 ~/.local/state/aurora-whatsapp-bot/bot.log

    # See the running session
    tmux list-sessions

    # Stop the bot
    tmux kill-session -t aurora-whatsapp-bot

    # Start it again
    bash ~/rentlog-whatsapp-bot/deploy/termux/start.sh

    # Update from GitHub
    tmux kill-session -t aurora-whatsapp-bot
    cd ~/rentlog-whatsapp-bot
    git pull --ff-only
    npm install
    npm test
    bash deploy/termux/start.sh

When finished pairing, you can remove PAIRING_PHONE_NUMBER from the private config and restart the tmux session. Keep WhatsApp installed and the primary account active; periodically check the **Linked devices** list in WhatsApp.

## Troubleshooting

- **App starts but WhatsApp is offline:** Check the logs, internet access, WhatsApp linked-device status and battery settings. Android may suspend background processes.
- **No pairing code:** Confirm PAIRING_PHONE_NUMBER includes a valid international number. This project uses Baileys, so changes in WhatsApp's login flow can break third-party pairing without warning.
- **npm install fails on Android:** Some transitive dependencies may be incompatible with Termux even though the app works on ordinary Linux. Send the sanitized error (never keys, codes, full session files) and we can adjust the dependencies. Installation has not been verified on every Android/Termux release.
- **Frequent disconnects:** Stay on stable Wi-Fi or mobile data, disable restrictive data saver for Termux, and avoid rebooting/force-stopping the phone while relying on the bot.
- **Need guaranteed availability:** Migrate to the official Meta WhatsApp Cloud API hosted on a webhook service; a personal Android phone is not a guaranteed always-on server.

Official references:
- https://github.com/termux/termux-app
- https://github.com/termux/termux-boot
- https://faq.whatsapp.com/1324084875126592/
