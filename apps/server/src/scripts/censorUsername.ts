// One-off: censor the slur portion of a specific account's username/displayName.
// Usage: npx tsx src/scripts/censorUsername.ts <userId>

import 'dotenv/config'
import { RegExpMatcher, englishDataset, englishRecommendedTransformers, TextCensor, asteriskCensorStrategy } from 'obscenity'
import * as Users from '../models/users'

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})
const censor = new TextCensor().setStrategy(asteriskCensorStrategy())

function censorText(text: string): string {
  return censor.applyTo(text, matcher.getAllMatches(text))
}

async function run() {
  const id = process.argv[2]
  if (!id) {
    console.error('Usage: npx tsx src/scripts/censorUsername.ts <userId>')
    process.exit(1)
  }

  const user = await Users.getById(id)
  const censoredUsername = censorText(user.username)
  const censoredDisplayName = censorText(user.displayName)

  console.log(`username:    ${user.username} -> ${censoredUsername}`)
  console.log(`displayName: ${user.displayName} -> ${censoredDisplayName}`)

  await Users.update(id, { username: censoredUsername, displayName: censoredDisplayName })
  console.log('Updated.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
