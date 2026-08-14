import { Test, TestingModule } from '@nestjs/testing'
import { AuditService } from './audit.service'
import { AuditRepository } from './adapters/audit.repository'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@lynx/shared'

describe('AuditService', () => {
  let service: AuditService
  let repository: { log: jest.Mock; findAll: jest.Mock }

  beforeEach(async () => {
    repository = { log: jest.fn(), findAll: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditRepository, useValue: repository },
      ],
    }).compile()

    service = module.get(AuditService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('log', () => {
    it('should call repository.log with the input', async () => {
      const input = {
        userId: 'user-1',
        action: AUDIT_ACTIONS.LOGIN,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: 'user-1',
      }

      await service.log(input)

      expect(repository.log).toHaveBeenCalledWith(input)
    })

    it('should not throw on repository error (fail-open)', async () => {
      repository.log.mockRejectedValue(new Error('db error'))

      await expect(
        service.log({
          userId: 'user-1',
          action: AUDIT_ACTIONS.LOGIN,
          entityType: AUDIT_ENTITY_TYPES.USER,
        }),
      ).rejects.toThrow('db error')
    })
  })

  describe('findAll', () => {
    it('should call repository.findAll and return results', async () => {
      const query = { cursor: undefined, take: 20 }
      const expected = { data: [], nextCursor: null }
      repository.findAll.mockResolvedValue(expected)

      const result = await service.findAll(query)

      expect(repository.findAll).toHaveBeenCalledWith(query)
      expect(result).toEqual(expected)
    })
  })
})
