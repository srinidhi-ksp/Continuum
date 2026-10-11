import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  UserRound,
  ClipboardPlus,
  Clock3,
  UsersRound,
  Settings,
  Pill,
  FileText,
  BookOpen,
  Bot
} from "lucide-react";

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        <div className="logo-mark">C</div>
        <span>CONTINUUM</span>
      </div>

      <nav className="sidebar-nav">

        <NavLink to="/" end className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/patient" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <UserRound size={20} />
          <span>Patient</span>
        </NavLink>

        <NavLink to="/daily-care" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <ClipboardPlus size={20} />
          <span>Daily Care</span>
        </NavLink>

        <NavLink to="/medications" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Pill size={20} />
          <span>Medications</span>
        </NavLink>

        <NavLink to="/timeline" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Clock3 size={20} />
          <span>Timeline</span>
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <FileText size={20} />
          <span>Reports</span>
        </NavLink>

        <NavLink to="/learn" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <BookOpen size={20} />
          <span>Learn</span>
        </NavLink>

        <NavLink to="/assistant" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Bot size={20} />
          <span>Assistant</span>
        </NavLink>

      </nav>

      <div className="sidebar-bottom">

        <NavLink to="/care-circle" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <UsersRound size={20} />
          <span>Care Circle</span>
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>

      </div>

    </aside>
  );
}

export default Sidebar;