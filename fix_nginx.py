#!/usr/bin/env python3
# Aggiunge il blocco /correggi al config nginx

NGINX_FILE = "/etc/nginx/sites-enabled/pictosound"

NEW_BLOCK = """
location /correggi {
    proxy_pass http://127.0.0.1:8000/correggi;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Authorization $http_authorization;
    proxy_pass_header Authorization;
}
"""

with open(NGINX_FILE, "r") as f:
    content = f.read()

if "/correggi" not in content:
    # Inserisci dopo il blocco /cerca
    content = content.replace(
        "location /cerca {",
        NEW_BLOCK.strip() + "\n\nlocation /cerca {"
    )
    with open(NGINX_FILE, "w") as f:
        f.write(content)
    print("Blocco /correggi aggiunto correttamente.")
else:
    print("Il blocco /correggi e' gia' presente.")
