import React from 'react'

const RISK_COLORS = {
  'VERY LOW': '#10b981',
  'LOW': '#84cc16',
  'MODERATE': '#f59e0b',
  'HIGH': '#f97316',
  'VERY HIGH': '#ef4444'
}

const fmt = (val, digits = 1) => {
  if (val == null || Number.isNaN(Number(val))) return 'N/A'
  return Number(val).toFixed(digits)
}

export default function SegmentDetail({
  segment,
  onOpenAiAssessment,
  onOpenAnalytics,
  onSelectSegment
}) {
  if (!segment) {
    return (
      <div className="segment-detail-card empty-state">
        <div className="empty-icon">🛣️</div>
        <h3>Select Highway Segment</h3>
        <p className="empty-desc">
          Click any segment line along the NH-58 Rishikesh–Devprayag corridor on the map,
          or choose a row from the Chainage Register below to inspect terrain parameters,
          rainfall triggers, and AI risk notes.
        </p>
        <div className="quick-select-row">
          <span className="quick-label">Try high-risk segments:</span>
          {[6, 9, 15, 16, 22].map(id => (
            <button
              key={id}
              type="button"
              className="quick-chip"
              onClick={() => onSelectSegment(id)}
            >
              km {id}-{id + 1}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const riskColor = RISK_COLORS[segment.current_risk] || '#94a3b8'
  const dominantFactors = segment.dominant_factors
    ? segment.dominant_factors.split(';').map(f => f.trim()).filter(Boolean)
    : []

  return (
    <div className="segment-detail-card">
      <div className="detail-header">
        <div>
          <span className="detail-eyebrow">CHAINAGE INSPECTION</span>
          <h2 className="detail-title">{segment.label} <span className="detail-id">(Seg #{segment.seg_id})</span></h2>
        </div>
        <div className="risk-pill-large" style={{ backgroundColor: riskColor }}>
          {segment.current_risk}
        </div>
      </div>

      {/* Decision matrix equation */}
      <div className="matrix-equation-box">
        <div className="equation-step">
          <span className="step-label">Static Susceptibility</span>
          <span className="step-value">{segment.susc_class_name || 'N/A'}</span>
          <span className="step-sub">Modelled score: {fmt(segment.susc_mean, 2)}</span>
        </div>
        <div className="equation-operator">+</div>
        <div className="equation-step">
          <span className="step-label">Rainfall Trigger</span>
          <span className="step-value">{segment.trigger_name || 'N/A'}</span>
          <span className="step-sub">Historical pctl: {fmt(segment.trigger_pct, 1)}%</span>
        </div>
        <div className="equation-operator">=</div>
        <div className="equation-step result">
          <span className="step-label">Screening Risk</span>
          <span className="step-value" style={{ color: riskColor }}>{segment.current_risk}</span>
          <span className="step-sub">Decision Matrix</span>
        </div>
      </div>

      {/* Rainfall Gauges */}
      <div className="stats-section">
        <div className="section-label">CHIRPS Rainfall Accumulation (5km Pixel)</div>
        <div className="rainfall-gauges">
          <div className="gauge-item">
            <span className="gauge-val">{fmt(segment.rain_1d, 0)} <small>mm</small></span>
            <span className="gauge-tag">1-Day Intensity</span>
            <span className="gauge-sub">pctl {fmt(segment.pct_1d, 0)}%</span>
          </div>
          <div className="gauge-item highlight">
            <span className="gauge-val">{fmt(segment.rain_3d, 0)} <small>mm</small></span>
            <span className="gauge-tag">3-Day Trigger</span>
            <span className="gauge-sub">pctl {fmt(segment.pct_3d, 0)}%</span>
          </div>
          <div className="gauge-item">
            <span className="gauge-val">{fmt(segment.rain_7d, 0)} <small>mm</small></span>
            <span className="gauge-tag">7-Day Cumulative</span>
            <span className="gauge-sub">pctl {fmt(segment.pct_7d, 0)}%</span>
          </div>
          <div className="gauge-item">
            <span className="gauge-val">{fmt(segment.rain_14d, 0)} <small>mm</small></span>
            <span className="gauge-tag">14-Day Antecedent</span>
            <span className="gauge-sub">pctl {fmt(segment.pct_14d, 0)}%</span>
          </div>
        </div>
      </div>

      {/* Terrain Metrics */}
      <div className="terrain-metrics-row">
        <div className="terrain-item">
          <span className="terrain-label">Mean Slope</span>
          <span className="terrain-val">{fmt(segment.slope_mean, 1)}°</span>
        </div>
        <div className="terrain-item">
          <span className="terrain-label">Max Slope</span>
          <span className="terrain-val">{fmt(segment.slope_max, 1)}°</span>
        </div>
        <div className="terrain-item">
          <span className="terrain-label">Elevation Mean</span>
          <span className="terrain-val">{fmt(segment.elevation_mean, 0)} m</span>
        </div>
        <div className="terrain-item">
          <span className="terrain-label">LR / RF Score</span>
          <span className="terrain-val">{fmt(segment.susc_lr, 2)} / {fmt(segment.susc_rf, 2)}</span>
        </div>
      </div>

      {/* Dominant Factors */}
      <div className="factors-section">
        <div className="section-label">Dominant Contributing Factors Flagged</div>
        <div className="factor-chips">
          {dominantFactors.length > 0 ? (
            dominantFactors.map(f => (
              <span key={f} className="factor-chip">
                ⚠️ {f}
              </span>
            ))
          ) : (
            <span className="text-muted">No dominant factors flagged above screening thresholds.</span>
          )}
        </div>
      </div>

      {/* Action Directive */}
      <div className="action-directive-box">
        <div className="directive-header">
          <span className="directive-icon">🚨</span>
          <strong>Recommended Field Action</strong>
        </div>
        <p className="directive-text">{segment.recommended_action}</p>
      </div>

      {/* Navigation action buttons */}
      <div className="detail-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => onOpenAiAssessment(segment.seg_id)}
        >
          ✨ Generate AI Geological Assessment
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onOpenAnalytics(segment.seg_id)}
        >
          📊 View 92-Day Rainfall Charts
        </button>
      </div>
    </div>
  )
}
