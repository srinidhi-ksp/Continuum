import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Patient from "./pages/Patient";
import DailyCare from "./pages/DailyCare";
import Timeline from "./pages/Timeline";
import Medications from "./pages/Medications";
import CareCircle from "./pages/CareCircle";
import SettingsPage from "./pages/SettingsPage";
import AcceptInvite from "./pages/AcceptInvite";
import LoginPage from "./pages/LoginPage";
import Reports from "./pages/Reports";
import MicroLearning from "./pages/MicroLearning";
import Assistant from "./pages/Assistant";

import MainLayout from "./components/MainLayout";
import { AuthProvider } from "./context/AuthContext";
import { PatientProvider } from "./context/PatientContext";
import { useAuth } from "./context/AuthContext";

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join" element={<AcceptInvite />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <MainLayout>
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