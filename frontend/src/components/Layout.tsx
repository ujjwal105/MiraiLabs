import { NavLink, Outlet } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">Placement Week Scheduler</span>
        <nav className="app-nav">
          <NavLink to="/" className={navLinkClass} end>
            Dashboard
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
