sed -i '/client_max_body_size/d' /etc/nginx/nginx.conf
sed -i '0,/http {/s//http {\n    client_max_body_size 100M;/' /etc/nginx/nginx.conf
systemctl reload nginx
sudo -u postgres psql docdb -c "ALTER TABLE documenti ADD COLUMN IF NOT EXISTS categoria VARCHAR(100) DEFAULT 'Generale';"
