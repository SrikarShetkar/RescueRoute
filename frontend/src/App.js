import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SoundCenter from './components/SoundCenter';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import SelectRole from './pages/SelectRole';
import ReporterScreen from './pages/ReporterScreen';
import Citizen from './pages/Citizen';
import AmbulanceScreen from './pages/AmbulanceScreen';
import HospitalScreen from './pages/HospitalScreen';
import ControlRoom from './pages/ControlRoom';
import DriverScreen from './pages/DriverScreen';
import Demo from './pages/Demo';
import Profile from './pages/Profile';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <SoundCenter />
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/select-role" element={<SelectRole />} />
              <Route path="/demo" element={<Demo />} />

              {/* Role-based access — each dashboard is locked to one role. */}
              <Route path="/citizen" element={<ProtectedRoute role="reporter"><Citizen /></ProtectedRoute>} />
              <Route path="/report" element={<ProtectedRoute role="reporter"><ReporterScreen /></ProtectedRoute>} />
              <Route path="/report/:eid" element={<ProtectedRoute role="reporter"><ReporterScreen /></ProtectedRoute>} />
              <Route path="/ambulance" element={<ProtectedRoute role="ambulance"><AmbulanceScreen /></ProtectedRoute>} />
              <Route path="/hospital" element={<ProtectedRoute role="hospital"><HospitalScreen /></ProtectedRoute>} />
              <Route path="/control-room" element={<ProtectedRoute role="dispatch"><ControlRoom /></ProtectedRoute>} />
              <Route path="/driver" element={<ProtectedRoute role="driver"><DriverScreen /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
