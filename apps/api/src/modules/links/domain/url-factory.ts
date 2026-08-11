import { randomBytes } from 'node:crypto'

const NON_AMBIGUOUS_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const SLUG_LENGTH = 8
const MAX_RETRIES = 5

export class UrlFactory {
  static generateSlug(): string {
    const bytes = randomBytes(SLUG_LENGTH)
    let slug = ''
    for (let i = 0; i < SLUG_LENGTH; i++) {
      const byte = bytes[i]
      if (byte !== undefined) {
        slug += NON_AMBIGUOUS_ALPHABET[byte % NON_AMBIGUOUS_ALPHABET.length]
      }
    }
    return slug
  }

  static async generateUniqueSlug(
    checkExists: (slug: string) => Promise<boolean>,
  ): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const slug = this.generateSlug()
      const exists = await checkExists(slug)
      if (!exists) return slug
    }
    throw new Error('Failed to generate unique slug after max retries')
  }
}
