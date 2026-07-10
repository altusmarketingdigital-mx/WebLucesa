#!/bin/bash

# --- CONFIGURACIÓN ---
APP_NAME="lucesa-app"
APP_DIR="/var/www/lucesa-ecommerce"
DOMAIN="tu-dominio.com" # Cambiar esto manualmente después
PORT=3001

echo "--- INICIANDO CONFIGURACIÓN DE VPS PARA LUCESA ---"

# 1. Actualizar Sistema
apt update && apt upgrade -y

# 2. Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs unzip nginx

# 3. Instalar PM2
npm install -g pm2

# 4. Preparar Directorio
mkdir -p $APP_DIR
# Asumimos que el usuario ya subió el zip a /root/
if [ -f "/root/PROYECTO_LUCESA_READY.zip" ]; then
    unzip /root/PROYECTO_LUCESA_READY.zip -d /tmp/lucesa_temp
    cp -r /tmp/lucesa_temp/hostinger_deploy/* $APP_DIR/
    rm -rf /tmp/lucesa_temp
fi

cd $APP_DIR

# 5. Instalar Dependencias
npm install --production

# 6. Configurar Nginx
cat > /etc/nginx/sites-available/lucesa <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/lucesa /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 7. Iniciar App con PM2
pm2 start server.js --name "$APP_NAME"
pm2 save
pm2 startup

echo "--- CONFIGURACIÓN COMPLETADA ---"
echo "Recuerda:"
echo "1. Editar $APP_DIR/.env con tus credenciales."
echo "2. Cambiar el nombre del dominio en /etc/nginx/sites-available/lucesa."
echo "3. Configurar tus registros DNS en Hospedeando."
