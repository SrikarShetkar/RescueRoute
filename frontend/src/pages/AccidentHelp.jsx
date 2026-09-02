import React from 'react';
import './AccidentHelp.css';

const AccidentHelp = () => {
  return (
    <div className="accident-page">
      <section className="accident-hero">
        <div className="container">
          <h1>Accident Emergency Response</h1>
          <p>Lock-screen triggers and bystander help for unconscious victims</p>
        </div>
      </section>

      <section className="accident-content">
        <div className="container">
          <div className="scenarios-grid">
            <div className="scenario-card conscious">
              <div className="scenario-icon">👤</div>
              <h2>Conscious Victim</h2>
              <p>If you're able to use your phone after an accident</p>
              
              <div className="steps">
                <div className="step">
                  <span className="step-num">1</span>
                  <div>
                    <h4>Triple Press Power Button</h4>
                    <p>Emergency SOS activates lock-screen button</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">2</span>
                  <div>
                    <h4>Tap Emergency Icon</h4>
                    <p>No unlock needed - works from lock screen</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">3</span>
                  <div>
                    <h4>Location Sent Automatically</h4>
                    <p>GPS coordinates sent to emergency services</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">4</span>
                  <div>
                    <h4>Help Arrives</h4>
                    <p>Ambulance dispatched with your exact location</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="scenario-card unconscious">
              <div className="scenario-icon">🆘</div>
              <h2>Unconscious Victim</h2>
              <p>For bystanders helping someone who can't use their phone</p>
              
              <div className="steps">
                <div className="step">
                  <span className="step-num">1</span>
                  <div>
                    <h4>Open RescueRoute App</h4>
                    <p>Bystander opens app on their own phone</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">2</span>
                  <div>
                    <h4>Tap "Report Accident"</h4>
                    <p>Enter basic details about the victim</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">3</span>
                  <div>
                    <h4>Provide Visible Info</h4>
                    <p>Age estimate, injuries, consciousness level</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">4</span>
                  <div>
                    <h4>Stay With Victim</h4>
                    <p>App guides you through first aid until help arrives</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="features-section">
            <h2>Why RescueRoute Accident Response Works</h2>
            <div className="features-row">
              <div className="feature-box">
                <span className="feature-emoji">📍</span>
                <h3>Automatic Location</h3>
                <p>GPS coordinates sent without user input</p>
              </div>
              <div className="feature-box">
                <span className="feature-emoji">🔒</span>
                <h3>Lock Screen Access</h3>
                <p>No unlock needed in emergency situations</p>
              </div>
              <div className="feature-box">
                <span className="feature-emoji">⚡</span>
                <h3>Instant Dispatch</h3>
                <p>Ambulance alerted within seconds</p>
              </div>
              <div className="feature-box">
                <span className="feature-emoji">🤝</span>
                <h3>Bystander Support</h3>
                <p>Anyone can help using their own phone</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AccidentHelp;