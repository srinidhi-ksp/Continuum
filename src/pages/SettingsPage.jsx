// Honest placeholder — there is no settings functionality yet (no auth,
// no notification preferences, no account management). This just closes
// the dead sidebar link instead of a blank page. Gets its own real pass
// once auth exists.
function SettingsPage() {
  return (
    <div className="wt-dashboard">
      <div>
        <p className="wt-eyebrow">Settings</p>
        <h1 className="wt-greeting__title">Nothing to configure yet</h1>
        <p className="wt-greeting__sub">
          Account, notification, and care-circle settings will live here once
          authentication is wired up.
        </p>
      </div>
    </div>
  );
}

export default SettingsPage;
