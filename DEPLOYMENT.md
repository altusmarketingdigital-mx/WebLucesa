# Guía de Despliegue Automatizado en Hostinger

Este proyecto está configurado para desplegarse automáticamente a Hostinger usando **GitHub Actions**. Cada vez que hagas un `push` a la rama `main`, el sistema compilará el frontend y subirá los archivos necesarios a tu servidor.


## Requisitos Previos
1. Un dominio apuntando a tu servidor Hostinger.
2. Un **Hostinger VPS** con acceso SSH configurado.
3. Node.js instalado en el servidor.
4. Una base de datos PostgreSQL.
5. Haber subido tu código a un repositorio en **GitHub**.

---

## 1. Configuración de GitHub Secrets
Para que el despliegue automático funcione, debes agregar las siguientes variables en tu repositorio de GitHub (**Settings > Secrets and variables > Actions > New repository secret**):

| Nombre del Secret | Descripción |
|-------------------|-------------|
| `HOSTINGER_IP` | La dirección IP de tu servidor VPS. |
| `HOSTINGER_USERNAME` | Tu usuario de SSH (ej: `root` o el que uses). |
| `SSH_PRIVATE_KEY` | El contenido de tu llave privada SSH (`id_rsa`). |

> [!TIP]
> Asegúrate de que la llave pública correspondiente esté en el archivo `~/.ssh/authorized_keys` de tu servidor.

---

## 2. Estructura del Proyecto
El sistema despliega los siguientes archivos al directorio `/var/www/lucesa-ecommerce`:
- `dist/`: Frontend compilado.
- `backend/`: Código de la API.
- `index.js`: Servidor unificado de producción.
- `package.json`: Definición de dependencias.

---

## 2. Configurar el Backend (Node.js)
1. Sube la carpeta `backend/` a tu servidor (puedes usar Git o FTP).
2. Entra por SSH y navega a la carpeta: `cd /var/www/lucesa/api`.
3. Instala las dependencias: `npm install`.
4. Configura las variables de entorno:
   - Copia el archivo `.env.example` a `.env`: `cp .env.example .env`.
   - Edita el archivo `.env` con tus credenciales reales (DB, CT Online, etc.): `nano .env`.
5. Ejecuta la base de datos:
   - Usa el archivo `schema.sql` para crear las tablas en tu PostgreSQL de Hostinger.
6. Inicia el servidor:
   - Se recomienda usar **PM2** para que el proceso no se detenga:
     ```bash
     npm install -g pm2
     pm2 start server.js --name lucesa-api
     ```

---

## 3. Configurar el Frontend
1. Sube todo el contenido de la carpeta `dist/` a la carpeta pública de tu dominio (ej: `public_html/`).
2. **Importante**: El frontend ya está compilado para buscar la API en la misma URL donde se hospeda (rutas relativas). Si hospedas la API en un puerto distinto (ej: 3001), asegúrate de usar un **Reverse Proxy** con Nginx para redirigir las peticiones `/api` al puerto correcto.

### Ejemplo de Configuración Nginx (si usas VPS):
```nginx
location /api/ {
    proxy_pass http://localhost:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## 4. Sincronización de Catálogo
El servidor intentará sincronizar el catálogo de CT Online al arrancar. Asegúrate de que las credenciales de FTP de CT enviadas por el proveedor sean correctas en el archivo `.env`.

---

¡Tu tienda debería estar en línea y funcional!
