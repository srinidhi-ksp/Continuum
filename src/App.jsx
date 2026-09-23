import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Patient from "./pages/Patient";
import DailyCare from "./pages/DailyCare";
import Timeline from "./pages/Timeline";
import Medications from "./pages/Medications";
import CareCircle from "./pages/CareCircle";
import SettingsPage from "./pages/SettingsPage";

import MainLayout from "./components/MainLayout";
import { PatientProvider } from "./context/PatientContext";

function App() {
  return (
    <PatientProvider>
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patient" element={<Patient />} />
            <Route path="/daily-care" element={<DailyCare />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/medications" element={<Medications />} />
            <Route path="/care-circle" element={<CareCircle />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </PatientProvider>
  );
}

export default App;