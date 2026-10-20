import React, { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const RISK_LEVELS = ['VERY LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY HIGH']
const RISK_COLORS = ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444']

const SUSC_LEVELS = ['VERY LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY HIGH']
const SUSC_COLORS = ['#d9d6ea', '#b5afd6', '#8e86bd', '#6a5fa5', '#43358a']

const TRIG_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'EXTREME']
const TRIG_COLORS = ['#93c5fd', '#60a5fa', '#2563eb', '#1e3a8a']

const BASEMAPS = {
  dark: {
    name: 'Carto Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  },
  satellite: {
    name: 'ESRI Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  }
}

function getColor(properties, mode) {
  if (!properties) return '#94a3b8'
  if (mode === 'static') {
    const idx = SUSC_LEVELS.indexOf(properties.susc_class_name)
    return idx >= 0 ? SUSC_COLORS[idx] : '#8e86bd'
  }
  if (mode === 'trigger') {
    const idx = TRIG_LEVELS.indexOf(properties.trigger_name)
    return idx >= 0 ? TRIG_COLORS[idx] : '#60a5fa'
  }
  const idx = RISK_LEVELS.indexOf(properties.current_risk)
  return idx >= 0 ? RISK_COLORS[idx] : '#f59e0b'
}

function FitBoundsHandler({ data, triggerKey }) {
  const map = useMap()
  useEffect(() => {
    if (data && data.features && data.features.length > 0) {
      try {
        const bounds = L.geoJSON(data).getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 })
        }
      } catch (e) {
        console.error('Error fitting bounds:', e)
      }
    }
  }, [triggerKey, map, data])
  return null
}

export default function MapView({
  geoData,
  selectedSegId,
  onSelectSegment,
  activeDate,
  mode,
  onModeChange,
  loading = false
}) {
  const [basemapKey, setBasemapKey] = useState('dark')
  const [fitKey, setFitKey] = useState(0)

  const legendConfig = useMemo(() => {
    if (mode === 'static') {
      return {
        title: 'Static Terrain Susceptibility (Quintiles: SRTM 30m)',
        subtitle: 'Does not change with date • Modelled from slope, elevation, curvature, aspect',
        items: SUSC_LEVELS.map((label, idx) => ({ label, color: SUSC_COLORS[idx] }))
      }
    }
    if (mode === 'trigger') {
      return {
        title: 'Dynamic Rainfall Trigger Level (CHIRPS Percentile)',
        subtitle: 'Varies daily • Calibrated against 2015-2022 monsoon history per 5km pixel',
        items: TRIG_LEVELS.map((label, idx) => ({ label, color: TRIG_COLORS[idx] }))
      }
    }
    return {
      title: 'Composite Landslide Risk (Screening Matrix)',
      subtitle: 'Static Susceptibility Class × Daily Rainfall Trigger Level',
      items: RISK_LEVELS.map((label, idx) => ({ label, color: RISK_COLORS[idx] }))
    }
  }, [mode])

  return (
    <div className="map-view-card">
      <div className="map-card-toolbar">
        <div className="layer-mode-pills">
          <span className="toolbar-label">Layer Mode:</span>
          {[
            { id: 'risk', label: 'Composite Risk', icon: '⚡' },
            { id: 'static', label: 'Terrain Susceptibility', icon: '⛰️' },
            { id: 'trigger', label: 'Rainfall Trigger', icon: '🌧️' }
          ].map(m => (
            <button
              key={m.id}
              type="button"
              className={`mode-btn ${mode === m.id ? 'active' : ''}`}
              onClick={() => onModeChange(m.id)}
            >
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>

        <div className="map-right-controls">
          <div className="basemap-select-group">
            <span className="toolbar-label">Base:</span>
            <select
              value={basemapKey}
              onChange={e => setBasemapKey(e.target.value)}
              className="basemap-select"
            >
              {Object.entries(BASEMAPS).map(([k, cfg]) => (
                <option key={k} value={k}>{cfg.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="action-btn small"
            onClick={() => setFitKey(prev => prev + 1)}
            title="Recenter corridor"
          >
            🎯 Recenter
          </button>
        </div>
      </div>

      <div className="map-container-wrapper">
        {loading && (
          <div className="map-loading-overlay">
            <div className="spinner" />
            <span>Updating geospatial corridor...</span>
          </div>
        )}

        <MapContainer
          center={[30.15, 78.45]}
          zoom={10}
          scrollWheelZoom={true}
          className="leaflet-map-element"
        >
          <TileLayer
            key={basemapKey}
            url={BASEMAPS[basemapKey].url}
            attribution={BASEMAPS[basemapKey].attribution}
            maxZoom={18}
          />

          {geoData && (
            <>
              <FitBoundsHandler data={geoData} triggerKey={fitKey} />
              <GeoJSON
                key={`${activeDate}-${mode}-${selectedSegId}-${basemapKey}`}
                data={geoData}
                style={feature => {
                  const isSelected = feature?.properties?.seg_id === selectedSegId
                  const color = getColor(feature?.properties, mode)
                  return {
                    color: color,
                    weight: isSelected ? 10 : 5.5,
                    opacity: isSelected ? 1.0 : 0.9,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties || {}
                  const label = p.label || `Segment ${p.seg_id}`
                  const risk = p.current_risk || 'N/A'
                  const susc = p.susc_class_name || 'N/A'
                  const trig = p.trigger_name || 'N/A'
                  const r3 = p.rain_3d != null ? `${Number(p.rain_3d).toFixed(0)} mm` : 'N/A'
                  const slope = p.slope_mean != null ? `${Number(p.slope_mean).toFixed(1)}°` : 'N/A'

                  layer.bindTooltip(
                    `<div style="font-size:12px; line-height:1.4;">
                      <strong>${label}</strong> (Approx. Chainage)<br/>
                      Risk: <span style="color:${getColor(p, 'risk')}; font-weight:700;">${risk}</span><br/>
                      Susceptibility: <strong>${susc}</strong> • Trigger: <strong>${trig}</strong><br/>
                      3-Day Rain: <strong>${r3}</strong> • Mean Slope: <strong>${slope}</strong>
                    </div>`,
                    { sticky: true }
                  )

                  layer.on({
                    click: () => onSelectSegment(p.seg_id),
                    mouseover: e => {
                      if (p.seg_id !== selectedSegId) {
                        e.target.setStyle({ weight: 8, opacity: 1 })
                      }
                    },
                    mouseout: e => {
                      if (p.seg_id !== selectedSegId) {
                        e.target.setStyle({ weight: 5.5, opacity: 0.9 })
                      }
                    }
                  })
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <div className="map-legend-footer">
        <div className="legend-info">
          <span className="legend-title">{legendConfig.title}</span>
          <span className="legend-subtitle">{legendConfig.subtitle}</span>
        </div>
        <div className="legend-items">
          {legendConfig.items.map(item => (
            <div key={item.label} className="legend-badge">
              <span className="legend-swatch" style={{ backgroundColor: item.color }} />
              <span className="legend-text">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
