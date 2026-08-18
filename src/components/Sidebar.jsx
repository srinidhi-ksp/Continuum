import {
  LayoutDashboard,
  UserRound,
  ClipboardPlus,
  Clock3,
  UsersRound,
  Settings,
} from "lucide-react";

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        <div className="logo-mark">C</div>
        <span>CONTINUUM</span>
      </div>

      <nav className="sidebar-nav">

        <a href="/" className="nav-item active">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </a>

        <a href="/patient" className="nav-item">
          <UserRound size={20} />
          <span>Patient</span>
        </a>

        <a href="/daily-care" className="nav-item">
          <ClipboardPlus size={20} />
          <span>Daily Care</span>
        </a>

        <a href="/timeline" className="nav-item">
          <Clock3 size={20} />
          <span>Timeline</span>
        </a>

      </nav>

      <div className="sidebar-bottom">

        <a href="#" className="nav-item">
          <UsersRound size={20} />
          <span>Care Circle</span>
        </a>

        <a href="#" className="nav-item">
          <Settings size={20} />
          <span>Settings</span>
        </a>

      </div>

    </aside>
  );
}

export default Sidebar;