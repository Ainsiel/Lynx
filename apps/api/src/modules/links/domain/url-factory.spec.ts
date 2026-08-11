import { UrlFactory } from './url-factory'

describe('UrlFactory', () => {
  describe('generateSlug', () => {
    it('should generate a slug of length 8', () => {
      const slug = UrlFactory.generateSlug()
      expect(slug).toHaveLength(8)
    })

    it('should only contain non-ambiguous characters', () => {
      const validChars = /^[2-9a-hjkmnp-z]+$/
      for (let i = 0; i < 100; i++) {
        const slug = UrlFactory.generateSlug()
        expect(slug).toMatch(validChars)
      }
    })

    it('should generate different slugs on multiple calls', () => {
      const slugs = new Set<string>()
      for (let i = 0; i < 50; i++) {
        slugs.add(UrlFactory.generateSlug())
      }
      expect(slugs.size).toBeGreaterThan(1)
    })
  })

  describe('generateUniqueSlug', () => {
    it('should return a slug that does not exist', async () => {
      const checkExists = jest.fn().mockResolvedValue(false)
      const slug = await UrlFactory.generateUniqueSlug(checkExists)
      expect(slug).toHaveLength(8)
      expect(checkExists).toHaveBeenCalledTimes(1)
    })

    it('should retry if slug exists', async () => {
      const checkExists = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      const slug = await UrlFactory.generateUniqueSlug(checkExists)
      expect(slug).toHaveLength(8)
      expect(checkExists).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      const checkExists = jest.fn().mockResolvedValue(true)
      await expect(
        UrlFactory.generateUniqueSlug(checkExists),
      ).rejects.toThrow('Failed to generate unique slug')
    })
  })
})
