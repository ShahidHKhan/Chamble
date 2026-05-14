import { Route, Routes } from "react-router-dom";
import LoginView from "./features/auth/LoginView";
import HomeView from "./features/home/HomeView";
import LobbyView from "./features/lobby/LobbyView";
import GameView from "./features/game/GameView";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginView />} />
      <Route path="/home" element={<HomeView />} />
      <Route path="/play/chess-blackjack" element={<LobbyView />} />
      <Route path="/game/:roomCode" element={<GameView />} />
    </Routes>
  );
}
