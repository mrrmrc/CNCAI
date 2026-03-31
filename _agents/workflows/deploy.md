---
description: Deploy CNCAI sul server di produzione
---

// turbo-all

1. Esegui lo script di deploy (da Git Bash o WSL):
```
bash deploy.sh
```

Oppure manualmente, passo per passo:

2. Build del frontend:
```
npm run build
```

3. Carica il frontend:
```
scp -r dist/* root@45.138.202.114:/var/www/pictosound/
```

4. Carica il backend (solo se modificato):
```
scp backend.py root@45.138.202.114:/opt/docapp/backend.py
```

5. Riavvia il backend (solo se backend.py modificato):
```
ssh root@45.138.202.114 "systemctl restart docapp"
```

6. Salva su GitHub:
```
git add -A
git commit -m "Deploy $(date '+%d/%m/%Y %H:%M')"
git push
```
