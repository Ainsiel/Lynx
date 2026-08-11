import { BadRequestException } from '@nestjs/common'
import { RESERVED_SLUGS } from '@lynx/shared'

const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,16}$/

export class Slug {
  private constructor(private readonly value: string) {}

  static create(raw: string): Slug {
    const trimmed = raw.trim()
    if (!SLUG_REGEX.test(trimmed)) {
      throw new BadRequestException(
        'Slug must be 1-16 chars: [a-zA-Z0-9_-]',
      )
    }
    if (RESERVED_SLUGS.includes(trimmed.toLowerCase())) {
      throw new BadRequestException(`Slug '${trimmed}' is reserved`)
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
