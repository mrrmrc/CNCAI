#!/bin/bash
echo "🔨 Build in corso..."
npm run build

echo "🚀 Deploy sul server..."
scp -r dist/* root@45.138.202.114:/var/www/pictosound/

echo "📦 Salvataggio su GitHub..."
git add -A
git commit -m "Deploy $(date '+%d/%m/%Y %H:%M')"
git push

echo "✅ Tutto fatto!"
