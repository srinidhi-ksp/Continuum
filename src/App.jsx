import React from "react";
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an error]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            padding: 24,
            fontFamily: "Inter, Arial, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "white",
              borderRadius: 18,
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              padding: 32,
              textAlign: "center",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 20, color: "#0f172a", margin: "0 0 8px" }}>
              Care View Recovered
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px", lineHeight: 1.5 }}>
              {this.state.error?.message || "An unexpected error occurred while loading this view."}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                background: "#5b57d9",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "10px 20px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <AuthProvider>
        <PatientProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PatientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;