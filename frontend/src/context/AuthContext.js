import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { googleAuth as apiGoogleAuth, assignRole as apiAssignRole } from '../services/authApi';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

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
const STORAGE_TOKEN = 'res_q_token';
const SEED_KEY = 'res_q_demo_seeded';
const SEED_VERSION = '2';

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
  const cur = localStorage.getItem(SEED_KEY);
  const demo = [
    { id: 'demo-1', username: 'citizen', password: 'password', role: 'reporter', name: 'Rajesh Kumar', phone: '+91 98765 43210', age: 52, bloodGroup: 'B+', allergies: 'Penicillin', emergencyContact: '+91 98765 43211', vehicleNumber: 'TS09AB1234', aadhaar: '1234 5678 9012' },
    { id: 'demo-2', username: 'driver.amb', password: 'password', role: 'ambulance', name: 'Rahul Verma', phone: '+91 90000 00002', ambulanceId: 'AMB-001', vehicleNumber: 'TS-09-AB-1234', license: 'HVDL-88231' },
    { id: 'demo-3', username: 'er.staff', password: 'password', role: 'hospital', name: 'Dr. Priya Nair', phone: '+91 90000 00003', hospitalId: 'HOSP-001', staffId: 'HOS-24-001' },
    { id: 'demo-4', username: 'control', password: 'password', role: 'dispatch', name: 'Kiran Rao', phone: '+91 90000 00004', stationId: 'CR-01' },
    { id: 'demo-5', username: 'nearby', password: 'password', role: 'driver', name: 'Mohit Gupta', phone: '+91 90000 00005', vehicleNumber: 'TS-07-JK-2211' },
  ];

  const citizen = (i, name, phone, age, bg, allergies, ec) => ({
    id: `demo-c${i}`, username: `citizen${i}`, password: 'password', role: 'reporter',
    name, phone, age, bloodGroup: bg, allergies, emergencyContact: ec,
  });
  const hospital = (i, label, staff, hid, staffId, phone) => ({
    id: `demo-h${i}`, username: `hospital${i}`, password: 'password', role: 'hospital',
    name: staff, phone: phone || `+91 90000 0200${i}`, hospitalId: hid, staffId,
  });
  const ambulance = (i, name, phone, aid, veh) => ({
    id: `demo-a${i}`, username: `ambulance${i}`, password: 'password', role: 'ambulance',
    name, phone, ambulanceId: aid, vehicleNumber: veh, license: `HVDL-${99900 + i}`,
  });
  const driver = (i, name, phone, veh) => ({
    id: `demo-d${i}`, username: `driver${i}`, password: 'password', role: 'driver',
    name, phone, vehicleNumber: veh,
  });

  demo.push(
    citizen(1, 'Ananya Iyer', '+91 90000 00011', 34, 'B+', 'None', '+91 90000 01011'),
    citizen(2, 'Ravi Deshmukh', '+91 90000 00012', 41, 'A-', 'Peanuts', '+91 90000 01012'),
    citizen(3, 'Sneha Kulkarni', '+91 90000 00013', 26, 'O-', 'None', '+91 90000 01013'),
    hospital(1, 'Care Hospital · ER', 'Dr. Vikram Singh', 'HOSP-002', 'HOS-24-101'),
    hospital(2, 'Gandhi Hospital · ER', 'Dr. Meera Joshi', 'HOSP-003', 'HOS-24-102'),
    hospital(3, 'Fernandez Hospital · ER', 'Dr. Arjun Reddy', 'HOSP-005', 'HOS-24-103'),
    ambulance(1, 'Kavita Nair', 'AMB-001', 'TS-09-CD-2211'),
    ambulance(2, 'Suresh Patel', 'AMB-002', 'TS-09-EF-3311'),
    ambulance(3, 'Deepak Kumar', 'AMB-003', 'TS-09-GH-4411'),
    driver(1, 'Rajesh Yadav', 'TS-01-AA-1100'),
    driver(2, 'Pooja Menon', 'TS-02-BB-2200'),
    driver(3, 'Imran Khan', 'TS-03-CC-3300')
  );

  const existing = readList();
  const merged = [...existing];
  demo.forEach((d) => {
    if (!merged.some((u) => u.id === d.id)) merged.push(d);
  });

  if (cur !== SEED_VERSION) {
    writeList(merged);
    localStorage.setItem(SEED_KEY, SEED_VERSION);
  } else if (existing.length === 0) {
    writeList(demo);
    localStorage.setItem(SEED_KEY, SEED_VERSION);
  }
}

function persistSession(user, token) {
  if (user?.role === 'ambulance' && user.ambulanceId) localStorage.setItem('rr_ambulance', user.ambulanceId);
  if (user?.role === 'hospital' && user.hospitalId) localStorage.setItem('rr_hospital', user.hospitalId);
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  if (token) localStorage.setItem(STORAGE_TOKEN, token);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_TOKEN));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedDemoAccounts();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_USER));
      if (saved && saved.role && ROLES.includes(saved.role)) {
        setUser(saved);
      } else {
        localStorage.removeItem(STORAGE_USER);
      }
    } catch {
      localStorage.removeItem(STORAGE_USER);
    }
    setLoading(false);
  }, []);

  const login = useCallback(({ username, password }) => {
    const account = readList().find((u) => u.username.toLowerCase() === String(username).trim().toLowerCase());
    if (!account) return { ok: false, error: 'No account with that username. Create one first.' };
    if (account.password !== password) return { ok: false, error: 'Incorrect password.' };
    setUser(account);
    persistSession(account, null);
    return { ok: true, user: account };
  }, []);

  const register = useCallback((data) => {
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
    persistSession(account, null);
    return { ok: true, user: account };
  }, []);

  const googleLogin = useCallback(async (idToken, role) => {
    const res = await apiGoogleAuth(idToken, role);
    if (!res.success) return { ok: false, error: res.message };

    const backendUser = res.user;
    const normalizedUser = {
      id: backendUser.id,
      backendId: backendUser.id,
      email: backendUser.email,
      name: backendUser.name,
      role: backendUser.role,
      avatar: backendUser.avatar,
      phone: backendUser.phone,
      bloodGroup: backendUser.bloodGroup,
      allergies: backendUser.allergies,
      vehicleNumber: backendUser.vehicleNumber,
      identityProof: backendUser.identityProof,
      roleSelectionComplete: backendUser.roleSelectionComplete,
      authSource: 'google'
    };

    setUser(normalizedUser);
    setToken(res.token);
    persistSession(normalizedUser, res.token);
    return { ok: true, user: normalizedUser, needsRole: res.needsRole, token: res.token };
  }, []);

  const assignUserRole = useCallback(async (role) => {
    if (!token) return { ok: false, error: 'Not authenticated' };
    const res = await apiAssignRole(token, role);
    if (!res.success) return { ok: false, error: res.message };

    const backendUser = res.user;
    const normalizedUser = {
      ...user,
      id: backendUser.id,
      backendId: backendUser.id,
      role: backendUser.role,
      roleSelectionComplete: backendUser.roleSelectionComplete
    };

    setUser(normalizedUser);
    setToken(res.token);
    persistSession(normalizedUser, res.token);
    return { ok: true, user: normalizedUser, token: res.token };
  }, [token, user]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TOKEN);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, login, register, googleLogin, assignUserRole, logout,
      isAuthenticated: !!user, loading
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
