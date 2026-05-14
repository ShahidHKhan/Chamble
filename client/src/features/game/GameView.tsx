import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { connectSocket, disconnectSocket } from "../../services/socket";
import { useSession } from "../../stores/session";
import type { RoomPresencePlayer } from "../../shared/protocol";

export default function GameView() {
  const { roomCode } = useParams();
  const { user } = useSession();
  const [players, setPlayers] = useState<RoomPresencePlayer[]>([]);
  const [status, setStatus] = useState("Connecting...");

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

    return () => {
      socket.off("room-presence");
      disconnectSocket();
    };
  }, [roomCode, user]);

  return (
    <section className="panel">
      <h1>ChessBlackJack Room</h1>
      <p>Room: {roomCode}</p>
      <p>{status}</p>
      <div className="card">
        <h2>Players Connected</h2>
        <p>{players.length} / 2</p>
        <ul className="list">
          {players.map((player) => (
            <li key={player.id} className="list__item">
              <span>{player.displayName}</span>
            </li>
          ))}
        </ul>
      </div>
      <p>Chess board and blackjack overlay will mount here.</p>
    </section>
  );
}
