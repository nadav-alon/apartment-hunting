#!/bin/bash
PORT=8080
echo "Opening http://localhost:$PORT"
xdg-open "http://localhost:$PORT" 2>/dev/null &
python3 -m http.server $PORT --directory "$(dirname "$0")"
