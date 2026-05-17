export const EVENTS = {
  // Private rooms
  CREATE_ROOM:   'create_room',
  JOIN_ROOM:     'join_room',
  ROOM_CREATED:  'room_created',
  ROOM_JOINED:   'room_joined',
  // Game
  GAME_START:    'game_start',
  MOVE:          'move',
  GAME_OVER:     'game_over',
  DRAW_OFFER:    'draw_offer',
  DRAW_ACCEPT:   'draw_accept',
  RESIGN:        'resign',
  CLOCK_TICK:    'clock_tick',
} as const
