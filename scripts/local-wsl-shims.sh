# Source from start.sh / dev-tunnel.sh / stop.sh on WSL + Windows repo paths.
# Makes npm/node/ngrok/curl work when bash is WSL and Node listens on Windows localhost.

local_wsl_shims() {
  local root="${1:-}"
  [[ -n "$root" ]] || return 0
  [[ -r /proc/version ]] && grep -qi microsoft /proc/version || return 0

  local run_dir="$root/.run"
  mkdir -p "$run_dir/bin"

  # Always refresh wrappers when Windows binaries exist — a stale .run/bin/ngrok
  # shadows PATH and breaks if it only calls bare `ngrok.exe` (missing in nohup env).
  local node_real ngrok_real
  if command -v node.exe >/dev/null 2>&1; then
    node_real="$(command -v node.exe)"
    cat > "$run_dir/bin/node" <<EOF
#!/bin/bash
node_exe='$node_real'
args=()
for a in "\$@"; do
  if [[ "\$a" == /mnt/* ]]; then
    args+=("\$(wslpath -w "\$a")")
  else
    args+=("\$a")
  fi
done
exec "\$node_exe" "\${args[@]}"
EOF
    chmod +x "$run_dir/bin/node"
  fi

  if command -v ngrok.exe >/dev/null 2>&1; then
    ngrok_real="$(command -v ngrok.exe)"
    cat > "$run_dir/bin/ngrok" <<EOF
#!/bin/bash
exec '$ngrok_real' "\$@"
EOF
    chmod +x "$run_dir/bin/ngrok"
  fi

  export PATH="$run_dir/bin:$PATH"

  if command -v curl.exe >/dev/null 2>&1; then
    curl() { curl.exe "$@"; }
    export -f curl 2>/dev/null || true
  fi
}
