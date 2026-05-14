import { Route, Routes } from "react-router-dom";
import LoginView from "./features/auth/LoginView";
import LobbyView from "./features/lobby/LobbyView";
import GameView from "./features/game/GameView";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginView />} />
      <Route path="/lobby" element={<LobbyView />} />
      <Route path="/game/:roomCode" element={<GameView />} />
    </Routes>
  );
}
