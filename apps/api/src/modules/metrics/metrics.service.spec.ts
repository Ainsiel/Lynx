import { Test, type TestingModule } from '@nestjs/testing'
import { MetricsService } from './metrics.service'

describe('MetricsService', () => {
  let service: MetricsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile()

    service = module.get(MetricsService)
    await module.init()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should have all counters and histograms', () => {
    expect(service.redirectTotal).toBeDefined()
    expect(service.redirectLatency).toBeDefined()
    expect(service.cacheHitTotal).toBeDefined()
    expect(service.cacheMissTotal).toBeDefined()
    expect(service.clickPublishedTotal).toBeDefined()
    expect(service.clickPublishErrorsTotal).toBeDefined()
  })

  it('should increment redirect total', async () => {
    service.redirectTotal.inc({ status: '308' })
    const metrics = await service.register.metrics()
    expect(metrics).toContain('lynx_redirect_total')
    expect(metrics).toContain('status="308"')
  })

  it('should observe redirect latency', async () => {
    service.redirectLatency.observe({ status: '308' }, 0.05)
    const metrics = await service.register.metrics()
    expect(metrics).toContain('lynx_redirect_latency_seconds')
  })

  it('should increment cache hit counter', async () => {
    service.cacheHitTotal.inc()
    const metrics = await service.register.metrics()
    expect(metrics).toContain('lynx_cache_hit_total')
  })

  it('should increment cache miss counter', async () => {
    service.cacheMissTotal.inc()
    const metrics = await service.register.metrics()
    expect(metrics).toContain('lynx_cache_miss_total')
  })

  it('should increment click published counter', async () => {
    service.clickPublishedTotal.inc()
    const metrics = await service.register.metrics()
    expect(metrics).toContain('lynx_click_published_total')
  })

  it('should increment click publish errors counter', async () => {
    service.clickPublishErrorsTotal.inc()
    const metrics = await service.register.metrics()
    expect(metrics).toContain('lynx_click_publish_errors_total')
  })

  it('should collect default metrics after init', async () => {
    const metrics = await service.register.metrics()
    expect(metrics).toContain('nodejs_heap_size_total_bytes')
    expect(metrics).toContain('process_cpu_user_seconds_total')
  })
})
