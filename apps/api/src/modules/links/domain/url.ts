export interface UrlProps {
  id: string
  ownerId: string | null
  originalUrl: string
  slug: string
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export class Url {
  private constructor(private readonly props: UrlProps) {}

  static create(props: UrlProps): Url {
    return new Url(props)
  }

  get id(): string {
    return this.props.id
  }

  get ownerId(): string | null {
    return this.props.ownerId
  }

  get originalUrl(): string {
    return this.props.originalUrl
  }

  get slug(): string {
    return this.props.slug
  }

  get isActive(): boolean {
    return this.props.isActive
  }

  get createdAt(): Date {
    const v = this.props.createdAt
    return v instanceof Date ? v : new Date(v)
  }

  get updatedAt(): Date {
    const v = this.props.updatedAt
    return v instanceof Date ? v : new Date(v)
  }

  toResponse(baseUrl: string): {
    id: string
    slug: string
    shortUrl: string
    originalUrl: string
    isActive: boolean
    createdAt: string
  } {
    return {
      id: this.props.id,
      slug: this.props.slug,
      shortUrl: `${baseUrl}/${this.props.slug}`,
      originalUrl: this.props.originalUrl,
      isActive: this.props.isActive,
      createdAt: this.createdAt.toISOString(),
    }
  }
}
