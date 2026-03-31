---
description: Deploy CNCAI sul server di produzione
---

// turbo-all

1. Build del frontend:
```
npm run build
```

2. Carica il frontend:
```
scp -r dist/* root@45.138.202.114:/var/www/pictosound/
```

3. Carica il backend:
```
scp backend.py root@45.138.202.114:/opt/docapp/backend.py
```

4. Riavvia il backend:
```
ssh root@45.138.202.114 "systemctl restart docapp"
```
