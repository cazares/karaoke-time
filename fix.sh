#!/usr/bin/env bash
# fix.sh — RN master fixer/runner for Mixterious (idempotent, self-healing)
set -euo pipefail

DEFAULT_SIM="iPhone 17 Pro"
DEFAULT_PORT="${PREFERRED_PORT:-8081}"
MAX_PORT_TRIES=5
DO_YARN=1
DO_PODS=1
SIM_NAME="$DEFAULT_SIM"
METRO_PORT="$DEFAULT_PORT"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'
log(){ printf "%s%s%s\n" "$1" "$2" "$NC"; }
have(){ command -v "$1" >/dev/null 2>&1; }

while (("$#")); do
  case "$1" in
    --port) METRO_PORT="${2:-$METRO_PORT}"; shift 2 ;;
    --sim|--simulator) SIM_NAME="${2:-$SIM_NAME}"; shift 2 ;;
    --no-yarn) DO_YARN=0; shift ;;
    --no-pods) DO_PODS=0; shift ;;
    -h|--help) echo "Usage: $0 [--port 8081] [--sim \"iPhone 17 Pro\"] [--no-yarn] [--no-pods]"; exit 0 ;;
    *) log "$YELLOW" "Ignoring unknown arg: $1"; shift ;;
  esac
done

choose_free_port(){ local start="$1" tries="$2" p="$1"; for((_i=0;_i<tries;_i++));do
  if ! lsof -iTCP:"$p" -sTCP:LISTEN -nP >/dev/null 2>&1; then echo "$p"; return; fi; p=$((p+1)); done; echo "$start"; }

kill_packagers(){
  log "$YELLOW" "Killing stray Metro/packager processes…"
  pkill -f "react-native.*start" 2>/dev/null || true
  pkill -f "node.*react-native.*start" 2>/dev/null || true
  pkill -f "metro.*start" 2>/dev/null || true
  pkill -f "metro.*808" 2>/dev/null || true
}

clear_caches(){
  log "$YELLOW" "Clearing caches…"
  if have watchman; then watchman watch-del-all || true; fi
  rm -rf "${TMPDIR:-/tmp}/metro-"* "${TMPDIR:-/tmp}/react-native-"* 2>/dev/null || true
  rm -rf node_modules/.cache/metro 2>/dev/null || true
}

ensure_node(){
  if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"
  elif [ -d "$HOME/.nvm" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
  if declare -F nvm >/dev/null 2>&1; then
    if [ -f .nvmrc ]; then log "$BLUE" "Using Node from .nvmrc…"; nvm install >/dev/null; nvm use >/dev/null
    else log "$BLUE" "Using Node LTS (nvm)…"; nvm install --lts >/dev/null; nvm use --lts >/dev/null; fi
  else
    log "$YELLOW" "nvm not found; using system Node ($(node -v 2>/dev/null || echo unknown))."
  fi
}

ensure_repo_lock_sanity(){
  if [ -f package-lock.json ] && [ -f yarn.lock ] && [ ! -f package-lock.json.bak ]; then
    log "$YELLOW" "Backing up package-lock.json → package-lock.json.bak (Yarn project detected)"
    mv -f package-lock.json package-lock.json.bak
  fi
}

ensure_babel_preset_and_config(){
  # Ensure correct preset package for RN ≥0.71
  if (( DO_YARN )); then
    if ! node -e "require.resolve('@react-native/babel-preset')" >/dev/null 2>&1; then
      log "$YELLOW" "Installing @react-native/babel-preset…"
      yarn add -D @react-native/babel-preset
    fi
  fi
  # Write/patch babel.config.js to use the RN preset and place reanimated plugin LAST.
  if [ ! -f babel.config.js ]; then
    cat > babel.config.js <<'JS'
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
JS
    log "$YELLOW" "Created babel.config.js (RN preset + Reanimated plugin)."
  else
    # Replace old metro preset if present
    perl -0777 -pe "s/['\"]module:metro-react-native-babel-preset['\"]/\'module:@react-native\/babel-preset\'/g" -i babel.config.js || true
    # Ensure plugin exists and is last
    if ! grep -q "react-native-reanimated/plugin" babel.config.js; then
      perl -0777 -pe "s/(presets:\s*\[[^]]*\]\s*,?)/\1,\n  plugins: ['react-native-reanimated\/plugin'],/s" -i babel.config.js || true
    fi
  fi
}

ensure_entry_imports(){
  if [ ! -f index.js ]; then
    cat > index.js <<'JS'
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import 'react-native-reanimated';
import App from './App';
import { name as appName } from './app.json';
AppRegistry.registerComponent(appName, () => App);
JS
    log "$YELLOW" "Created index.js with required imports."
    return
  fi
  grep -q "react-native-gesture-handler" index.js || sed -i '' '1s|^|import '"'"'react-native-gesture-handler'"'"';\n|' index.js
  grep -q "react-native-reanimated" index.js || sed -i '' '2i\
import '"'"'react-native-reanimated'"'"';
' index.js
}

ensure_deps(){
  ensure_repo_lock_sanity
  if (( DO_YARN )); then
    if [ ! -d node_modules ]; then
      log "$YELLOW" "Installing JS deps (yarn)…"; yarn install --silent
    else
      log "$GREEN" "JS deps present."
    fi
    MISSING_PKGS=()
    [ -d node_modules/@react-navigation/native ]       || MISSING_PKGS+=("@react-navigation/native")
    [ -d node_modules/@react-navigation/drawer ]       || MISSING_PKGS+=("@react-navigation/drawer")
    [ -d node_modules/@react-navigation/bottom-tabs ]  || MISSING_PKGS+=("@react-navigation/bottom-tabs")
    [ -d node_modules/react-native-gesture-handler ]   || MISSING_PKGS+=("react-native-gesture-handler")
    [ -d node_modules/react-native-reanimated ]        || MISSING_PKGS+=("react-native-reanimated")
    [ -d node_modules/react-native-screens ]           || MISSING_PKGS+=("react-native-screens")
    [ -d node_modules/react-native-safe-area-context ] || MISSING_PKGS+=("react-native-safe-area-context")
    [ -d node_modules/react-native-webview ]           || MISSING_PKGS+=("react-native-webview")
    if [ "${#MISSING_PKGS[@]}" -gt 0 ]; then
      log "$YELLOW" "Installing missing nav deps: ${MISSING_PKGS[*]}"; yarn add "${MISSING_PKGS[@]}"
    fi
    # Align worklets for Reanimated 4.x (require 0.5.x or 0.6.x; prefer ^0.6)
    if [ -d node_modules/react-native-reanimated ]; then
      CUR_MM="$(node -p "try{require('react-native-worklets/package.json').version.split('.').slice(0,2).join('.')}catch(e){''}" 2>/dev/null || echo '')"
      if [ -z "$CUR_MM" ] || { [ "$CUR_MM" != "0.5" ] && [ "$CUR_MM" != "0.6" ]; }; then
        log "$YELLOW" "Installing react-native-worklets@^0.6.0 to satisfy Reanimated peer…"
        yarn add react-native-worklets@^0.6.0
      fi
    fi
  else
    log "$YELLOW" "Skipping yarn (per flag)."
  fi
  if (( DO_PODS )) && [ -f ios/Podfile ]; then
    log "$YELLOW" "Installing iOS pods…"
    if ! (cd ios && pod install); then
      log "$YELLOW" "pod install failed; cleaning + retrying with --repo-update…"
      (cd ios && pod deintegrate && pod install --repo-update)
    fi
  else
    [ -f ios/Podfile ] && log "$GREEN" "Pods step skipped or already present."
  fi
}

boot_sim(){
  local name="$1" fallback
  log "$BLUE" "Booting simulator: $name"
  open -a Simulator >/dev/null 2>&1 || true
  if xcrun simctl list devices available | grep -Fq "$name"; then xcrun simctl boot "$name" 2>/dev/null || true
  else
    log "$YELLOW" "Simulator \"$name\" not found; using a default iPhone."
    fallback="$(xcrun simctl list devices available | awk -F '[()]' '/iPhone/ && $0 !~ /unavailable/ {print $1}' | head -n1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -n "$fallback" ] && xcrun simctl boot "$fallback" 2>/dev/null || true
  fi
}

start_metro(){
  : "${METRO_PORT:?Missing METRO_PORT}"
  log "$BLUE" "Starting Metro on port ${METRO_PORT}…"
  RCT_METRO_PORT="${METRO_PORT}" nohup yarn start --reset-cache --port "${METRO_PORT}" >/tmp/metro.${METRO_PORT}.log 2>&1 &
  for _ in $(seq 1 40); do
    sleep 0.25
    if lsof -iTCP:"${METRO_PORT}" -sTCP:LISTEN -nP >/dev/null 2>&1; then log "$GREEN" "Metro is listening on ${METRO_PORT}."; return 0; fi
  done
  log "$YELLOW" "Metro not up yet; retrying once…"
  pkill -f "react-native.*start|metro.*${METRO_PORT}" 2>/dev/null || true
  RCT_METRO_PORT="${METRO_PORT}" nohup yarn start --reset-cache --port "${METRO_PORT}" >/tmp/metro.${METRO_PORT}.log 2>&1 &
  for _ in $(seq 1 40); do
    sleep 0.25
    if lsof -iTCP:"${METRO_PORT}" -sTCP:LISTEN -nP >/dev/null 2>&1; then log "$GREEN" "Metro is listening on ${METRO_PORT}."; return 0; fi
  done
  log "$RED" "Metro did not start on ${METRO_PORT}. See /tmp/metro.${METRO_PORT}.log"; exit 1
}

run_ios(){ : "${METRO_PORT:?Missing METRO_PORT}"; local sim="$1"; log "$BLUE" "Launching iOS app on \"$sim\" (port ${METRO_PORT})…"; yarn ios --simulator "$sim" --port "${METRO_PORT}"; }

print_summary(){
  echo; log "$GREEN" "Done."; echo "Metro log: /tmp/metro.${METRO_PORT}.log"
  echo; echo "Quick relaunch:"; echo "  ./fix.sh --port ${METRO_PORT} --sim \"${SIM_NAME}\""
  echo; echo "If you see 'Failed to create a worklet':"
  echo "  • Disable Remote JS Debugging (Dev Menu)."
  echo "  • Clean build: rm -rf ~/Library/Developer/Xcode/DerivedData/Mixterious-* && (cd ios && xcodebuild -workspace Mixterious.xcworkspace -scheme Mixterious -configuration Debug -destination 'generic/platform=iOS Simulator' clean) || true"
}

log "$BLUE" "Mixterious dev fixer/runner starting…"
ensure_node
kill_packagers
clear_caches

if lsof -iTCP:"${METRO_PORT}" -sTCP:LISTEN -nP >/dev/null 2>&1; then
  log "$YELLOW" "Port ${METRO_PORT} is in use; searching for an alternate…"
  METRO_PORT="$(choose_free_port "${METRO_PORT}" "${MAX_PORT_TRIES}")"
  log "$BLUE" "Selected Metro port: ${METRO_PORT}"
fi

ensure_babel_preset_and_config
ensure_entry_imports
ensure_deps
boot_sim "$SIM_NAME"
start_metro
run_ios "$SIM_NAME"
print_summary

# end of fix.sh
