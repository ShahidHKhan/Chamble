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
  // Pause
  PAUSE_OFFER:            'pause_offer',
  PAUSE_ACCEPT:           'pause_accept',
  PAUSE_DECLINE:          'pause_decline',
  PAUSE_RESUME:           'pause_resume',
  // Presence
  OPPONENT_DISCONNECTED:  'opponent_disconnected',
  OPPONENT_RECONNECTED:   'opponent_reconnected',
  // State sync (for rejoin)
  SYNC_REQUEST:           'sync_request',
  SYNC_STATE:             'sync_state',
  // Chess-Matics simultaneous challenge
  MATICS_START:           'matics:start',
  MATICS_WIN:             'matics:win',
  MATICS_RESULT:          'matics:result',
  // Chess-Roulette turn events
  ROULETTE_ROLLED:        'roulette:rolled',
  ROULETTE_BUST:          'roulette:bust',
} as const
