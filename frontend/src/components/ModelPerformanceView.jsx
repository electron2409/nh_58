import React, { useState } from 'react'

export default function ModelPerformanceView({ metricsData = null }) {
  const [activeModelTab, setActiveModelTab] = useState('static')

  // Static model metrics from metrics.json
  const staticMetrics = metricsData?.static || metricsData || {}
  const lr = staticMetrics?.metrics?.LogisticRegression || {
    AUC: 0.834,
    Accuracy: 0.797,
    Precision: 0.775,
    Recall: 0.838,
    F1: 0.805,
    CM: [[28, 9], [6, 31]]
  }
  const rf = staticMetrics?.metrics?.RandomForest || {
    AUC: 0.866,
    Accuracy: 0.743,
    Precision: 0.725,
    Recall: 0.784,
    F1: 0.753,
    CM: [[26, 11], [8, 29]]
  }

  // Dynamic model metrics from dynamic_metrics.json
  const dynMetrics = metricsData?.dynamic || {}
  const groupedLR = dynMetrics?.grouped_cv?.LR || { AUC: 0.699, PR_AUC: 0.453, Precision: 0.404, Recall: 0.720, F1: 0.518, CM: [[97, 53], [14, 36]] }
  const groupedRF = dynMetrics?.grouped_cv?.RF || { AUC: 0.704, PR_AUC: 0.459, Precision: 0.519, Recall: 0.540, F1: 0.529, CM: [[125, 25], [23, 27]] }
  const chronoLR = dynMetrics?.chronological?.LR || { AUC: 0.761, PR_AUC: 0.727, Precision: 0.600, Recall: 0.265, F1: 0.367, CM: [[30, 6], [25, 9]] }
  const chronoRF = dynMetrics?.chronological?.RF || { AUC: 0.766, PR_AUC: 0.730, Precision: 0.742, Recall: 0.676, F1: 0.708, CM: [[28, 8], [11, 23]] }

  const renderConfusionMatrix = (cm, title) => {
    if (!cm || !cm[0]) return null
    const tn = cm[0][0], fp = cm[0][1], fn = cm[1][0], tp = cm[1][1]
    const total = tn + fp + fn + tp
    return (
      <div className="cm-container">
        <h5 className="cm-title">{title}</h5>
        <div className="cm-grid">
          <div className="cm-cell header-col">Actual \ Pred</div>
          <div className="cm-cell header-col">Predicted 0 (Stable)</div>
          <div className="cm-cell header-col">Predicted 1 (Scar)</div>

          <div className="cm-cell header-row">Actual 0</div>
          <div className="cm-cell true-neg">
            <strong>{tn}</strong>
            <span>True Neg ({((tn / total) * 100).toFixed(0)}%)</span>
          </div>
          <div className="cm-cell false-pos">
            <strong>{fp}</strong>
            <span>False Pos ({((fp / total) * 100).toFixed(0)}%)</span>
          </div>

          <div className="cm-cell header-row">Actual 1</div>
          <div className="cm-cell false-neg">
            <strong>{fn}</strong>
            <span>False Neg ({((fn / total) * 100).toFixed(0)}%)</span>
          </div>
          <div className="cm-cell true-pos">
            <strong>{tp}</strong>
            <span>True Pos ({((tp / total) * 100).toFixed(0)}%)</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="models-view-container">
      <div className="view-intro-banner">
        <div>
          <h2>Model Evaluation & Validation Framework</h2>
          <p>
            Trained and cross-validated machine-learning pipelines for static terrain susceptibility
            and dynamic rainfall triggering along the NH-58 highway corridor.
          </p>
        </div>
        <div className="validation-pill">
          <span>Spatial Block CV (5 Blocks)</span>
        </div>
      </div>

      <div className="model-subtabs">
        <button
          type="button"
          className={`subtab-btn ${activeModelTab === 'static' ? 'active' : ''}`}
          onClick={() => setActiveModelTab('static')}
        >
          ⛰️ Static Susceptibility Models (SRTM 30m)
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeModelTab === 'dynamic' ? 'active' : ''}`}
          onClick={() => setActiveModelTab('dynamic')}
        >
          🌧️ Dynamic Trigger Models (CHIRPS)
        </button>
      </div>

      {activeModelTab === 'static' ? (
        <div className="model-section">
          <div className="metrics-summary-cards">
            <div className="metric-box highlight">
              <span className="box-title">Random Forest ROC-AUC</span>
              <span className="box-val text-cyan">{(rf.AUC).toFixed(3)}</span>
              <span className="box-sub">Accuracy: {(rf.Accuracy * 100).toFixed(1)}% • F1: {(rf.F1).toFixed(3)}</span>
            </div>
            <div className="metric-box">
              <span className="box-title">Logistic Regression ROC-AUC</span>
              <span className="box-val text-amber">{(lr.AUC).toFixed(3)}</span>
              <span className="box-sub">Accuracy: {(lr.Accuracy * 100).toFixed(1)}% • F1: {(lr.F1).toFixed(3)}</span>
            </div>
            <div className="metric-box">
              <span className="box-title">Dataset Balance</span>
              <span className="box-val">37 / 37</span>
              <span className="box-sub">37 Landslide Scars • 37 Non-Landslide Controls</span>
            </div>
            <div className="metric-box">
              <span className="box-title">Terrain Input Features</span>
              <span className="box-val">6</span>
              <span className="box-sub">Elevation, Slope, Aspect (sin/cos), Curvature, Dist Road</span>
            </div>
          </div>

          <div className="models-comparison-grid">
            <div className="card-inner">
              <h3>Static Model Comparison (Spatial Cross-Validation)</h3>
              <p className="card-note">
                Evaluated using 5-block spatial cross-validation to prevent spatial autocorrelation bias.
                Threshold set to 0.5 for out-of-fold predictions.
              </p>
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Model Architecture</th>
                    <th>ROC-AUC</th>
                    <th>Accuracy</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1-Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="active-row">
                    <td>
                      <strong>Random Forest</strong>
                      <span className="model-tag">Non-linear ensemble</span>
                    </td>
                    <td className="highlight-cell">{(rf.AUC).toFixed(3)}</td>
                    <td>{(rf.Accuracy * 100).toFixed(1)}%</td>
                    <td>{(rf.Precision).toFixed(3)}</td>
                    <td>{(rf.Recall).toFixed(3)}</td>
                    <td>{(rf.F1).toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Logistic Regression</strong>
                      <span className="model-tag">StandardScaler + L2</span>
                    </td>
                    <td className="highlight-cell">{(lr.AUC).toFixed(3)}</td>
                    <td>{(lr.Accuracy * 100).toFixed(1)}%</td>
                    <td>{(lr.Precision).toFixed(3)}</td>
                    <td>{(lr.Recall).toFixed(3)}</td>
                    <td>{(lr.F1).toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="cm-row">
                {renderConfusionMatrix(rf.CM, 'Random Forest Confusion Matrix')}
                {renderConfusionMatrix(lr.CM, 'Logistic Regression Confusion Matrix')}
              </div>
            </div>

            <div className="card-inner">
              <h3>Features & Scientific Limitations</h3>
              <div className="features-list">
                <h4>Engineered Morphometric Features (GEE SRTMGL1_003)</h4>
                <ul>
                  <li><code>elevation</code>: Continuous meters above sea level.</li>
                  <li><code>slope</code>: Surface gradient in degrees calculated via 3x3 horn kernel.</li>
                  <li><code>asp_sin</code> & <code>asp_cos</code>: Trigonometric decomposition of compass aspect.</li>
                  <li><code>curvature</code>: Laplacian 8-neighbor second derivative of elevation surface.</li>
                  <li><code>dist_road</code>: Orthogonal proximity to OpenStreetMap NH-58 alignment.</li>
                </ul>
              </div>

              <div className="academic-alert">
                <h4>⚠️ Academic & Methodological Caveats</h4>
                <p>
                  <strong>1. Offline Validation vs Live Accuracy:</strong> ROC-AUC measures spatial discrimination
                  between mapped scars and random corridor points. It does not signify the probability of future landslides.
                </p>
                <p>
                  <strong>2. Label Inventory:</strong> 28 points were manually digitized from high-resolution satellite imagery,
                  8 are Sentinel-2 spectral disturbance candidates, and 1 is a NASA Global Landslide Catalog event.
                </p>
                <p>
                  <strong>3. Excluded Layers:</strong> Geotechnical boreholes, stratigraphic fault dips, and soil moisture sensors
                  were unavailable and are omitted from this screening pipeline.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="model-section">
          <div className="metrics-summary-cards">
            <div className="metric-box highlight">
              <span className="box-title">Chronological RF ROC-AUC</span>
              <span className="box-val text-cyan">{(chronoRF.AUC).toFixed(3)}</span>
              <span className="box-sub">PR-AUC: {(chronoRF.PR_AUC).toFixed(3)} • Precision: {(chronoRF.Precision).toFixed(3)}</span>
            </div>
            <div className="metric-box">
              <span className="box-title">Grouped CV RF ROC-AUC</span>
              <span className="box-val text-amber">{(groupedRF.AUC).toFixed(3)}</span>
              <span className="box-sub">PR-AUC: {(groupedRF.PR_AUC).toFixed(3)} • Recall: {(groupedRF.Recall).toFixed(3)}</span>
            </div>
            <div className="metric-box">
              <span className="box-title">Event Sample Base</span>
              <span className="box-val">50 / 150</span>
              <span className="box-sub">50 NASA GLC Events (2007-2015) • 150 Seasonal Controls</span>
            </div>
            <div className="metric-box">
              <span className="box-title">Precipitation Windows</span>
              <span className="box-val">4</span>
              <span className="box-sub">1-day, 3-day, 7-day, 14-day & Z-anomaly</span>
            </div>
          </div>

          <div className="models-comparison-grid">
            <div className="card-inner">
              <h3>Dynamic Trigger Evaluation (Grouped & Chronological Splits)</h3>
              <p className="card-note">
                Trained on historical rainfall windows against regional landslide occurrences to validate
                rainfall as a decisive triggering parameter.
              </p>
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Validation Split</th>
                    <th>Model</th>
                    <th>ROC-AUC</th>
                    <th>PR-AUC</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Grouped CV</td>
                    <td><strong>LR</strong></td>
                    <td>{(groupedLR.AUC).toFixed(3)}</td>
                    <td>{(groupedLR.PR_AUC).toFixed(3)}</td>
                    <td>{(groupedLR.Precision).toFixed(3)}</td>
                    <td>{(groupedLR.Recall).toFixed(3)}</td>
                    <td>{(groupedLR.F1).toFixed(3)}</td>
                  </tr>
                  <tr className="active-row">
                    <td>Grouped CV</td>
                    <td><strong>RF</strong></td>
                    <td className="highlight-cell">{(groupedRF.AUC).toFixed(3)}</td>
                    <td>{(groupedRF.PR_AUC).toFixed(3)}</td>
                    <td>{(groupedRF.Precision).toFixed(3)}</td>
                    <td>{(groupedRF.Recall).toFixed(3)}</td>
                    <td>{(groupedRF.F1).toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td>Chronological Split</td>
                    <td><strong>LR</strong></td>
                    <td>{(chronoLR.AUC).toFixed(3)}</td>
                    <td>{(chronoLR.PR_AUC).toFixed(3)}</td>
                    <td>{(chronoLR.Precision).toFixed(3)}</td>
                    <td>{(chronoLR.Recall).toFixed(3)}</td>
                    <td>{(chronoLR.F1).toFixed(3)}</td>
                  </tr>
                  <tr className="active-row">
                    <td>Chronological Split</td>
                    <td><strong>RF</strong></td>
                    <td className="highlight-cell">{(chronoRF.AUC).toFixed(3)}</td>
                    <td>{(chronoRF.PR_AUC).toFixed(3)}</td>
                    <td>{(chronoRF.Precision).toFixed(3)}</td>
                    <td>{(chronoRF.Recall).toFixed(3)}</td>
                    <td>{(chronoRF.F1).toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="cm-row">
                {renderConfusionMatrix(chronoRF.CM, 'Chronological Random Forest CM')}
                {renderConfusionMatrix(chronoLR.CM, 'Chronological Logistic Regression CM')}
              </div>
            </div>

            <div className="card-inner">
              <h3>Dynamic Model Role in Dashboard</h3>
              <div className="academic-alert">
                <h4>📌 Decision Support Integration</h4>
                <p>
                  In the operational dashboard, current risk is assigned using the <strong>expert-judgement screening matrix</strong>
                  which combines the segment's static susceptibility class (SRTM quintile) with the daily CHIRPS rainfall percentile trigger.
                </p>
                <p>
                  The dynamic machine learning model above confirms that 3-day and 7-day antecedent rainfall significantly correlate
                  with landslide occurrence in Uttarakhand (ROC-AUC ~0.766), justifying the use of multi-day percentile thresholds for highway screening.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
