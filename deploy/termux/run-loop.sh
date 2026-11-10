#!/data/data/com.termux/files/usr/bin/bash
# Restart the bot if Node exits, keeping sessions and secrets outside Git.
set -u
umask 077
APP="$HOME/rentlog-whatsapp-bot"
STATE="$HOME/.local/state/aurora-whatsapp-bot"
CONFIG="$HOME/.config/aurora-whatsapp-bot.env"
mkdir -p "$STATE/auth"
export AUTH_DIR="$STATE/auth"
cd "$APP" || exit 1
while true; do
  if [ -f "$CONFIG" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$CONFIG"
    set +a
  fi
  # Prevent accidentally overriding persistent authentication storage.
  export AUTH_DIR="$STATE/auth"
  if [ -f "$STATE/bot.log" ] && [ "$(wc -c < "$STATE/bot.log")" -gt 10485760 ]; then
    mv -f "$STATE/bot.log" "$STATE/bot.log.old"
  fi
  echo "Starting Aurora bot at $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$STATE/bot.log"
  node index.js >> "$STATE/bot.log" 2>&1
  echo "Bot exited at $(date -u '+%Y-%m-%dT%H:%M:%SZ'); restarting in 20 seconds" >> "$STATE/bot.log"
  sleep 20
done
