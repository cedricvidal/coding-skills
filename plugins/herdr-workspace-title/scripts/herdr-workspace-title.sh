#!/bin/sh
set -u

workspace_label() {
  "$1" workspace get "$2" 2>/dev/null |
    "$jq_bin" -r '.result.workspace.label // empty' 2>/dev/null
}

watch_titles() {
  herdr_bin=$1
  jq_bin=$2
  pane_id=$3
  workspace_id=$4
  session_id=$5
  managed_label=$6
  HERDR_SOCKET_PATH=$7
  TMPDIR=$8
  export HERDR_SOCKET_PATH TMPDIR

  missing_session_reads=0
  while :; do
    pane_json=$("$herdr_bin" pane get "$pane_id" 2>/dev/null) || pane_json=
    active_session=$(printf '%s' "$pane_json" | "$jq_bin" -r \
      '.result.pane.agent_session.value // empty' 2>/dev/null)

    if [ -z "$active_session" ]; then
      missing_session_reads=$((missing_session_reads + 1))
      [ "$missing_session_reads" -lt 30 ] || return 0
      sleep 0.25
      continue
    fi
    missing_session_reads=0
    [ "$active_session" = "$session_id" ] || return 0

    status=$(printf '%s' "$pane_json" | "$jq_bin" -r \
      '.result.pane.agent_status // empty' 2>/dev/null)
    title=$(printf '%s' "$pane_json" | "$jq_bin" -r \
      '.result.pane.terminal_title_stripped // empty' 2>/dev/null)

    case "$status:$title" in
      idle:*" | "*|working:*" | "*|done:*" | "*)
        session_name=${title% | *}
        project_name=${title##* | }
        if [ -n "$session_name" ] && [ -n "$project_name" ] && [ "$title" != "$managed_label" ]; then
          current_label=$(workspace_label "$herdr_bin" "$workspace_id")
          [ "$current_label" = "$managed_label" ] || return 0
          if "$herdr_bin" workspace rename "$workspace_id" "$title" >/dev/null 2>&1; then
            managed_label=$title
          fi
        fi
        ;;
    esac

    sleep 0.25
  done
}

if [ "${1:-}" = "--watch" ] && [ "$#" -eq 9 ]; then
  shift
  watch_titles "$@"
  exit 0
fi

[ "${HERDR_ENV:-}" = 1 ] || exit 0
[ -n "${HERDR_PANE_ID:-}" ] || exit 0
[ -n "${HERDR_WORKSPACE_ID:-}" ] || exit 0

herdr_bin=$(command -v herdr) || exit 0
jq_bin=$(command -v jq) || exit 0
launchctl_bin=$(command -v launchctl) || exit 0
hook_input=$(cat)
event_name=$(printf '%s' "$hook_input" | "$jq_bin" -r '.hook_event_name // empty' 2>/dev/null)
session_id=$(printf '%s' "$hook_input" | "$jq_bin" -r '.session_id // empty' 2>/dev/null)

[ "$event_name" = SessionStart ] || exit 0
[ -n "$session_id" ] || exit 0
if [ -n "${CODEX_THREAD_ID:-}" ] && [ "$CODEX_THREAD_ID" != "$session_id" ]; then
  exit 0
fi

original_label=$(workspace_label "$herdr_bin" "$HERDR_WORKSPACE_ID")
[ -n "$original_label" ] || exit 0

job_key=$(printf '%s\n' "${HERDR_SOCKET_PATH:-}:$HERDR_PANE_ID" | cksum)
job_key=${job_key%% *}
job_label="com.cedricvidal.herdr-workspace-title.$job_key"

"$launchctl_bin" remove "$job_label" >/dev/null 2>&1 || true
"$launchctl_bin" submit -l "$job_label" -o /dev/null -e /dev/null -- \
  /bin/sh "$0" --watch "$herdr_bin" "$jq_bin" "$HERDR_PANE_ID" \
  "$HERDR_WORKSPACE_ID" "$session_id" "$original_label" \
  "${HERDR_SOCKET_PATH:-}" "${TMPDIR:-/tmp}" >/dev/null 2>&1 || true

exit 0
