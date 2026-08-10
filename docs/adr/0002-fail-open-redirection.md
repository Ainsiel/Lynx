# Fail-open en la redirección

Cuando RabbitMQ no está disponible, la redirección sigue respondiendo `308` y el Click se descarta, registrado únicamente en la métrica `click_publish_errors`. El hot path de la redirección (<5ms p95) no puede depender jamás de la disponibilidad de la cola; descartar el evento es la pérdida aceptada a cambio de no bloquear nunca la respuesta. La alternativa de buffer local con replay queda diferida como mejora futura.
