import { useState, useRef, useEffect, useCallback } from 'react'

export interface ChatMessage {
  id: number
  sender: string
  text: string
  isSelf: boolean
}

interface ChatBoxProps {
  isActive: boolean
  messages: ChatMessage[]
  onSend: (text: string) => void
}

const SPAM_WINDOW_MS = 8_000
const SPAM_MAX_MSGS  = 4

export function ChatBox({ isActive, messages, onSend }: ChatBoxProps) {
  const [isMuted,       setIsMuted]       = useState(false)
  const [text,          setText]          = useState('')
  const [isSpamBlocked, setIsSpamBlocked] = useState(false)
  const recentSends  = useRef<number[]>([])
  const messagesRef  = useRef<HTMLDivElement>(null)
  const spamTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSend = useCallback(() => {
    const trimmed = text.trim().slice(0, 200)
    if (!trimmed || !isActive || isMuted) return

    const now = Date.now()
    recentSends.current = recentSends.current.filter(t => now - t < SPAM_WINDOW_MS)

    if (recentSends.current.length >= SPAM_MAX_MSGS) {
      if (!isSpamBlocked) {
        setIsSpamBlocked(true)
        const oldest     = recentSends.current[0]
        const unblockIn  = SPAM_WINDOW_MS - (now - oldest)
        spamTimer.current = setTimeout(() => setIsSpamBlocked(false), unblockIn)
      }
      return
    }

    recentSends.current.push(now)
    onSend(trimmed)
    setText('')
  }, [text, isActive, isMuted, isSpamBlocked, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSend() }
  }

  // Cleanup spam timer on unmount
  useEffect(() => () => { if (spamTimer.current) clearTimeout(spamTimer.current) }, [])

  const canSend = isActive && !isMuted && !isSpamBlocked

  return (
    <div className={`chat-box${!isActive ? ' chat-box--inactive' : ''}`}>
      <div className="chat-box__header">
        <p className="chat-box__title">Chat</p>
        {isActive && (
          <button
            className={`chat-box__mute-btn${isMuted ? ' chat-box__mute-btn--active' : ''}`}
            onClick={() => setIsMuted(m => !m)}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        )}
      </div>

      <div className={`chat-box__messages${isMuted ? ' chat-box__messages--muted' : ''}`} ref={messagesRef}>
        {isMuted ? (
          <p className="chat-box__muted-label">Chat muted</p>
        ) : messages.length === 0 ? (
          <p className="chat-box__empty">
            {isActive ? 'No messages yet' : 'Chat unavailable'}
          </p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`chat-box__message${msg.isSelf ? ' chat-box__message--self' : ''}`}>
              <span className="chat-box__sender">{msg.isSelf ? 'You' : msg.sender}</span>
              <span className="chat-box__text">{msg.text}</span>
            </div>
          ))
        )}
      </div>

      {isSpamBlocked && (
        <p className="chat-box__spam-warn">Slow down!</p>
      )}

      <div className="chat-box__footer">
        <input
          className="chat-box__input"
          type="text"
          placeholder={isActive ? 'Say something…' : 'Multiplayer only'}
          value={text}
          disabled={!isActive || isMuted}
          maxLength={200}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="chat-box__send-btn"
          disabled={!canSend || !text.trim()}
          onClick={handleSend}
        >
          Send
        </button>
      </div>
    </div>
  )
}
