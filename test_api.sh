#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"KIRAcoco2026!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
echo "TOKEN OK"
RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/categorie)
echo "CATEGORIE RAW: $RESULT" | head -c 500
