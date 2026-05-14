import type { Friend, UserProfile } from "../types";

export const mockUsers: UserProfile[] = [
  {
    id: "user-001",
    displayName: "John Doe",
    email: "john@chamble.test",
    rating: 1420,
    gamesPlayed: 18,
    wins: 10,
    losses: 8
  },
  {
    id: "user-002",
    displayName: "Jane Doe",
    email: "jane@chamble.test",
    rating: 1385,
    gamesPlayed: 12,
    wins: 6,
    losses: 6
  }
];

export const mockUser = mockUsers[0];

export const mockFriends: Friend[] = [
  {
    id: "friend-101",
    displayName: "Jordan Lee",
    status: "online"
  },
  {
    id: "friend-102",
    displayName: "Morgan Reed",
    status: "offline"
  },
  {
    id: "friend-103",
    displayName: "Sky Patel",
    status: "in-game"
  }
];
