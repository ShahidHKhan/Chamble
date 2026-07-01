import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'

const RESERVED_USERNAMES = new Set([
  'admin', 'support', 'moderator', 'mod', 'root', 'chamble',
  'system', 'help', 'staff', 'official',
])

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})

export function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 20)
    return 'Username must be between 3 and 20 characters'
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return 'Username can only contain letters, numbers, and underscores'
  if (RESERVED_USERNAMES.has(username.toLowerCase()))
    return 'That username is reserved'
  if (profanityMatcher.hasMatch(username))
    return 'That username is not allowed'
  return null
}

export function validateDisplayName(displayName: string): string | null {
  if (profanityMatcher.hasMatch(displayName))
    return 'That display name is not allowed'
  return null
}
