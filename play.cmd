@echo off
cd /d "%~dp0"
set PORT=4186
echo FIXER'S CUT - http://127.0.0.1:4186
echo Keep this window open while playing.
start "" "http://127.0.0.1:4186"
node tools\server.mjs
if errorlevel 1 pause
