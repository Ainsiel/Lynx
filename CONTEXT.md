# LYNX

Acortador de URLs con analytics en tiempo real: crea enlaces cortos únicos, sirve redirecciones desde cache y agrega estadísticas de forma asíncrona.

## Language

**Link**: Agregado raíz. Un enlace guardado: originalUrl, slug, userId (owner), isActive, createdAt.
_Avoid_: Url, url, short link

**OriginalUrl**: Value object. La URL larga a la que redirige un Link; debe ser http/https absoluta y no apuntar al propio dominio LYNX.

**Slug**: Value object. El código corto único de un Link; 6-16 chars de [a-zA-Z0-9_-]. Los auto-generados usan alfabeto no ambiguo y miden 8 chars; los custom no pueden ser reservados.
_Avoid_: code, short code

**User**: Cuenta que puede poseer Links y ver sus analytics.
_Avoid_: Owner, account

**Click**: Una navegación al shortUrl de un Link. Hecho bruto para analytics.
_Avoid_: visit, hit

**ClickEvent**: Evento de dominio que registra un Click — slug, ip, userAgent, country, device, eventId (deduplicación), occurredAt — publicado de forma asíncrona; la redirección nunca espera por él.

**Device**: Clasificación del user agent del visitante: mobile, desktop, tablet o bot.

**DailyStats**: Proyección de lectura que agrega Clicks por Link y día (UTC).
_Avoid_: stats, analytics table

**Idempotency-Key**: Header HTTP que garantiza que un Link se crea como máximo una vez por clave y por usuario.

**ShortUrl**: Valor derivado — LYNX_BASE_URL + "/" + slug.
