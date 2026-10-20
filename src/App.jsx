import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Dashboard from "./pages/Dashboard";
import Patient from "./pages/Patient";

const DailyCare = lazy(() => import("./pages/DailyCare"));
const Timeline = lazy(() => import("./pages/Timeline"));
const Medications = lazy(() => import("./pages/Medications"));
const CareCircle = lazy(() => import("./pages/CareCircle"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Reports = lazy(() => import("./pages/Reports"));
const MicroLearning = lazy(() => import("./pages/MicroLearning"));
const Assistant = lazy(() => import("./pages/Assistant"));

import MainLayout from "./components/MainLayout";
import { AuthProvider } from "./context/AuthContext";
import { PatientProvider } from "./context/PatientContext";
import { useAuth } from "./context/AuthContext";

function RouteLoading() {
  return (
    <div className="shell-state" role="status">
      <div className="shell-thread" aria-hidden="true"><span /><span /><span /></div>
      <p>Opening your care space…</p>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<RouteLoading />}><LoginPage /></Suspense>} />
      <Route path="/join" element={<Suspense fallback={<RouteLoading />}><AcceptInvite /></Suspense>} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <MainLayout>
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/patient" element={<Patient />} />
                  <Route path="/daily-care" element={<DailyCare />} />
                  <Route path="/timeline" element={<Timeline />} />
                  <Route path="/medications" element={<Medications />} />
                  <Route path="/care-circle" element={<CareCircle />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/learn" element={<MicroLearning />} />
                  <Route path="/assistant" element={<Assistant />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
            </MainLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <PatientProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PatientProvider>
    </AuthProvider>
  );
}

export default App;