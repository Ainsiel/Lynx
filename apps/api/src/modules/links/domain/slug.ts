import { RESERVED_SLUGS } from '@lynx/shared'

const SLUG_REGEX = /^[a-zA-Z0-9_-]{6,10}$/

export class InvalidSlugError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidSlugError'
  }
}

export class Slug {
  private constructor(private readonly value: string) {}

  static create(raw: string): Slug {
    const trimmed = raw.trim()
    if (!SLUG_REGEX.test(trimmed)) {
      throw new InvalidSlugError(
        'Slug must be 6-10 chars: [a-zA-Z0-9_-]',
      )
    }
    if (RESERVED_SLUGS.includes(trimmed.toLowerCase())) {
      throw new InvalidSlugError(`Slug '${trimmed}' is reserved`)
    }
    return new Slug(trimmed)
  }

  toString(): string {
    return this.value
  }

  equals(other: Slug): boolean {
    return this.value === other.value
  }
}
