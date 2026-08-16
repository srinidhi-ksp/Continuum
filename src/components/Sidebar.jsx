function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>CONTINUUM</h2>

      <nav>
        <a href="/">Dashboard</a>
        <a href="/patient">Patient</a>
        <a href="/daily-care">Daily Care</a>
        <a href="/timeline">Timeline</a>
      </nav>
    </aside>
  );
}

export default Sidebar;