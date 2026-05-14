import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectSocket } from "../../services/socket";
import { useSession } from "../../stores/session";

export default function LobbyView() {
  const [roomCode, setRoomCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useSession();

  const handleCreateRoom = () => {
    if (!user) {
      setStatus("Login required to create a room.");
      return;
    }
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    const socket = connectSocket();
    socket.emit("create-room", { code, userId: user.id, displayName: user.displayName }, (ack) => {
      if (!ack?.ok) {
        setStatus(ack?.error ?? "Unable to create room.");
        return;
      }
      setStatus("Room created. Share the code to invite a friend.");
    });
    setCreatedCode(code);
    setRoomCode(code);
  };

  const handleJoinRoom = () => {
    if (!roomCode) {
      return;
    }
    if (!user) {
      setStatus("Login required to join a room.");
      return;
    }
    const socket = connectSocket();
    socket.emit(
      "join-room",
      { code: roomCode.toUpperCase(), userId: user.id, displayName: user.displayName },
      (ack) => {
        if (!ack?.ok) {
          setStatus(ack?.error ?? "Unable to join room.");
          return;
        }
        navigate(`/game/${roomCode.toUpperCase()}`);
      }
    );
  };

  return (
    <section className="panel panel--wide">
      <h1>ChessBlackJack Setup</h1>
      <p>Invite a friend with a room code or join an existing room.</p>
      {status ? <p className="status">{status}</p> : null}

      <div className="setup">
        <div className="board-placeholder">
          <div className="board-placeholder__inner">Chessboard placeholder</div>
        </div>

        <div className="stack">
          <button type="button" className="button" onClick={handleCreateRoom}>
            Create Room Code
          </button>
          {createdCode ? (
            <div className="code-card">
              <span>Share this code</span>
              <strong>{createdCode}</strong>
            </div>
          ) : null}
          <label className="field">
            <span>Room code</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder="ABCD"
            />
          </label>
          <button type="button" className="button" disabled={!roomCode} onClick={handleJoinRoom}>
            Join Room
          </button>
        </div>
      </div>
    </section>
  );
}
