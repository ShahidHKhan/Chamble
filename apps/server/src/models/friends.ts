// apps/server/src/models/friends.ts
//
// ── What this file does ──────────────────────────────────────────────────────
// Handles the "friendships" table — who is friends with whom.
//
// This replaces the static friends.json that ProfilePage currently imports.
// The friend list used to be 4 hardcoded entries. Now it's a real
// bidirectional relationship stored in the DB.
//
// ── How friendships work ─────────────────────────────────────────────────────
// A friendship row means "user_id sent a request to friend_id".
//   status = 'pending'  → waiting for friend_id to accept
//   status = 'accepted' → they're friends
//
// To check if A and B are friends, you look for a row where
// (user_id=A AND friend_id=B) OR (user_id=B AND friend_id=A)
// with status='accepted'. The OR matters because only one side
// creates the row — the other side accepts it.
//
// ── Online/offline/in-game status ────────────────────────────────────────────
// That's NOT in this table. Presence is a real-time concern handled by
// Socket.IO (who's connected right now). This model returns the friend
// profiles; the controller can overlay presence from your socketToGame map.
//
// ── Supabase table this file expects ─────────────────────────────────────────
//
//   CREATE TABLE friendships (
//     id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//     friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//     status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
//     created_at TIMESTAMPTZ DEFAULT now(),
//     UNIQUE (user_id, friend_id)
//   );
//
//   CREATE INDEX idx_friendships_user   ON friendships (user_id);
//   CREATE INDEX idx_friendships_friend ON friendships (friend_id);
//
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from '../lib/supabase'
import type {
  Friendship,
  FriendshipRow,
  FriendProfile,
  User,
  UserRow,
} from '@chess/shared'

const TABLE = 'friendships'

// ── Row conversion ───────────────────────────────────────────────────────────

function fromRow(row: FriendshipRow): Friendship {
  return {
    id:        row.id,
    userId:    row.user_id,
    friendId:  row.friend_id,
    status:    row.status as Friendship['status'],
    createdAt: row.created_at,
  }
}

// ── Core queries ─────────────────────────────────────────────────────────────

// Get all accepted friends for a user.
// Returns User profiles (not raw friendship rows) because that's what
// the client actually needs to render the friends list.
//
// This does TWO queries:
//   1. Get all friendship rows where this user is on either side
//   2. Fetch the User profiles for the OTHER side of each friendship
//
// This is the query ProfilePage calls.
export async function getFriendProfiles(
  userId: string
): Promise<FriendProfile[]> {
  const db = getSupabase()

  // Step 1: get accepted friendships where this user is on either side
  const { data: rows, error } = await db
    .from(TABLE)
    .select('user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted')

  if (error) throw error
  if (!rows || rows.length === 0) return []

  // Step 2: collect the IDs of the OTHER person in each friendship
  const friendIds = rows.map(row =>
    row.user_id === userId ? row.friend_id : row.user_id
  )

  // Step 3: fetch those users' profiles
  const { data: users, error: usersError } = await db
    .from('users')
    .select('id, display_name, elo')
    .in('id', friendIds)

  if (usersError) throw usersError

  // Return as FriendProfile (status defaults to 'offline';
  // the controller can overlay real-time presence from Socket.IO)
  return (users ?? []).map(u => ({
    id:          u.id,
    displayName: u.display_name,
    elo:         u.elo,
    status:      'offline' as const,
  }))
}

// Get pending friend requests that were SENT TO this user
// (so the user can accept or decline them).
export async function getPendingRequests(
  userId: string
): Promise<Friendship[]> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('friend_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(row => fromRow(row as FriendshipRow))
}

// Send a friend request.
// Before inserting, check that a friendship doesn't already exist
// in either direction — prevent duplicates.
export async function sendRequest(
  userId: string,
  friendId: string
): Promise<Friendship> {
  if (userId === friendId) {
    throw new Error('Cannot friend yourself')
  }

  const db = getSupabase()

  // Check for existing friendship in either direction
  const { data: existing } = await db
    .from(TABLE)
    .select('id, status')
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),` +
      `and(user_id.eq.${friendId},friend_id.eq.${userId})`
    )
    .maybeSingle()

  if (existing) {
    throw new Error(
      existing.status === 'accepted'
        ? 'Already friends'
        : 'Friend request already pending'
    )
  }

  const { data, error } = await db
    .from(TABLE)
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as FriendshipRow)
}

// Accept a pending friend request.
// Only the recipient (friend_id) can accept.
export async function acceptRequest(
  friendshipId: string,
  userId: string
): Promise<Friendship> {
  const db = getSupabase()

  // Verify this request was sent TO this user
  const { data: existing, error: findError } = await db
    .from(TABLE)
    .select('*')
    .eq('id', friendshipId)
    .eq('friend_id', userId)
    .eq('status', 'pending')
    .single()

  if (findError || !existing) {
    throw new Error('Friend request not found or already handled')
  }

  const { data, error } = await db
    .from(TABLE)
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as FriendshipRow)
}

// Decline a pending request OR remove an existing friendship.
// Works for both cases — just deletes the row.
export async function removeFriendship(
  friendshipId: string,
  userId: string
): Promise<void> {
  const db = getSupabase()

  // Only allow deletion if this user is on one side of the friendship
  const { error } = await db
    .from(TABLE)
    .delete()
    .eq('id', friendshipId)
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

  if (error) throw error
}

// Unfriend by user IDs (when you don't have the friendship row ID).
// Looks for the row in either direction and deletes it.
export async function unfriend(
  userId: string,
  friendId: string
): Promise<void> {
  const db = getSupabase()

  const { error } = await db
    .from(TABLE)
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),` +
      `and(user_id.eq.${friendId},friend_id.eq.${userId})`
    )

  if (error) throw error
}

// Check if two users are friends (useful for permission checks).
export async function areFriends(
  userA: string,
  userB: string
): Promise<boolean> {
  const db = getSupabase()
  const { data } = await db
    .from(TABLE)
    .select('id')
    .or(
      `and(user_id.eq.${userA},friend_id.eq.${userB}),` +
      `and(user_id.eq.${userB},friend_id.eq.${userA})`
    )
    .eq('status', 'accepted')
    .maybeSingle()

  return data !== null
}