import { InvalidSlugError, Slug } from './slug'

describe('Slug', () => {
  describe('create', () => {
    it('should create a valid slug', () => {
      const slug = Slug.create('my-slug')
      expect(slug.toString()).toBe('my-slug')
    })

    it('should create slug with underscores', () => {
      const slug = Slug.create('my_slug')
      expect(slug.toString()).toBe('my_slug')
    })

    it('should create slug with mixed case', () => {
      const slug = Slug.create('MySlug123')
      expect(slug.toString()).toBe('MySlug123')
    })

    it('should reject slug shorter than 6 chars', () => {
      expect(() => Slug.create('abc')).toThrow(InvalidSlugError)
      expect(() => Slug.create('abcde')).toThrow(InvalidSlugError)
    })

    it('should reject slug longer than 10 chars', () => {
      expect(() => Slug.create('abcdefghijk')).toThrow(InvalidSlugError)
    })

    it('should reject slug with invalid characters', () => {
      expect(() => Slug.create('my slug')).toThrow(InvalidSlugError)
      expect(() => Slug.create('my.slug')).toThrow(InvalidSlugError)
      expect(() => Slug.create('my@slug')).toThrow(InvalidSlugError)
    })

    it('should reject reserved slugs', () => {
      expect(() => Slug.create('health')).toThrow(InvalidSlugError)
      expect(() => Slug.create('register')).toThrow(InvalidSlugError)
      expect(() => Slug.create('logout')).toThrow(InvalidSlugError)
      expect(() => Slug.create('refresh')).toThrow(InvalidSlugError)
    })

    it('should reject empty slug', () => {
      expect(() => Slug.create('')).toThrow(InvalidSlugError)
    })
  })

  describe('equals', () => {
    it('should return true for equal slugs', () => {
      const slug1 = Slug.create('my-slug')
      const slug2 = Slug.create('my-slug')
      expect(slug1.equals(slug2)).toBe(true)
    })

    it('should return false for different slugs', () => {
      const slug1 = Slug.create('slug-one')
      const slug2 = Slug.create('slug-two')
      expect(slug1.equals(slug2)).toBe(false)
    })
  })
})
