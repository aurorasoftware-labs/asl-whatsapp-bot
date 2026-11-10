#!/data/data/com.termux/files/usr/bin/bash
# Run this from Termux; also suitable for the Termux:Boot launcher.
set -euo pipefail

APP="$HOME/rentlog-whatsapp-bot"
SESSION="aurora-whatsapp-bot"

if [ ! -f "$APP/index.js" ]; then
  echo "Bot not found in $APP. Follow deploy/termux/README.md first." >&2
  exit 1
fi
if ! command -v tmux >/dev/null 2>&1; then
  echo "Install tmux first: pkg install tmux" >&2
  exit 1
fi
termux-wake-lock
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Aurora bot already started in tmux session $SESSION"
  exit 0
fi
tmux new-session -d -s "$SESSION" "$PREFIX/bin/bash '$APP/deploy/termux/run-loop.sh'"
echo "Aurora bot launched. View logs with:"
echo "tail -n 60 -f '$HOME/.local/state/aurora-whatsapp-bot/bot.log'"
