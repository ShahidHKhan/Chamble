import { mockUser, mockUsers } from "../data/mockData";
import type { UserProfile } from "../types";

export function getMockUser(): UserProfile {
  return mockUser;
}

export function listMockUsers() {
  return mockUsers;
}

export function getMockUserById(userId: string) {
  return mockUsers.find((user) => user.id === userId) ?? null;
}

export function authenticateMockUser(userId?: string) {
  const user = userId ? getMockUserById(userId) ?? mockUser : mockUser;
  return {
    user,
    token: `mock-token:${user.id}`
  };
}
