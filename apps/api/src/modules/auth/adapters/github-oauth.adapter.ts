import { Injectable, Logger } from '@nestjs/common'

export interface GithubUser {
  id: number
  login: string
  email?: string | null
  name?: string | null
  avatar_url?: string | null
}

export interface GithubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility: string | null
}

@Injectable()
export class GithubOAuthAdapter {
  private readonly logger = new Logger(GithubOAuthAdapter.name)

  async exchangeCodeForToken(code: string, clientId: string, clientSecret: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`)
    }

    const data = (await response.json()) as { access_token?: string; error?: string }
    if (!data.access_token) {
      throw new Error(data.error ?? 'GitHub token exchange failed')
    }

    return data.access_token
  }

  async fetchUser(accessToken: string): Promise<GithubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub user fetch failed: ${response.status}`)
    }

    return response.json() as Promise<GithubUser>
  }

  async fetchPrimaryEmail(accessToken: string): Promise<string> {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub emails fetch failed: ${response.status}`)
    }

    const emails = (await response.json()) as GithubEmail[]
    const primary = emails.find((e) => e.primary && e.verified)
    if (!primary) {
      const verified = emails.find((e) => e.verified)
      if (!verified) throw new Error('No verified email found on GitHub account')
      return verified.email
    }

    return primary.email
  }
}
