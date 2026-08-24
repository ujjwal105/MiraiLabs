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
          <NavLink to="/schedule" className={navLinkClass}>
            Schedule
          </NavLink>
          <NavLink to="/conflicts" className={navLinkClass}>
            Conflicts
          </NavLink>
          <NavLink to="/replan" className={navLinkClass}>
            Replan
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
