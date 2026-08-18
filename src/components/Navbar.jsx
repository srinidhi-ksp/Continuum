import { Bell, Search } from "lucide-react";

function Navbar() {
  return (
    <header className="navbar">

      <div className="navbar-left">
        <h3>Dashboard</h3>
      </div>

      <div className="navbar-right">

        <button className="icon-button">
          <Search size={19} />
        </button>

        <button className="icon-button">
          <Bell size={19} />
        </button>

        <div className="profile">
          <div className="profile-avatar">
            S
          </div>

          <div className="profile-info">
            <span className="profile-name">Srinidhi</span>
            <span className="profile-role">Caregiver</span>
          </div>
        </div>

      </div>

    </header>
  );
}

export default Navbar;