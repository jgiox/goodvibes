# Source: charmbracelet/vhs (latest via charm.sh apt) — https://github.com/charmbracelet/vhs
# DEMO-01: 800px width, real init (--minimal), global install so no npx wait

Output ../docs/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 800
Set Height 500
Set Theme "Dracula"
Set TypingSpeed 80ms
Set Padding 10
# ponytail: 10fps keeps GIF small; 20s Sleep easily covers global-install init time
Set Framerate 10

# Hide the directory setup so the GIF opens on the goodvibes output
Hide
Type "mkdir myproject && cd myproject"
Enter
Sleep 500ms
Show

Type "goodvibes init --minimal"
Enter

# Sleep instead of Wait+Screen: vhs v0.11.0 Wait+Screen viewport is too small
# to see outro when Files-written note scrolls it off screen
Sleep 20s

Sleep 1s
