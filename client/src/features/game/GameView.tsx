import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { connectSocket, disconnectSocket } from "../../services/socket";
import { useSession } from "../../stores/session";
import type {
  MoveAck,
  RoomPresencePlayer,
  RoomStatePayload
} from "../../shared/protocol";
import ChessBoard from "./ChessBoard";
import { Chess } from "chess.js";

export default function GameView() {
  const { roomCode } = useParams();
  const { user } = useSession();
  const [players, setPlayers] = useState<RoomPresencePlayer[]>([]);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [status, setStatus] = useState("Connecting...");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);
  const chessRef = useRef(new Chess());

  const chessInstance = chessRef.current;

  useEffect(() => {
    if (roomState?.fen) {
      chessInstance.load(roomState.fen);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [chessInstance, roomState?.fen]);

  const playerColor = useMemo(() => {
    if (!roomState || !user) {
      return null;
    }
    const player = roomState.players.find((entry) => entry.id === user.id);
    return player ? (roomState.players.indexOf(player) === 0 ? "white" : "black") : null;
  }, [roomState, user]);

  useEffect(() => {
    if (!roomCode || !user) {
      setStatus("Missing room or user.");
      return;
    }

    const socket = connectSocket();
    socket.emit(
      "join-room",
      { code: roomCode, userId: user.id, displayName: user.displayName },
      (ack) => {
        if (!ack?.ok) {
          setStatus(ack?.error ?? "Unable to join room.");
          return;
        }
        setStatus("Connected to room.");
      }
    );

    socket.on("room-presence", (payload) => {
      if (payload.roomCode !== roomCode) {
        return;
      }
      setPlayers(payload.players);
    });

    socket.on("room-state", (payload) => {
      if (payload.roomCode !== roomCode) {
        return;
      }
      setRoomState(payload);
    });

    return () => {
      socket.off("room-presence");
      socket.off("room-state");
      disconnectSocket();
    };
  }, [roomCode, user]);

  const handleSquareClick = (square: string, piece: string | null) => {
    if (!roomState || !user) {
      return;
    }

    setMoveError(null);

    const canMove = roomState.phase === "CHESS" && roomState.turn === playerColor;
    if (!canMove) {
      return;
    }

    if (selectedSquare && legalMoves.includes(square)) {
      const moveOptions = chessInstance.moves({
        square: selectedSquare,
        verbose: true
      });
      const matching = moveOptions.find((move) => move.to === square);
      const promotion = matching?.promotion;

      const socket = connectSocket();
      socket.emit(
        "make-move",
        {
          roomCode: roomState.roomCode,
          userId: user.id,
          from: selectedSquare,
          to: square,
          promotion
        },
        (ack: MoveAck) => {
          if (!ack.ok) {
            setMoveError(ack.error ?? "Move rejected.");
          }
        }
      );

      return;
    }

    if (!piece) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    const moves = chessInstance.moves({ square, verbose: true });
    if (!moves.length) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    setSelectedSquare(square);
    setLegalMoves(moves.map((move) => move.to));
  };

  return (
    <section className="game-shell">
      <header className="game-header">
        <div>
          <div className="game-title">CHESS21</div>
          <div className="game-pill">
            {roomState?.phase ?? "Loading"} phase
          </div>
        </div>
        <div className="game-actions">
          <button type="button" className="button button--ghost button--small" disabled>
            Resume timer
          </button>
        </div>
      </header>

      {moveError ? <p className="error">{moveError}</p> : null}

      <div className="game-body">
        <aside className="game-panel game-panel--blackjack">
          <div className="panel-title">
            Blackjack Duel
            <span className="panel-subtitle">You are attacking</span>
          </div>
          <div className="blackjack-section">
            <div className="blackjack-label">Dealer</div>
            <div className="card-row">
              <div className="card-chip">A</div>
            </div>
            <div className="blackjack-score">Score: 4</div>
          </div>
          <div className="blackjack-section">
            <div className="blackjack-label">Attacker</div>
            <div className="card-row">
              <div className="card-chip">2</div>
              <div className="card-chip">10</div>
              <div className="card-chip">7</div>
              <div className="card-chip">10</div>
            </div>
            <div className="blackjack-score">Score: 26</div>
          </div>
          <div className="blackjack-actions">
            <button type="button" className="button button--ghost" disabled>
              Hit
            </button>
            <button type="button" className="button button--ghost" disabled>
              Stand
            </button>
          </div>
        </aside>

        <main className="game-center">
          <div className="game-status">
            <span className={`status-dot ${roomState?.turn === playerColor ? "status-dot--live" : ""}`} />
            {status}
          </div>
          <div className="board-card">
            {roomState ? (
              <ChessBoard
                fen={roomState.fen}
                orientation={playerColor ?? "white"}
                selectedSquare={selectedSquare}
                legalMoves={legalMoves}
                lastMove={roomState.lastMove ?? null}
                onSquareClick={handleSquareClick}
              />
            ) : (
              <p>Waiting for room state...</p>
            )}
          </div>
          <div className="game-footer">
            <div>Room: {roomCode}</div>
            <div>Color: {playerColor ?? "--"}</div>
          </div>
        </main>

        <aside className="game-panel game-panel--stats">
          <div className="stats-card">
            <div className="stats-title">Timers</div>
            <div className="stats-row">
              <span>White</span>
              <span>10:00</span>
            </div>
            <div className="stats-row">
              <span>Black</span>
              <span>10:00</span>
            </div>
          </div>
          <div className="stats-card">
            <div className="stats-title">Players</div>
            <div className="stats-row">
              <span>Connected</span>
              <span>{players.length} / 2</span>
            </div>
            <ul className="list list--compact">
              {players.map((player) => (
                <li key={player.id} className="list__item">
                  <span>{player.displayName}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="stats-card">
            <div className="stats-title">Move History</div>
            {roomState?.moveHistory.length ? (
              <ol className="history">
                {roomState.moveHistory.map((move, index) => (
                  <li key={`${move}-${index}`}>{move}</li>
                ))}
              </ol>
            ) : (
              <p className="muted">No moves yet.</p>
            )}
          </div>
          <div className="stats-card">
            <div className="stats-title">Evaluation</div>
            <div className="eval-gauge">
              <div className="eval-gauge__fill" />
              <div className="eval-gauge__labels">
                <span>Black +0.0</span>
                <span>White +0.0</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
