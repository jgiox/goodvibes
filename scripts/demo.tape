# Source: charmbracelet/vhs (latest via charm.sh apt) — https://github.com/charmbracelet/vhs
# DEMO-01: 800px width, ≤2MB, deterministic via --minimal --dry-run
# CI: vhs.yml pre-installs ffmpeg before running this tape

Output ../docs/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 800
Set Height 500
Set Theme "Dracula"
Set TypingSpeed 80ms
Set Padding 10
Set Framerate 24

# Hide the mkdir + npx cold-start so the GIF opens on the goodvibes output
Hide
Type "mkdir myproject && cd myproject"
Enter
Sleep 500ms
Show

# ponytail: global install in vhs.yml avoids npx re-download (npx ignores cache, always checks registry)
Type "goodvibes init --minimal --dry-run"
Enter

# Wait for goodvibes outro — unique text that only appears after command completes
Wait+Screen /Run without/

Sleep 2s
