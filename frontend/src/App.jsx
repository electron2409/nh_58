import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { api } from './services/api'
import Navbar from './components/Navbar'
import KpiCards from './components/KpiCards'
import MapView from './components/MapView'
import SegmentDetail from './components/SegmentDetail'
import AnalyticsView from './components/AnalyticsView'
import SegmentTable from './components/SegmentTable'
import ModelPerformanceView from './components/ModelPerformanceView'
import AiAssessmentView from './components/AiAssessmentView'
import './App.css'

export default function App() {
  const [dates, setDates] = useState([])
  const [dateIndex, setDateIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedSegId, setSelectedSegId] = useState(15) // default to high-risk segment 15
  const [mapMode, setMapMode] = useState('risk')

  const [geoData, setGeoData] = useState(null)
  const [corridorRows, setCorridorRows] = useState([])
  const [timeseriesData, setTimeseriesData] = useState([])
  const [metricsData, setMetricsData] = useState(null)

  const [backendStatus, setBackendStatus] = useState({ connected: false, message: 'Connecting...' })
  const [aiStatus, setAiStatus] = useState(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [appError, setAppError] = useState('')

  const activeDate = dates[dateIndex] || ''

  // Initial load: dates, health, metrics, AI status
  useEffect(() => {
    let isMounted = true

    async function initSystem() {
      try {
        const [healthRes, datesRes, metricsRes, aiRes] = await Promise.allSettled([
          api.checkHealth(),
          api.getDates(),
          api.getMetrics(),
          api.getAIStatus()
        ])

        if (!isMounted) return

        if (healthRes.status === 'fulfilled') {
          setBackendStatus({ connected: true, message: 'Backend connected to FastAPI' })
        } else {
          setBackendStatus({ connected: false, message: healthRes.reason?.message || 'Backend unreachable' })
        }

        if (datesRes.status === 'fulfilled') {
          const fetchedDates = datesRes.value
          setDates(fetchedDates)
          // Default to the wettest 3-day monsoon date in the demo range
          const peakIdx = fetchedDates.indexOf('2023-09-15')
          setDateIndex(peakIdx >= 0 ? peakIdx : fetchedDates.length - 1)
        }

        if (metricsRes.status === 'fulfilled') {
          setMetricsData(metricsRes.value)
        }

        if (aiRes.status === 'fulfilled') {
          setAiStatus(aiRes.value)
        }
      } catch (err) {
        if (isMounted) setAppError(`Initialization error: ${err.message}`)
      }
    }

    initSystem()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (!activeDate) return
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) setLoadingGeo(true)
    })

    Promise.allSettled([
      api.getGeoJSON(activeDate),
      api.getRisk(activeDate)
    ]).then(([geoRes, riskRes]) => {
      if (!isMounted) return
      setLoadingGeo(false)

      if (geoRes.status === 'fulfilled') {
        setGeoData(geoRes.value)
      } else {
        setAppError(`Failed to load GeoJSON: ${geoRes.reason?.message}`)
      }

      if (riskRes.status === 'fulfilled') {
        setCorridorRows(riskRes.value)
      }
    })

    return () => { isMounted = false }
  }, [activeDate])

  // Load timeseries when selectedSegId changes
  useEffect(() => {
    if (selectedSegId == null) {
      return
    }
    let isMounted = true

    api.getTimeseries(selectedSegId)
      .then(res => {
        if (isMounted) setTimeseriesData(res)
      })
      .catch(err => {
        console.warn('Failed to load timeseries:', err)
      })

    return () => { isMounted = false }
  }, [selectedSegId])

  // Selected segment details object
  const selectedSegment = useMemo(() => {
    if (selectedSegId == null) return null
    return corridorRows.find(r => r.seg_id === selectedSegId) || null
  }, [corridorRows, selectedSegId])

  const handleSelectSegment = useCallback((id) => {
    setSelectedSegId(id)
  }, [])

  const handleOpenAiAssessment = useCallback((id) => {
    setSelectedSegId(id)
    setActiveTab('ai')
  }, [])

  const handleOpenAnalytics = useCallback((id) => {
    setSelectedSegId(id)
    setActiveTab('analytics')
  }, [])

  return (
    <div className="app-shell">
      <Navbar
        dates={dates}
        currentDateIndex={dateIndex}
        onDateIndexChange={setDateIndex}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        backendStatus={backendStatus}
        aiStatus={aiStatus}
      />

      {appError && (
        <div className="app-alert error">
          <span>⚠️ {appError}</span>
          <button type="button" onClick={() => setAppError('')} className="close-alert-btn">✕</button>
        </div>
      )}

      {!backendStatus.connected && (
        <div className="app-alert warning">
          <span>
            ⚡ Backend connection is offline. Make sure your FastAPI backend is running (e.g., <code>uvicorn backend.app.main:app --reload</code>).
          </span>
        </div>
      )}

      <main className="main-content-area">
        {/* Top KPI Cards rendered on Overview, Analytics, and Register views */}
        {(activeTab === 'overview' || activeTab === 'analytics' || activeTab === 'register') && (
          <KpiCards
            rows={corridorRows}
            date={activeDate}
            metrics={metricsData}
          />
        )}

        {/* Tab 1: Overview & Map */}
        {activeTab === 'overview' && (
          <div className="overview-layout">
            <div className="overview-map-col">
              <MapView
                geoData={geoData}
                selectedSegId={selectedSegId}
                onSelectSegment={handleSelectSegment}
                activeDate={activeDate}
                mode={mapMode}
                onModeChange={setMapMode}
                loading={loadingGeo}
              />
            </div>
            <div className="overview-detail-col">
              <SegmentDetail
                segment={selectedSegment}
                onOpenAiAssessment={handleOpenAiAssessment}
                onOpenAnalytics={handleOpenAnalytics}
                onSelectSegment={handleSelectSegment}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Analytics & Time-Series */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            selectedSegment={selectedSegment}
            timeseriesData={timeseriesData}
            corridorData={corridorRows}
            activeDate={activeDate}
            onSelectSegment={handleSelectSegment}
          />
        )}

        {/* Tab 3: Chainage Risk Register */}
        {activeTab === 'register' && (
          <SegmentTable
            rows={corridorRows}
            selectedSegId={selectedSegId}
            onSelectSegment={handleSelectSegment}
            activeDate={activeDate}
          />
        )}

        {/* Tab 4: Model Performance */}
        {activeTab === 'models' && (
          <ModelPerformanceView
            metricsData={metricsData}
          />
        )}

        {/* Tab 5: AI Geological Assessment */}
        {activeTab === 'ai' && (
          <AiAssessmentView
            segments={corridorRows}
            selectedSegId={selectedSegId}
            onSelectSegment={handleSelectSegment}
            activeDate={activeDate}
            aiStatus={aiStatus}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-col">
            <h4>Dynamic Landslide Decision Support System</h4>
            <p>
              National Highway 58 (Rishikesh – Byasi – Devprayag Stretch, Uttarakhand).
              Academic Decision-Support Prototype integrating Google Earth Engine, SRTM 30m Digital Elevation Model,
              and CHIRPS 0.05° daily gridded precipitation.
            </p>
          </div>
          <div className="footer-col">
            <h4>Methodology & Machine Learning</h4>
            <p>
              Susceptibility models: Logistic Regression + Random Forest on morphometric features,
              validated via 5-block spatial cross-validation. Trigger model: Historical CHIRPS percentile rank
              coupled via a 5x4 screening risk matrix.
            </p>
          </div>
          <div className="footer-col">
            <h4>Screening Disclaimer</h4>
            <p>
              This platform provides screening-level prioritization. It does not predict exact landslide timing
              and is not a substitute for physical geotechnical borehole, geological mapping, or structural slope assessments.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}