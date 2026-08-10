# Docker compose local con perfiles develop/qa y sin despliegue

El proyecto tiene como objetivo solo el entorno local con docker compose — no hay despliegue. Compose define dos perfiles: `develop` (stack completo: postgres, redis, rabbitmq, mailhog, prometheus, grafana, api, web, worker) para el día a día, y `qa` (solo lo que necesitan los tests y k6 en CI: infraestructura + api + web + worker). CI ejecuta el perfil `qa`; "un comando levanta todo" es la definición de terminado.
