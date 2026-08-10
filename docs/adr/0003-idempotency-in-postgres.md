# Idempotencia en tabla Postgres

La `Idempotency-Key` se almacena en una tabla Postgres con constraint `UNIQUE(user_id, key)`, no en Redis. Garantiza atomicidad bajo POSTs concurrentes (una única creación por clave) y sobrevive a reinicios; la ventana TTL de Redis podría perder el resultado ya registrado. Coste: una escritura extra por creación, fuera del hot path de redirección.
