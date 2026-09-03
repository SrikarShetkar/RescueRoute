import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLE_META, ROLES } from '../context/AuthContext';
import Icon from '../components/Icon';
import './SelectRole.css';

const SelectRole = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, assignUserRole } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  if (user.role && user.roleSelectionComplete) {
    const home = ROLE_META[user.role]?.home || '/';
    navigate(home, { replace: true });
    return null;
  }

  const handleSelect = async () => {
    if (!selectedRole) {
      setError('Please select a role to continue.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const result = await assignUserRole(selectedRole);
      if (!result.ok) {
        setError(result.error || 'Failed to assign role. Please try again.');
        setIsSubmitting(false);
        return;
      }
      const home = ROLE_META[selectedRole]?.home || '/';
      if (!localStorage.getItem('rr_seen_demo')) {
        navigate(`/demo?next=${encodeURIComponent(home)}`, { replace: true });
      } else {
        navigate(home, { replace: true });
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="selectrole-page">
      <div className="selectrole-overlay"></div>
      <div className="selectrole-container">
        <div className="selectrole-card">
          <div className="selectrole-header">
            <span className="selectrole-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="avatar-img" />
              ) : (
                <Icon name="user" size={40} />
              )}
            </span>
            <h1>Welcome, {user.name}!</h1>
            <p>Choose your role to get started with RescueRoute.</p>
          </div>

          {error && <div className="selectrole-error">{error}</div>}

          <div className="selectrole-grid">
            {ROLES.map((r) => (
              <button
                key={r}
                className={`selectrole-card-item ${selectedRole === r ? 'selected' : ''}`}
                onClick={() => { setSelectedRole(r); setError(''); }}
                type="button"
                disabled={isSubmitting}
              >
                <span className="selectrole-icon"><Icon name={ROLE_META[r].icon} size={32} /></span>
                <span className="selectrole-label">{ROLE_META[r].label}</span>
                <span className="selectrole-desc">{ROLE_META[r].screen}</span>
              </button>
            ))}
          </div>

          <button
            className="selectrole-btn"
            onClick={handleSelect}
            disabled={!selectedRole || isSubmitting}
          >
            {isSubmitting ? <span className="selectrole-spinner"></span> : 'Continue'}
          </button>

          <div className="selectrole-footer">
            <button className="selectrole-back" onClick={() => navigate('/login', { replace: true })}>
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectRole;
