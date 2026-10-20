import React, { useMemo } from 'react'
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend
} from 'recharts'

const RISK_COLORS = {
  'VERY LOW': '#10b981',
  'LOW': '#84cc16',
  'MODERATE': '#f59e0b',
  'HIGH': '#f97316',
  'VERY HIGH': '#ef4444'
}

export default function AnalyticsView({
  selectedSegment,
  timeseriesData = [],
  corridorData = [],
  activeDate,
  onSelectSegment
}) {
  const chartData = useMemo(() => {
    return timeseriesData.map(d => ({
      rawDate: d.date,
      displayDate: d.date.slice(5),
      rain_1d: Number(d.rain_1d) || 0,
      rain_3d: Number(d.rain_3d) || 0,
      rain_7d: Number(d.rain_7d) || 0,
      rain_14d: Number(d.rain_14d) || 0,
      risk: d.current_risk,
      trigger: d.trigger_name
    }))
  }, [timeseriesData])

  const corridorRainData = useMemo(() => {
    return [...corridorData]
      .sort((a, b) => a.seg_id - b.seg_id)
      .map(s => ({
        km: s.label.replace(' km', ''),
        seg_id: s.seg_id,
        rain_3d: Number(s.rain_3d) || 0,
        rain_1d: Number(s.rain_1d) || 0,
        risk: s.current_risk
      }))
  }, [corridorData])

  return (
    <div className="analytics-view-container">
      <div className="analytics-grid">
        {/* Time-series card */}
        <div className="analytics-card large">
          <div className="card-header-row">
            <div>
              <h3 className="card-title">
                {selectedSegment
                  ? `Temporal Rainfall & Risk Profile: ${selectedSegment.label}`
                  : 'Temporal Rainfall & Risk Profile'}
              </h3>
              <p className="card-subtitle">
                92-day monsoon progression (July 1 – Sept 30, 2023) • CHIRPS satellite rainfall
              </p>
            </div>
            {selectedSegment && (
              <div className="segment-indicator-badge">
                <span>Terrain Susceptibility: <strong>{selectedSegment.susc_class_name}</strong></span>
              </div>
            )}
          </div>

          {chartData.length > 0 ? (
            <>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="displayDate"
                      stroke="#64748b"
                      fontSize={11}
                      interval={6}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      unit=" mm"
                      width={55}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px'
                      }}
                      formatter={(val, name) => [`${Number(val).toFixed(1)} mm`, name]}
                      labelFormatter={label => `Date: 2023-${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="rain_1d" name="1-Day Rain" fill="#38bdf8" opacity={0.8} />
                    <Line type="monotone" dataKey="rain_3d" name="3-Day Accumulation" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="rain_7d" name="7-Day Cumulative" stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="rain_14d" name="14-Day Antecedent" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    {activeDate && (
                      <ReferenceLine
                        x={activeDate.slice(5)}
                        stroke="#ef4444"
                        strokeWidth={2}
                        label={{
                          value: `Active: ${activeDate.slice(5)}`,
                          fill: '#ef4444',
                          fontSize: 11,
                          position: 'top'
                        }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 92-day risk strip */}
              <div className="risk-strip-container">
                <div className="strip-label">Daily Composite Risk Timeline (92 days):</div>
                <div className="risk-strip">
                  {chartData.map(d => (
                    <span
                      key={d.rawDate}
                      className="strip-cell"
                      style={{ backgroundColor: RISK_COLORS[d.risk] || '#64748b' }}
                      title={`${d.rawDate}: Risk ${d.risk} (Trigger: ${d.trigger}, 3d: ${d.rain_3d.toFixed(0)}mm)`}
                    />
                  ))}
                </div>
                <div className="strip-legend">
                  {['VERY LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY HIGH'].map(r => (
                    <span key={r} className="strip-legend-item">
                      <span className="dot" style={{ backgroundColor: RISK_COLORS[r] }} />
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-chart-notice">
              <p>Select a highway segment on the map or register to view its temporal rainfall time series.</p>
            </div>
          )}
        </div>

        {/* Spatial corridor profile */}
        <div className="analytics-card">
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Corridor Spatial Rainfall Distribution</h3>
              <p className="card-subtitle">
                3-Day precipitation along all 70 segments on <strong>{activeDate}</strong>
              </p>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={corridorRainData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="km"
                  stroke="#64748b"
                  fontSize={10}
                  interval={7}
                  tickLine={false}
                  label={{ value: 'Chainage (km from Rishikesh)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  unit=" mm"
                  width={45}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                  formatter={(val) => [`${Number(val).toFixed(1)} mm`, '3-Day Rainfall']}
                  labelFormatter={km => `Segment: ${km} km`}
                />
                <Bar
                  dataKey="rain_3d"
                  fill="#38bdf8"
                  radius={[3, 3, 0, 0]}
                  onClick={(data) => {
                    if (data && data.seg_id != null) onSelectSegment(data.seg_id)
                  }}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-notes-box">
            <h4>Dataset Details & Constraints</h4>
            <ul>
              <li><strong>Rainfall Data:</strong> CHIRPS (Climate Hazards Center InfraRed Precipitation with Station data) daily grid at 0.05° (~5.5 km resolution).</li>
              <li><strong>Trigger Metric:</strong> Percentile rank against 2015–2022 monsoon history for each grid cell.</li>
              <li><strong>Vegetation Indices:</strong> Sentinel-2 NDVI change is <em>not available</em> in this version and is excluded to avoid fabricated proxy values.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
