import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import axios from 'axios';
import { LogOut, LayoutDashboard, Map as MapIcon } from 'lucide-react';

import { LoadScript } from '@react-google-maps/api';

axios.defaults.baseURL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001/api`;

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const NavContainer = ({ streetViewActive, onToggleStreetView, isMap }) => {
  if (!streetViewActive || !isMap) return null;
  return (
    <nav className="absolute top-6 right-16 z-[1000] flex gap-4">
      <button 
        onClick={onToggleStreetView}
        className="bg-[#A41C3A] hover:bg-[#8B1831] text-white px-4 py-2 rounded-lg flex items-center gap-2 border border-white/20 transition-all shadow-lg backdrop-blur-md font-bold"
      >
        <MapIcon size={18} /> Cerrar Street View
      </button>
    </nav>
  );
};

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [activeLayers, setActiveLayers] = useState([]);
  const [geoJsonData, setGeoJsonData] = useState({});
  const [focusFeature, setFocusFeature] = useState(null);
  const [layers, setLayers] = useState(null);
  const [isStreetViewActive, setIsStreetViewActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    console.log('[theme check] isDarkMode:', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const setAuth = (token, user) => {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('mapConfig');
      setToken(null);
      setUser(null);
      setActiveLayers([]);
      setGeoJsonData({});
      setLayers(null);
      // When explicitly logging out, we set this flag so we don't immediately auto-login as guest again
      // unless we want to go back to guest mode later.
      if (user?.username !== 'guest') {
        localStorage.setItem('manual_login_required', 'true');
      } else {
        localStorage.removeItem('manual_login_required');
      }
    }
  };

  const resetSearch = () => {
    setFocusFeature(null);
    setGeoJsonData({});
    setActiveLayers([]);
  };

  const toggleLayer = (layerName) => {
    setActiveLayers(prev => {
      const isTurningOff = prev.includes(layerName);
      if (isTurningOff) setFocusFeature(null);
      
      return isTurningOff 
        ? prev.filter(l => l !== layerName)
        : [...prev, layerName];
    });
  };

  const fetchLayers = async () => {
    if (!token) return;
    try {
      const res = await axios.get('/layers', { headers: { Authorization: `Bearer ${token}` } });
      setLayers(res.data);
    } catch (err) { console.error(err); }
  };

  const autoLoginGuest = async () => {
    try {
      // Auto-login as guest with the predefined credentials
      const res = await axios.post('/login', { username: 'guest', password: 'guest_access_no_pass' });
      setAuth(res.data.token, res.data.user);
    } catch (err) {
      console.error('Guest auto-login failed:', err);
    }
  };

  useEffect(() => {
    if (!token && !localStorage.getItem('manual_login_required')) {
      autoLoginGuest();
    }
  }, [token]);

  useEffect(() => {
    fetchLayers();
  }, [token]);

  return (
    <LoadScript googleMapsApiKey={GOOGLE_API_KEY}>
      <Router>
        {!token ? (
          <Login setAuth={setAuth} />
        ) : (
          <div className={`h-screen w-screen flex relative overflow-hidden ${isDarkMode ? 'dark' : ''} bg-slate-50 dark:bg-premium-900 font-sans text-slate-900 dark:text-white transition-colors duration-300`}>
            <Sidebar 
              token={token} 
              user={user}
              layers={layers}
              activeLayers={activeLayers} 
              toggleLayer={toggleLayer} 
              onLogout={() => setAuth(null, null)}
              geoJsonData={geoJsonData} 
              onFocusFeature={setFocusFeature}
            />
            <div className="flex-1 h-full relative overflow-hidden flex flex-col">
              <NavContainer 
                streetViewActive={isStreetViewActive} 
                onToggleStreetView={() => setIsStreetViewActive(false)}
                isMap={true} 
              />
              <Routes>
                <Route path="/" element={
                  <Map 
                    token={token} 
                    layers={layers}
                    activeLayers={activeLayers} 
                    geoJsonData={geoJsonData} 
                    setGeoJsonData={setGeoJsonData} 
                    focusFeature={focusFeature} 
                    onFocusFeature={setFocusFeature}
                    isStreetViewActive={isStreetViewActive}
                    setIsStreetViewActive={setIsStreetViewActive}
                  />
                } />
                <Route path="/admin" element={
                  user?.role === 'admin' ? 
                  <AdminPanel 
                    token={token} 
                    isDarkMode={isDarkMode} 
                    setIsDarkMode={setIsDarkMode} 
                    onMetadataUpdate={fetchLayers}
                  /> : <Navigate to="/" />
                } />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </div>
        )}
      </Router>
    </LoadScript>
  );
};

export default App;
