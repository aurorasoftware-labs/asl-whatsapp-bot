#!/usr/bin/env bash
# Oracle Cloud Ubuntu ARM64 installer for Aurora Software Labs WhatsApp bot
# From the repository root: sudo bash deploy/oracle/setup.sh
set -Eeuo pipefail

APP=/opt/aurora-whatsapp-bot
STATE=/var/lib/aurora-whatsapp-bot
CONF=/etc/aurora-whatsapp-bot
SERVICE=aurora-whatsapp-bot
SOURCE="$(cd "$(dirname "$0")/../.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Use sudo to run this installer." >&2; exit 1; fi
if [ ! -f "$SOURCE/package.json" ]; then echo "Run this inside the bot repository." >&2; exit 1; fi
. /etc/os-release
if [ "$ID" != ubuntu ]; then echo "Ubuntu 22.04 or 24.04 required." >&2; exit 1; fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg rsync
MAJOR=0
if command -v node >/dev/null 2>&1; then
  MAJOR="$(node -p 'parseInt(process.versions.node.split(".")[0],10)' || echo 0)"
fi
if [ "$MAJOR" -lt 22 ]; then
  install -d -m 755 /etc/apt/keyrings
  curl --proto '=https' --tlsv1.2 -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  chmod 644 /etc/apt/keyrings/nodesource.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi

if ! id aurorabot >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "$STATE" --shell /usr/sbin/nologin aurorabot
fi
install -d -m 755 -o root -g root "$APP"
install -d -m 700 -o aurorabot -g aurorabot "$STATE" "$STATE/auth"
install -d -m 750 -o root -g aurorabot "$CONF"

if [ ! -f "$CONF/aurora.env" ]; then
  cat > "$CONF/aurora.env" <<'ENV'
AUTH_DIR=/var/lib/aurora-whatsapp-bot/auth
LOG_LEVEL=warn
AI_PROVIDER=off
# To pair, add PAIRING_PHONE_NUMBER=COUNTRYCODEPHONENUMBER (digits only).
# Optional AI keys belong here, not in GitHub.
ENV
fi
chown root:aurorabot "$CONF/aurora.env"
chmod 640 "$CONF/aurora.env"

systemctl stop "$SERVICE" 2>/dev/null || true
# No Git credentials, local .env files or WhatsApp session are deployed.
rsync -a --delete --exclude='.git/' --exclude='node_modules/' \
  --exclude='auth_info/' --exclude='.env' --exclude='.env.*' \
  "$SOURCE/" "$APP/"
chown -R aurorabot:aurorabot "$APP"
runuser -u aurorabot -- npm --prefix "$APP" install --omit=dev --no-audit --no-fund
runuser -u aurorabot -- npm --prefix "$APP" run check
runuser -u aurorabot -- npm --prefix "$APP" test
chown -R root:root "$APP"

cat > /etc/systemd/system/aurora-whatsapp-bot.service <<'UNIT'
[Unit]
Description=Aurora Software Labs WhatsApp Support Bot
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=aurorabot
Group=aurorabot
WorkingDirectory=/opt/aurora-whatsapp-bot
EnvironmentFile=/etc/aurora-whatsapp-bot/aurora.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/aurora-whatsapp-bot/index.js
Restart=always
RestartSec=15
UMask=0077
NoNewPrivileges=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/aurora-whatsapp-bot
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
chmod 644 /etc/systemd/system/aurora-whatsapp-bot.service
systemctl daemon-reload
systemctl enable --now "$SERVICE"
echo "Installed. WhatsApp session: $STATE/auth"
echo "Configure pairing: sudo nano $CONF/aurora.env"
echo "Restart: sudo systemctl restart $SERVICE"
echo "Read logs: sudo journalctl -u $SERVICE -n 80 -f"
