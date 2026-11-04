#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Chưa cài Node.js 22 trở lên: https://nodejs.org"; exit 1; }
(sleep 1; (xdg-open http://localhost:3000/ || open http://localhost:3000/) >/dev/null 2>&1) &
node server.js
