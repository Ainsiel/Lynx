import { Inject, Injectable } from '@nestjs/common'
import { Role } from '@lynx/db/generated/enums'
import { PRISMA_CLIENT } from '../../../common/infra/tokens'
import type { PrismaClient } from '@lynx/db'

export interface CreateUserInput {
  name: string
  email: string
  passwordHash?: string
  githubId?: string
  githubUsername?: string
  avatarUrl?: string
  role?: Role
}

export interface UserRecord {
  id: string
  name: string
  email: string
  passwordHash: string | null
  githubId: string | null
  githubUsername: string | null
  avatarUrl: string | null
  role: Role
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class UserRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash ?? null,
        githubId: input.githubId ?? null,
        githubUsername: input.githubUsername ?? null,
        avatarUrl: input.avatarUrl ?? null,
        role: input.role ?? 'USER',
      },
    })
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
    })
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
    })
  }

  async findByGithubId(githubId: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { githubId },
    })
  }

  async linkGithub(
    userId: string,
    githubId: string,
    githubUsername: string,
    avatarUrl: string | null,
  ): Promise<UserRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        githubId,
        githubUsername,
        avatarUrl,
      },
    })
  }
}
