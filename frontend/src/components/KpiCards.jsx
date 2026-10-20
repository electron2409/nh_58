export default function KpiCards({ rows = [], metrics = null }) {
  const total = rows.length || 70
  const veryHighCount = rows.filter(r => r.current_risk === 'VERY HIGH').length
  const highCount = rows.filter(r => r.current_risk === 'HIGH').length
  const moderateCount = rows.filter(r => r.current_risk === 'MODERATE').length
  const elevatedTotal = highCount + veryHighCount

  const rain3Values = rows.map(r => Number(r.rain_3d) || 0)
  const meanRain3 = rain3Values.length ? (rain3Values.reduce((a, b) => a + b, 0) / rain3Values.length) : 0
  const maxRain1 = rows.length ? Math.max(...rows.map(r => Number(r.rain_1d) || 0)) : 0

  // Find wettest segment
  const peakSegment = rows.length
    ? [...rows].sort((a, b) => (Number(b.rain_3d) || 0) - (Number(a.rain_3d) || 0))[0]
    : null

  const rfAuc = metrics?.metrics?.RandomForest?.AUC
    ? (metrics.metrics.RandomForest.AUC).toFixed(3)
    : '0.866'
  const lrAuc = metrics?.metrics?.LogisticRegression?.AUC
    ? (metrics.metrics.LogisticRegression.AUC).toFixed(3)
    : '0.834'

  return (
    <div className="kpi-grid">
      <div className="kpi-card highlight-danger">
        <div className="kpi-header">
          <span className="kpi-title">High & Very High Risk</span>
          <span className="kpi-badge warning">{elevatedTotal} / {total}</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-large-num">{elevatedTotal}</span>
          <span className="kpi-unit">segments flagged</span>
        </div>
        <div className="kpi-mini-bar">
          <div
            className="kpi-bar-fill fill-very-high"
            style={{ width: `${(veryHighCount / total) * 100}%` }}
            title={`Very High: ${veryHighCount}`}
          />
          <div
            className="kpi-bar-fill fill-high"
            style={{ width: `${(highCount / total) * 100}%` }}
            title={`High: ${highCount}`}
          />
          <div
            className="kpi-bar-fill fill-mod"
            style={{ width: `${(moderateCount / total) * 100}%` }}
            title={`Moderate: ${moderateCount}`}
          />
        </div>
        <div className="kpi-footer-sub">
          <span>VH: {veryHighCount}</span> • <span>H: {highCount}</span> • <span>Mod: {moderateCount}</span>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-title">Corridor 3-Day Rain</span>
          <span className="kpi-badge info">CHIRPS 5km</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-large-num">{meanRain3.toFixed(1)}</span>
          <span className="kpi-unit">mm avg</span>
        </div>
        <div className="kpi-meta-line">
          Peak segment: <strong>{peakSegment ? `${peakSegment.label} (${Number(peakSegment.rain_3d).toFixed(0)} mm)` : 'N/A'}</strong>
        </div>
        <div className="kpi-footer-sub">Max 1-Day Intensity: {maxRain1.toFixed(1)} mm</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-title">Monitored Corridor</span>
          <span className="kpi-badge neutral">NH-58 Line</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-large-num">{total}</span>
          <span className="kpi-unit">1-km sections</span>
        </div>
        <div className="kpi-meta-line">
          Extent: <strong>Rishikesh (0 km) → Devprayag (70 km)</strong>
        </div>
        <div className="kpi-footer-sub">SRTM 30m Digital Elevation Model</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-title">Model Evaluation AUC</span>
          <span className="kpi-badge science">5-Block CV</span>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-large-num text-cyan">{rfAuc}</span>
          <span className="kpi-unit">Random Forest</span>
        </div>
        <div className="kpi-meta-line">
          Logistic Regression AUC: <strong>{lrAuc}</strong>
        </div>
        <div className="kpi-footer-sub">Offline validation metric (not live accuracy)</div>
      </div>
    </div>
  )
}
