import { Route, Routes } from "react-router";
import App from "../App";
import SortingGame from "../pages/game/sortingGame/sortingGame";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/sorting" element={<SortingGame />} />
    </Routes>
  );
}
