import { useState } from "react";

export default function LobbyView() {
  const [roomCode, setRoomCode] = useState("");

  return (
    <section className="panel">
      <h1>Lobby</h1>
      <div className="stack">
        <button type="button" className="button">
          Create Room
        </button>
        <label className="field">
          <span>Room code</span>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="ABCD"
          />
        </label>
        <button type="button" className="button" disabled={!roomCode}>
          Join Room
        </button>
      </div>
    </section>
  );
}
