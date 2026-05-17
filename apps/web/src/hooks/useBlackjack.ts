import { useState, useCallback, useEffect } from 'react'

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  rank: Rank
  suit: Suit
  faceDown?: boolean
}

export type BlackjackResult = 'win' | 'lose' | 'push'
export type BlackjackPhase = 'idle' | 'player-turn' | 'dealer-turn' | 'resolved'

function createDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♦', '♣']
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const deck: Card[] = []
  for (const suit of suits)
    for (const rank of ranks)
      deck.push({ rank, suit })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function cardValue(card: Card): number {
  if (card.rank === 'A') return 11
  if (['J', 'Q', 'K'].includes(card.rank)) return 10
  return parseInt(card.rank)
}

export function handValue(hand: Card[]): number {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0)
  let aces = hand.filter(c => c.rank === 'A').length
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21
}

interface BJState {
  phase: BlackjackPhase
  playerHand: Card[]
  dealerHand: Card[]
  deck: Card[]
  result: BlackjackResult | null
}

const IDLE: BJState = { phase: 'idle', playerHand: [], dealerHand: [], deck: [], result: null }

export function useBlackjack() {
  const [bj, setBJ] = useState<BJState>(IDLE)

  const deal = useCallback(() => {
    const deck = createDeck()
    const playerHand: Card[] = [deck.pop()!, deck.pop()!]
    const dealerHand: Card[] = [deck.pop()!, { ...deck.pop()!, faceDown: true }]
    const revealed = dealerHand.map(c => ({ ...c, faceDown: false }))
    const pBJ = isBlackjack(playerHand)
    const dBJ = isBlackjack(revealed)
    if (pBJ || dBJ) {
      const result: BlackjackResult = pBJ && dBJ ? 'push' : pBJ ? 'win' : 'lose'
      setBJ({ phase: 'resolved', playerHand, dealerHand: revealed, deck, result })
    } else {
      setBJ({ phase: 'player-turn', playerHand, dealerHand, deck, result: null })
    }
  }, [])

  const hit = useCallback(() => {
    setBJ(prev => {
      if (prev.phase !== 'player-turn') return prev
      const deck = [...prev.deck]
      const playerHand = [...prev.playerHand, deck.pop()!]
      const total = handValue(playerHand)
      if (total > 21)
        return { ...prev, deck, playerHand, phase: 'resolved', result: 'lose', dealerHand: prev.dealerHand.map(c => ({ ...c, faceDown: false })) }
      if (total === 21) {
        // Auto-stand: reveal dealer card and hand off to animated dealer turn
        const dealerHand = prev.dealerHand.map(c => ({ ...c, faceDown: false }))
        return { ...prev, deck, playerHand, dealerHand, phase: 'dealer-turn' }
      }
      return { ...prev, deck, playerHand }
    })
  }, [])

  const stand = useCallback(() => {
    setBJ(prev => {
      if (prev.phase !== 'player-turn') return prev
      const dealerHand = prev.dealerHand.map(c => ({ ...c, faceDown: false }))
      return { ...prev, dealerHand, phase: 'dealer-turn' }
    })
  }, [])

  // Dealer plays one card at a time, 250 ms apart
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (bj.phase !== 'dealer-turn') return
    const timer = setTimeout(() => {
      setBJ(prev => {
        if (prev.phase !== 'dealer-turn') return prev
        const d = handValue(prev.dealerHand)
        if (d < 17) {
          const deck = [...prev.deck]
          const dealerHand = [...prev.dealerHand, deck.pop()!]
          const newD = handValue(dealerHand)
          if (newD > 21) return { ...prev, deck, dealerHand, phase: 'resolved', result: 'win' }
          return { ...prev, deck, dealerHand }
        }
        const p = handValue(prev.playerHand)
        const result: BlackjackResult = d > p ? 'lose' : p > d ? 'win' : 'push'
        return { ...prev, phase: 'resolved', result }
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [bj.phase, bj.dealerHand]) // re-fires each time dealer draws a card

  const reset = useCallback(() => setBJ(IDLE), [])

  return { phase: bj.phase, playerHand: bj.playerHand, dealerHand: bj.dealerHand, result: bj.result, deal, hit, stand, reset }
}
