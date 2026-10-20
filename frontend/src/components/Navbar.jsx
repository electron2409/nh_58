import React from 'react'

export default function Navbar({
  dates,
  currentDateIndex,
  onDateIndexChange,
  activeTab,
  onTabChange,
  backendStatus,
  aiStatus
}) {
  const currentDate = dates[currentDateIndex] || 'Loading...'

  const milestones = [
    { label: 'Monsoon Start', date: '2023-07-01' },
    { label: 'Mid-Monsoon', date: '2023-08-14' },
    { label: 'Peak 3-Day Rain (148mm)', date: '2023-09-15' },
    { label: 'Season End', date: '2023-09-30' }
  ]

  const handleMilestoneClick = (targetDate) => {
    const idx = dates.indexOf(targetDate)
    if (idx >= 0) onDateIndexChange(idx)
  }

  return (
    <header className="header-nav">
      <div className="header-top">
        <div className="brand-group">
          <div className="brand-badge">
            <span className="corridor-tag">CORRIDOR NH-58</span>
            <span className="stretch-tag">0 – 70 KM</span>
          </div>
          <div>
            <h1 className="brand-title">NH-58 Landslide Decision Support System</h1>
            <p className="brand-subtitle">
              Rishikesh to Devprayag Stretch • Dynamic Susceptibility & Rainfall Trigger Analysis (GEE / CHIRPS)
            </p>
          </div>
        </div>

        <div className="header-meta">
          <div className={`status-pill ${backendStatus.connected ? 'online' : 'offline'}`} title={backendStatus.message}>
            <span className="status-dot" />
            <span>{backendStatus.connected ? 'Backend Online' : 'Backend Offline'}</span>
          </div>

          <div className={`status-pill ${aiStatus?.ai_enabled ? 'ai-active' : 'ai-warn'}`}>
            <span className="status-dot" />
            <span>AI: {aiStatus?.configured_model || 'Gemini 3.5'}</span>
          </div>

          <div className="status-pill freshness">
            <span className="cal-icon">📅</span>
            <span>Active: <strong>{currentDate}</strong></span>
          </div>
        </div>
      </div>

      <div className="header-controls">
        <nav className="tab-nav">
          {[
            { id: 'overview', label: 'Overview & Risk Map', icon: '🗺️' },
            { id: 'analytics', label: 'Rainfall & Analytics', icon: '📊' },
            { id: 'register', label: 'Chainage Register', icon: '📋' },
            { id: 'models', label: 'Model Performance', icon: '🧠' },
            { id: 'ai', label: 'AI Geological Assessment', icon: '✨' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="timeline-control">
          <div className="timeline-header">
            <span className="timeline-label">Temporal Window (2023 Monsoon): <strong>{currentDate}</strong></span>
            <div className="milestone-chips">
              {milestones.map(m => (
                <button
                  key={m.date}
                  type="button"
                  className={`milestone-btn ${currentDate === m.date ? 'active' : ''}`}
                  onClick={() => handleMilestoneClick(m.date)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="slider-wrapper">
            <input
              type="range"
              min="0"
              max={Math.max(0, dates.length - 1)}
              value={currentDateIndex}
              onChange={e => onDateIndexChange(Number(e.target.value))}
              className="timeline-slider"
              aria-label="Select monsoon date"
            />
          </div>
        </div>
      </div>
    </header>
  )
}
