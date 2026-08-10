# Cache de redirección sin TTL

Las claves `lynx:url:{slug}` no tienen TTL; la corrección depende de invalidación explícita (`DEL`) en toda mutación del Link. Redis es un espejo del estado activo del Link, no una cache efímera, lo que evita el re-refresco en el hot path. Si algún día aparecen escrituras fuera de la API, habrá que añadir un TTL como red de seguridad.
