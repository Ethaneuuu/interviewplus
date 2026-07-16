#!/bin/zsh
set -e

cd "$(dirname "$0")"

CONFIG_FILE=".interviewplus-local.env"
DEFAULT_PORT="4173"

if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" <<EOF
PORT="$DEFAULT_PORT"
EOF
  echo "Configuration locale creee dans $CONFIG_FILE."
fi

source "$CONFIG_FILE"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" && -x "/Applications/Codex.app/Contents/Resources/node" ]]; then
  NODE_BIN="/Applications/Codex.app/Contents/Resources/node"
fi
if [[ -z "$NODE_BIN" && -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  NODE_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js est introuvable."
  echo "Installe Node avec: brew install node"
  echo "Puis relance ce fichier."
  read "PAUSE?Appuie sur Entree pour fermer..."
  exit 1
fi

echo "Lancement InterviewPlus..."
echo "URL site: http://localhost:${PORT:-4173}/"
echo "Correction: moteur semantique local et gratuit"
echo ""

"$NODE_BIN" serve-local.mjs --port "${PORT:-4173}" &

SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' INT TERM EXIT

for _ in {1..50}; do
  if curl -fsS "http://localhost:${PORT:-4173}/" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    wait "$SERVER_PID"
    exit $?
  fi
  sleep 0.2
done

open "http://localhost:${PORT:-4173}/" >/dev/null 2>&1 || true
wait "$SERVER_PID"
