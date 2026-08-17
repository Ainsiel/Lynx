import { Registry, Counter, collectDefaultMetrics } from 'prom-client'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

export const register = new Registry()

export const clickProcessedTotal = new Counter({
  name: 'lynx_click_processed_total',
  help: 'Total number of click events processed successfully',
  registers: [register],
})

export const clickDlqTotal = new Counter({
  name: 'lynx_click_dlq_total',
  help: 'Total number of click events sent to DLQ',
  registers: [register],
})

collectDefaultMetrics({ register })

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.url === '/metrics') {
    void register.metrics().then((metrics) => {
      res.setHeader('Content-Type', register.contentType)
      res.end(metrics)
    })
  } else {
    res.statusCode = 404
    res.end()
  }
}

export function startMetricsServer(port: number): void {
  const server = createServer(handleRequest)
  server.listen(port, () => {
    console.log(`LYNX worker metrics listening on :${port}/metrics`)
  })
}
