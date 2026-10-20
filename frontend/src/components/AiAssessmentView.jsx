import React, { useState } from 'react'
import { api } from '../services/api'

export default function AiAssessmentView({
  segments = [],
  selectedSegId,
  onSelectSegment,
  activeDate,
  aiStatus
}) {
  const [localSegId, setLocalSegId] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const segId = localSegId ?? selectedSegId ?? (segments[0]?.seg_id ?? 0)

  const currentSegment = segments.find(s => s.seg_id === Number(segId)) || segments[0]

  const handleGenerate = async () => {
    if (!currentSegment) return
    setLoading(true)
    setError('')
    try {
      const res = await api.generateReport(currentSegment.seg_id, activeDate)
      setReportData(res)
    } catch (err) {
      setError(err.message || 'Failed to generate assessment.')
    } finally {
      setLoading(false)
    }
  }

  // Parse 4 sections from report text
  const parseSections = (text) => {
    if (!text) return []
    // Look for headings 1., 2., 3., 4. or ### 1., ### 2., etc.
    const sections = []
    const rawSections = text.split(/(?:^|\n)(?:###?\s*)?([1-4]\.\s+[^\n]+)/g).filter(Boolean)

    for (let i = 0; i < rawSections.length; i += 2) {
      const heading = rawSections[i]?.trim()
      const content = rawSections[i + 1]?.trim()
      if (heading && content) {
        sections.push({ heading, content })
      }
    }

    if (sections.length === 0) {
      // Fallback: entire text in one card
      return [{ heading: 'Geological Assessment Report', content: text }]
    }
    return sections
  }

  const sections = reportData ? parseSections(reportData.report) : []

  return (
    <div className="ai-view-container">
      <div className="ai-sidebar">
        <div className="ai-config-card">
          <h3 className="sidebar-title">Screening Assessment Setup</h3>
          <p className="sidebar-desc">
            Generate an evidence-grounded geological screening note synthesized by Google Gemini
            using strictly the verified terrain metrics and CHIRPS precipitation record for this segment.
          </p>

          <div className="form-group">
            <label htmlFor="segment-select" className="input-label">Select Highway Segment:</label>
            <select
              id="segment-select"
              value={segId}
              onChange={e => {
                const newId = Number(e.target.value)
                setLocalSegId(newId)
                onSelectSegment(newId)
                setReportData(null)
              }}
              className="select-input"
            >
              {segments.map(s => (
                <option key={s.seg_id} value={s.seg_id}>
                  {s.label} — Risk: {s.current_risk} ({s.trigger_name})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">Active Scenario Date:</label>
            <div className="date-display-badge">
              <span>📅 {activeDate || 'Latest'}</span>
            </div>
          </div>

          {currentSegment && (
            <div className="context-preview-box">
              <h4>Grounding Parameters (Backend JSON)</h4>
              <ul className="preview-list">
                <li><span>Susceptibility:</span> <strong>{currentSegment.susc_class_name} ({Number(currentSegment.susc_mean || 0).toFixed(2)})</strong></li>
                <li><span>Trigger Level:</span> <strong>{currentSegment.trigger_name} ({Number(currentSegment.trigger_pct || 0).toFixed(0)}%)</strong></li>
                <li><span>Mean / Max Slope:</span> <strong>{Number(currentSegment.slope_mean || 0).toFixed(1)}° / {Number(currentSegment.slope_max || 0).toFixed(1)}°</strong></li>
                <li><span>Rainfall (1d / 3d / 7d):</span> <strong>{Number(currentSegment.rain_1d || 0).toFixed(0)} / {Number(currentSegment.rain_3d || 0).toFixed(0)} / {Number(currentSegment.rain_7d || 0).toFixed(0)} mm</strong></li>
                <li><span>Composite Risk:</span> <strong className="text-warning">{currentSegment.current_risk}</strong></li>
              </ul>
            </div>
          )}

          <button
            type="button"
            className="generate-ai-btn"
            onClick={handleGenerate}
            disabled={loading || !currentSegment}
          >
            {loading ? (
              <>
                <span className="spinner-small" />
                <span>Generating Geological Note...</span>
              </>
            ) : (
              <>
                <span>✨ Generate Screening Assessment</span>
              </>
            )}
          </button>

          {aiStatus && (
            <div className="ai-status-footnote">
              <span>Engine: {aiStatus.configured_model} • GEE: {aiStatus.gee_project}</span>
            </div>
          )}
        </div>
      </div>

      <div className="ai-report-content">
        {error && (
          <div className="error-card">
            <h4>Generation Error</h4>
            <p>{error}</p>
          </div>
        )}

        {loading && (
          <div className="loading-card">
            <div className="spinner large" />
            <h3>Consulting Geological Decision Support Engine</h3>
            <p>
              Formatting terrain slope, multi-window precipitation indices, and spatial vulnerability factors
              for highway segment {currentSegment?.label}...
            </p>
          </div>
        )}

        {!loading && !reportData && !error && (
          <div className="placeholder-card">
            <div className="placeholder-icon">📋</div>
            <h3>Ready for Geological Synthesis</h3>
            <p>
              Click <strong>"Generate Screening Assessment"</strong> to run an evidence-constrained analysis.
              Gemini will evaluate the terrain gradient, recent CHIRPS accumulation, and operational risk category
              to formulate a 4-section engineering advisory.
            </p>
          </div>
        )}

        {!loading && reportData && (
          <div className="report-presentation">
            <div className="report-meta-header">
              <div>
                <span className="report-eyebrow">HIGHWAY GEOTECHNICAL SCREENING NOTE</span>
                <h2 className="report-title">{currentSegment?.label} • Date {activeDate}</h2>
              </div>
              <div className="report-badges">
                <span className={`badge ${reportData.source === 'gemini' ? 'gemini' : 'template'}`}>
                  {reportData.source === 'gemini' ? `AI Synthesized (${reportData.model || 'Gemini 3.5'})` : 'Template Fallback'}
                </span>
                {reportData.note && (
                  <span className="badge warning" title={reportData.note}>
                    Note: {reportData.note}
                  </span>
                )}
              </div>
            </div>

            <div className="report-sections-grid">
              {sections.map((sec, idx) => (
                <div key={idx} className="report-section-card">
                  <div className="section-card-header">
                    <span className="section-card-number">0{idx + 1}</span>
                    <h3 className="section-card-title">{sec.heading}</h3>
                  </div>
                  <div className="section-card-body">
                    {sec.content.split('\n\n').map((para, pIdx) => (
                      <p key={pIdx}>{para}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="report-disclaimer-banner">
              <span className="disclaimer-icon">⚖️</span>
              <p>
                <strong>Academic & Engineering Disclaimer:</strong> This assessment is synthesized exclusively from
                remote sensing raster proxies (SRTM 30m terrain and CHIRPS 5km precipitation). It is designated
                strictly for screening decision-support and highway prioritization. It does <em>not</em> predict the exact time
                of slope failure and cannot replace an in-situ geotechnical field investigation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
