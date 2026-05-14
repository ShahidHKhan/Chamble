import { useParams } from "react-router-dom";

export default function GameView() {
  const { roomCode } = useParams();

  return (
    <section className="panel">
      <h1>Game Room</h1>
      <p>Room: {roomCode}</p>
      <p>Chess board and blackjack overlay will mount here.</p>
    </section>
  );
}
