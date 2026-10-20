import React, { useState, useMemo } from 'react'

const RISK_LEVELS = ['VERY LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY HIGH']
const RISK_COLORS = {
  'VERY LOW': '#10b981',
  'LOW': '#84cc16',
  'MODERATE': '#f59e0b',
  'HIGH': '#f97316',
  'VERY HIGH': '#ef4444'
}

const fmt = (val, d = 1) => (val == null || Number.isNaN(Number(val)) ? 'N/A' : Number(val).toFixed(d))

export default function SegmentTable({
  rows = [],
  selectedSegId,
  onSelectSegment,
  activeDate
}) {
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [sortField, setSortField] = useState('risk')
  const [sortAsc, setSortAsc] = useState(false)

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesLabel = (r.label || '').toLowerCase().includes(q)
        const matchesId = String(r.seg_id).includes(q)
        if (!matchesLabel && !matchesId) return false
      }
      if (riskFilter !== 'ALL' && r.current_risk !== riskFilter) {
        return false
      }
      return true
    })
  }, [rows, search, riskFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0
      if (sortField === 'seg_id') {
        diff = a.seg_id - b.seg_id
      } else if (sortField === 'risk') {
        diff = RISK_LEVELS.indexOf(b.current_risk) - RISK_LEVELS.indexOf(a.current_risk)
        if (diff === 0) diff = (b.susc_mean || 0) - (a.susc_mean || 0)
      } else if (sortField === 'susc') {
        diff = (b.susc_mean || 0) - (a.susc_mean || 0)
      } else if (sortField === 'rain_3d') {
        diff = (b.rain_3d || 0) - (a.rain_3d || 0)
      } else if (sortField === 'slope') {
        diff = (b.slope_mean || 0) - (a.slope_mean || 0)
      }
      return sortAsc ? -diff : diff
    })
  }, [filtered, sortField, sortAsc])

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const exportCSV = () => {
    const headers = ['Segment ID', 'Label', 'Current Risk', 'Susceptibility Class', 'Trigger Level', '3-Day Rain (mm)', 'Mean Slope (deg)', 'Dominant Factors']
    const csvRows = [headers.join(',')]
    sorted.forEach(r => {
      csvRows.push([
        r.seg_id,
        `"${r.label}"`,
        r.current_risk,
        r.susc_class_name,
        r.trigger_name,
        fmt(r.rain_3d, 1),
        fmt(r.slope_mean, 1),
        `"${(r.dominant_factors || '').replace(/"/g, '""')}"`
      ].join(','))
    })
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `NH58_Risk_Register_${activeDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="table-card-container">
      <div className="table-toolbar">
        <div className="table-search-group">
          <input
            type="text"
            placeholder="Search chainage (e.g. '15-16 km' or '24')..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="table-search-input"
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="table-filters">
          <div className="filter-item">
            <span className="filter-label">Risk Filter:</span>
            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Risk Levels ({rows.length})</option>
              {RISK_LEVELS.slice().reverse().map(lvl => (
                <option key={lvl} value={lvl}>
                  {lvl} ({rows.filter(r => r.current_risk === lvl).length})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="action-btn small"
            onClick={exportCSV}
            title="Export filtered records to CSV"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="register-table">
          <thead>
            <tr>
              <th onClick={() => handleHeaderClick('seg_id')} className="sortable">
                Chainage Segment {sortField === 'seg_id' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleHeaderClick('susc')} className="sortable">
                Static Susceptibility {sortField === 'susc' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th>Rainfall Trigger</th>
              <th onClick={() => handleHeaderClick('rain_3d')} className="sortable">
                3-Day Rain (mm) {sortField === 'rain_3d' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleHeaderClick('slope')} className="sortable">
                Mean Slope (°) {sortField === 'slope' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleHeaderClick('risk')} className="sortable">
                Composite Risk {sortField === 'risk' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th>Action Guidance</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const isSelected = r.seg_id === selectedSegId
              const riskColor = RISK_COLORS[r.current_risk] || '#94a3b8'

              return (
                <tr
                  key={r.seg_id}
                  className={`table-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectSegment(r.seg_id)}
                >
                  <td className="cell-chainage">
                    <strong>{r.label}</strong>
                    <span className="sub-id">#{r.seg_id}</span>
                  </td>
                  <td>
                    <span className="susc-tag">{r.susc_class_name}</span>
                    <span className="sub-val">({fmt(r.susc_mean, 2)})</span>
                  </td>
                  <td>
                    <span className="trigger-tag">{r.trigger_name}</span>
                    <span className="sub-val">pctl {fmt(r.trigger_pct, 0)}%</span>
                  </td>
                  <td className="cell-num">
                    <strong>{fmt(r.rain_3d, 1)}</strong>
                    <span className="sub-val">1d: {fmt(r.rain_1d, 0)}mm</span>
                  </td>
                  <td className="cell-num">
                    {fmt(r.slope_mean, 1)}°
                    <span className="sub-val">max {fmt(r.slope_max, 1)}°</span>
                  </td>
                  <td>
                    <span className="risk-pill" style={{ backgroundColor: riskColor }}>
                      {r.current_risk}
                    </span>
                  </td>
                  <td className="cell-action">
                    <span className="action-snippet" title={r.recommended_action}>
                      {r.recommended_action ? r.recommended_action.slice(0, 50) + '...' : 'N/A'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  No highway segments match the search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer-status">
        <span>Showing <strong>{sorted.length}</strong> of <strong>{rows.length}</strong> highway segments</span>
        <span>Selected: <strong>{selectedSegId != null ? `Segment #${selectedSegId}` : 'None'}</strong></span>
      </div>
    </div>
  )
}
