import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Conflicts from "./pages/Conflicts";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="conflicts" element={<Conflicts />} />
      </Route>
    </Routes>
  );
}
