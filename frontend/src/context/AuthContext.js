import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

/**
 * Roles in the demo. Each role maps to exactly ONE dashboard, so access is
 * strictly role-based: an ambulance account can only reach /ambulance, etc.
 */
export const ROLES = ['reporter', 'ambulance', 'hospital', 'dispatch', 'driver'];

export const ROLE_META = {
  reporter: { label: 'Citizen / Reporter', home: '/report', screen: 'Report & Track', icon: 'sos' },
  ambulance: { label: 'Ambulance Driver', home: '/ambulance', screen: 'Ambulance', icon: 'ambulance' },
  hospital: { label: 'Hospital ER Staff', home: '/hospital', screen: 'Hospital', icon: 'hospital' },
  dispatch: { label: 'Control Room Dispatcher', home: '/control-room', screen: 'Control Room', icon: 'console' },
  driver: { label: 'Nearby Driver', home: '/driver', screen: 'Nearby Driver', icon: 'car' },
};

const STORAGE_USERS = 'res_q_users';
const STORAGE_USER = 'res_q_user';
const SEED_KEY = 'res_q_demo_seeded';

function readList() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USERS)) || [];
  } catch {
    return [];
  }
}

function writeList(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function seedDemoAccounts() {
  if (localStorage.getItem(SEED_KEY)) return;
  const demo = [
    { id: 'demo-1', username: 'citizen', password: 'password', role: 'reporter', name: 'Aarav Sharma', phone: '+91 90000 00001', age: 29, bloodGroup: 'O+', allergies: 'None', emergencyContact: '+91 90000 01001' },
    { id: 'demo-2', username: 'driver.amb', password: 'password', role: 'ambulance', name: 'Rahul Verma', phone: '+91 90000 00002', ambulanceId: 'AMB-001', vehicleNumber: 'TS-09-AB-1234', license: 'HVDL-88231' },
    { id: 'demo-3', username: 'er.staff', password: 'password', role: 'hospital', name: 'Dr. Priya Nair', phone: '+91 90000 00003', hospitalId: 'HOSP-001', staffId: 'HOS-24-001' },
    { id: 'demo-4', username: 'control', password: 'password', role: 'dispatch', name: 'Kiran Rao', phone: '+91 90000 00004', stationId: 'CR-01' },
    { id: 'demo-5', username: 'nearby', password: 'password', role: 'driver', name: 'Mohit Gupta', phone: '+91 90000 00005', vehicleNumber: 'TS-07-JK-2211' },
  ];
  writeList(demo);
  localStorage.setItem(SEED_KEY, '1');
}

function persistSession(user) {
  // Pick the demo unit that matches the account, so each laptop IS its role.
  if (user?.role === 'ambulance' && user.ambulanceId) localStorage.setItem('rr_ambulance', user.ambulanceId);
  if (user?.role === 'hospital' && user.hospitalId) localStorage.setItem('rr_hospital', user.hospitalId);
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedDemoAccounts();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_USER));
      // Accounts from the old generic demo (no role) are no longer valid.
      if (saved && ROLES.includes(saved.role)) setUser(saved);
      else localStorage.removeItem(STORAGE_USER);
    } catch {
      localStorage.removeItem(STORAGE_USER);
    }
    setLoading(false);
  }, []);

  const login = ({ username, password }) => {
    const account = readList().find((u) => u.username.toLowerCase() === String(username).trim().toLowerCase());
    if (!account) return { ok: false, error: 'No account with that username. Create one first.' };
    if (account.password !== password) return { ok: false, error: 'Incorrect password.' };
    setUser(account);
    persistSession(account);
    return { ok: true, user: account };
  };

  const register = (data) => {
    const users = readList();
    const username = String(data.username).trim();
    if (!username || !data.password) return { ok: false, error: 'Username and password are required.' };
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: 'That username is already taken.' };
    }
    const account = {
      id: 'u-' + Date.now(),
      username,
      password: data.password,
      role: data.role,
      name: data.name,
      phone: data.phone,
      ...data.meta,
    };
    users.push(account);
    writeList(users);
    setUser(account);
    persistSession(account);
    return { ok: true, user: account };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_USER);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};