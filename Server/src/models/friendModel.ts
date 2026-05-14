import { mockFriends } from "../data/mockData";
import type { Friend } from "../types";

export function listMockFriends(page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const data = mockFriends.slice(start, start + pageSize);

  return {
    data,
    total: mockFriends.length
  } as { data: Friend[]; total: number };
}
