import { BadRequestException } from '@nestjs/common'
import { Slug } from './slug'

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

    it('should reject slug with invalid characters', () => {
      expect(() => Slug.create('my slug')).toThrow(BadRequestException)
      expect(() => Slug.create('my.slug')).toThrow(BadRequestException)
      expect(() => Slug.create('my@slug')).toThrow(BadRequestException)
    })

    it('should reject reserved slugs', () => {
      expect(() => Slug.create('api')).toThrow(BadRequestException)
      expect(() => Slug.create('admin')).toThrow(BadRequestException)
      expect(() => Slug.create('health')).toThrow(BadRequestException)
      expect(() => Slug.create('links')).toThrow(BadRequestException)
    })

    it('should reject empty slug', () => {
      expect(() => Slug.create('')).toThrow(BadRequestException)
    })
  })

  describe('equals', () => {
    it('should return true for equal slugs', () => {
      const slug1 = Slug.create('test')
      const slug2 = Slug.create('test')
      expect(slug1.equals(slug2)).toBe(true)
    })

    it('should return false for different slugs', () => {
      const slug1 = Slug.create('test1')
      const slug2 = Slug.create('test2')
      expect(slug1.equals(slug2)).toBe(false)
    })
  })
})
