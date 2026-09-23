import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { usePatient } from "../context/PatientContext";

function AppShellState({ isLoading, loadError, isEmpty, onRetry }) {
  if (isLoading) {
    return (
      <div className="shell-state">
        <div className="shell-thread" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>Gathering the care circle…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="shell-state shell-state--error">
        <p className="shell-state__title">Couldn't reach Supabase</p>
        <p className="shell-state__detail">{loadError}</p>
        <p className="shell-state__hint">
          Check <code>.env</code> has valid <code>VITE_SUPABASE_URL</code> /{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>, and that the schema + seed SQL have been run.
        </p>
        <button type="button" className="shell-state__retry" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="shell-state">
        <p className="shell-state__title">No patients in your care circle yet</p>
        <p className="shell-state__hint">Add a patient to get started.</p>
      </div>
    );
  }

  return null;
}

function MainLayout({ children }) {
  const { isLoading, loadError, patients, reloadPatients } = usePatient();
  const isEmpty = !isLoading && !loadError && patients.length === 0;
  const showState = isLoading || loadError || isEmpty;

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-section">
        <Navbar />

        <main className="page-content">
          {showState ? (
            <AppShellState
              isLoading={isLoading}
              loadError={loadError}
              isEmpty={isEmpty}
              onRetry={reloadPatients}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
