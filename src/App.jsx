import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Patient from "./pages/Patient";
import DailyCare from "./pages/DailyCare";
import Timeline from "./pages/Timeline";

import MainLayout from "./components/MainLayout";

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patient" element={<Patient />} />
          <Route path="/daily-care" element={<DailyCare />} />
          <Route path="/timeline" element={<Timeline />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;