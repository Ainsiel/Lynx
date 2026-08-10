# Worker agregador como proceso separado

El worker que agrega los ClickEvents corre como proceso propio (`apps/worker`), no como consumidor in-process dentro de la API. Mantiene productor y consumidor desacoplados: la API permanece limpia bajo carga de redirección, el worker escala y falla de forma independiente, y el backlog de la cola es observable en Grafana aunque la API esté caída. Trade-off: un servicio más que levantar en docker compose y orquestar en CI.
