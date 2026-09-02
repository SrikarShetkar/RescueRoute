import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLE_META, ROLES } from '../context/AuthContext';
import Icon from '../components/Icon';
import './Login.css';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const AMBULANCES = ['AMB-001', 'AMB-002', 'AMB-003'];
const HOSPITALS = [
  { id: 'HOSP-001', label: 'Apollo Hospital' },
  { id: 'HOSP-002', label: 'Care Hospital' },
  { id: 'HOSP-003', label: 'Gandhi Hospital' },
];

/**
 * Each role needs its own questions — an ambulance driver does not register
 * with blood-group allergies, and a hospital does not register a vehicle number.
 */
const REGISTER_FIELDS = {
  reporter: [
    { key: 'name', label: 'Full name', icon: 'user', ph: 'Your name' },
    { key: 'phone', label: 'Contact phone', icon: 'phone', ph: '+91 98765 43210' },
    { key: 'age', label: 'Age', icon: 'age', ph: 'e.g. 29', type: 'number' },
    { key: 'bloodGroup', label: 'Blood group', icon: 'blood', type: 'select', options: BLOOD },
    { key: 'allergies', label: 'Allergies', icon: 'alert', ph: 'e.g. Peanuts, Aspirin' },
    { key: 'emergencyContact', label: 'Emergency contact', icon: 'sos', ph: '+91 …' },
  ],
  ambulance: [
    { key: 'name', label: 'Driver name', icon: 'user', ph: "Driver's name" },
    { key: 'phone', label: 'Contact phone', icon: 'phone', ph: '+91 98765 43210' },
    { key: 'ambulanceId', label: 'Ambulance unit', icon: 'ambulance', type: 'select', options: AMBULANCES },
    { key: 'vehicleNumber', label: 'Vehicle number', icon: 'tag', ph: 'TS-09-AB-1234' },
    { key: 'license', label: 'Driving licence', icon: 'id', ph: 'e.g. HVDL-88231' },
  ],
  hospital: [
    { key: 'name', label: 'Staff name', icon: 'user', ph: 'Your name' },
    { key: 'phone', label: 'Contact phone', icon: 'phone', ph: '+91 98765 43210' },
    { key: 'hospitalId', label: 'Hospital', icon: 'hospital', type: 'select', options: HOSPITALS },
    { key: 'staffId', label: 'Staff ID', icon: 'id', ph: 'e.g. HOS-24-001' },
  ],
  dispatch: [
    { key: 'name', label: 'Dispatcher name', icon: 'user', ph: 'Your name' },
    { key: 'phone', label: 'Contact phone', icon: 'phone', ph: '+91 98765 43210' },
    { key: 'stationId', label: 'Control room ID', icon: 'console', ph: 'e.g. CR-01' },
  ],
  driver: [
    { key: 'name', label: 'Your name', icon: 'user', ph: 'Your name' },
    { key: 'phone', label: 'Contact phone', icon: 'phone', ph: '+91 98765 43210' },
    { key: 'vehicleNumber', label: 'Vehicle number', icon: 'car', ph: 'TS-07-JK-2211' },
  ],
};

const DEMO = [
  ['citizen', 'reporter'],
  ['driver.amb', 'ambulance'],
  ['er.staff', 'hospital'],
  ['control', 'dispatch'],
  ['nearby', 'driver'],
];

const Login = () => {
  const [mode, setMode] = useState('signin'); // signin | register
  const [role, setRole] = useState('ambulance');
  const [data, setData] = useState({});
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => setData((d) => ({ ...d, [key]: e.target.value }));
  const selected = REGISTER_FIELDS[role] || [];

  const goHome = (account) => navigate(ROLE_META[account.role].home || '/', { replace: true });

  const handleSignIn = (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const res = login({ username: data.username, password: data.password });
    if (!res.ok) {
      setError(res.error);
      setIsSubmitting(false);
      return;
    }
    if (res.user.role !== role) {
      setError(`That username belongs to the ${ROLE_META[res.user.role].label} role — pick that role instead.`);
      setIsSubmitting(false);
      return;
    }
    goHome(res.user);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');
    if (data.password !== data.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    const meta = {};
    selected.forEach((f) => {
      if (f.key !== 'name' && f.key !== 'phone' && data[f.key]) meta[f.key] = data[f.key];
    });
    const res = register({ username: data.username, password: data.password, role, name: data.name, phone: data.phone, meta });
    if (!res.ok) {
      setError(res.error);
      setIsSubmitting(false);
      return;
    }
    goHome(res.user);
  };

  return (
    <div className="login-page">
      <div className="login-overlay"></div>
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <span className="logo-icon"><Icon name={mode === 'register' ? 'user' : 'sos'} size={30} /></span>
            <h1>{mode === 'register' ? 'Create your role account' : 'Sign in to your role'}</h1>
            <p>Each role gets its own dashboard. Choose who you are to continue.</p>
          </div>

          {/* mode tabs */}
          <div className="login-tabs">
            <button className={mode === 'signin' ? 'tab on' : 'tab'} onClick={() => { setMode('signin'); setError(''); }}>Sign in</button>
            <button className={mode === 'register' ? 'tab on' : 'tab'} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
          </div>

          {/* role picker */}
          <div className="role-picker">
            {ROLES.map((r) => (
              <button key={r} className={`role-card ${role === r ? 'on' : ''}`} onClick={() => { setRole(r); setError(''); }} type="button">
                <span className="role-icon"><Icon name={ROLE_META[r].icon} size={22} /></span>
                <span className="role-name">{ROLE_META[r].label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'signin' ? handleSignIn : handleRegister} className="login-form">
            {error && <div className="error-message">{error}</div>}

            {mode === 'register' && (
              <>
                <div className="form-grid">
                  {selected.map((f) => (
                    <div className="form-group" key={f.key}>
                      <label>{f.label}</label>
                      <div className="input-wrapper">
                        <span className="input-icon"><Icon name={f.icon} size={15} /></span>
                        {f.type === 'select' ? (
                          <select value={data[f.key] || ''} onChange={set(f.key)} required>
                            <option value="" disabled>Select…</option>
                            {(f.key === 'hospitalId' ? HOSPITALS : f.options).map((o) => (
                              <option key={o.id || o} value={o.id || o}>{o.id ? `${o.id} — ${o.label}` : o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type || 'text'}
                            placeholder={f.ph}
                            value={data[f.key] || ''}
                            onChange={set(f.key)}
                            required
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="form-grid">
              <div className="form-group full-width">
                <label>{mode === 'signin' ? 'Username' : 'Create a username'}</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Icon name="user" size={15} /></span>
                  <input type="text" placeholder="e.g. driver.amb" value={data.username || ''} onChange={set('username')} required />
                </div>
              </div>
            </div>

            {mode === 'register' && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Icon name="lock" size={15} /></span>
                    <input type="password" placeholder="••••••••" value={data.password || ''} onChange={set('password')} required minLength={4} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm password</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Icon name="lock" size={15} /></span>
                    <input type="password" placeholder="••••••••" value={data.confirm || ''} onChange={set('confirm')} required />
                  </div>
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div className="input-wrapper">
                <span className="input-icon"><Icon name="lock" size={15} /></span>
                <input type="password" placeholder="Password" value={data.password || ''} onChange={set('password')} required />
              </div>
            )}

            <button type="submit" className="login-btn" disabled={isSubmitting}>
              {isSubmitting ? <span className="spinner"></span> : mode === 'signin' ? `ENTER ${ROLE_META[role].label.toUpperCase()}` : `CREATE ${ROLE_META[role].label.toUpperCase()}`}
            </button>
          </form>

          <div className="demo-box">
            <button className="demo-toggle" onClick={() => setShowDemo(!showDemo)} type="button">
              {showDemo ? '▾' : '▸'} Demo accounts (password: <b>password</b>)
            </button>
            {showDemo && (
              <div className="demo-list">
                {DEMO.map(([u, r]) => (
                  <button key={u} className="demo-row" type="button" onClick={() => { setRole(r); setData((d) => ({ ...d, username: u, password: 'password' })); }}>
                    <span><Icon name={ROLE_META[r].icon} size={16} /></span>
                    <span className="demo-user">{u}</span>
                    <span className="muted">{ROLE_META[r].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="login-footer">
            <p>
              {mode === 'signin' ? "Don't have an account yet?" : 'Already have one?'}
              <button className="toggle-btn" onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setError(''); }}>
                {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;