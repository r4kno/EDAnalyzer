import React, { useState, useEffect, type JSX } from 'react';
import { Upload, BarChart3, TrendingUp, Database, FileSpreadsheet, Zap, MessageSquare } from 'lucide-react';
import './App.css'; // We'll move styles here

interface FloatingElement {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
}

interface PlotCardProps {
  title: string;
  plotData: string;
  description: string;
}

const PlotCard: React.FC<PlotCardProps> = ({ title, plotData, description }) => (
  <div className="plot-card">
    <div className="plot-header">
      <h3 className="plot-title">{title}</h3>
      <p className="plot-description">{description}</p>
    </div>
    <div className="plot-container">
      <img 
        src={`data:image/png;base64,${plotData}`} 
        alt={title}
        className="plot-image"
      />
    </div>
  </div>
);

const ResultsView: React.FC<{ 
  results: any; 
  onBackToUpload: () => void; 
}> = ({ results, onBackToUpload }) => {
  const plots = results.plots || {};
  const aiInsights = results.ai_insights || {};
  const [showAIInsights, setShowAIInsights] = useState<boolean>(false);
  
  // Dynamic plot configurations based on actual plots returned
  const availablePlots = Object.keys(plots).map(key => {
    // Handle both static and AI-generated plot names
    if (key === 'data_overview') {
      return { key, title: 'Data Overview', description: 'Original vs cleaned data comparison' };
    } else if (key === 'missing_data') {
      return { key, title: 'Missing Data Analysis', description: 'Pattern of missing values' };
    } else if (key.startsWith('correlation')) {
      return { key, title: 'Correlation Analysis', description: 'Relationships between variables' };
    } else if (key.startsWith('dist_')) {
      const colName = key.replace('dist_', '');
      return { key, title: `Distribution: ${colName}`, description: `Distribution analysis of ${colName}` };
    } else if (key.startsWith('cat_')) {
      const colName = key.replace('cat_', '');
      return { key, title: `Categories: ${colName}`, description: `Category analysis of ${colName}` };
    } else if (key.startsWith('comparison_')) {
      return { key, title: 'Data Comparison', description: 'Comparative analysis' };
    } else {
      return { key, title: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), description: 'AI-generated visualization' };
    }
  });

  return (
    <div className="results-app-container">
      {/* Animated Background Elements - Same as home */}
      <div className="floating-bg">
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={i}
            className="floating-element"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 15 + 8}px`,
              height: `${Math.random() * 15 + 8}px`,
              opacity: Math.random() * 0.2 + 0.05,
              animationDuration: `${Math.random() * 25 + 15}s`,
            }}
          />
        ))}
      </div>

      {/* Grid Pattern Overlay */}
      <div className="grid-overlay" />

      <div className="results-main-content">
        {/* Header Section */}
        <div className="results-header-section">
          <button onClick={onBackToUpload} className="modern-back-btn">
            <Upload className="back-icon" />
            New Analysis
          </button>
          
          <div className="results-logo-container">
            <div className="results-logo-wrapper">
              <BarChart3 className="results-logo-icon" />
              <div className="results-logo-dot" />
            </div>
          </div>
          
          <h1 className="results-main-title">
            Analysis Results
          </h1>
          
          <p className="results-description">
            {results.message}
          </p>

          {/* AI Status Badge */}
          <div className={`results-ai-status-badge ${results.ai_analysis_used ? 'ai-enabled' : 'ai-disabled'}`}>
            {results.ai_analysis_used ? (
              <>
                <span className="ai-icon">🤖</span>
                AI-Enhanced Analysis
              </>
            ) : (
              <>
                <span className="ai-icon">📊</span>
                Standard Analysis
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="results-summary-grid">
          <div className="results-summary-card">
            <div className="summary-icon-wrapper summary-blue">
              <Database className="summary-icon" />
            </div>
            <div className="summary-content">
              <h4>Original Data</h4>
              <p>{results.original_shape[0]} rows × {results.original_shape[1]} columns</p>
            </div>
          </div>
          
          <div className="results-summary-card">
            <div className="summary-icon-wrapper summary-green">
              <TrendingUp className="summary-icon" />
            </div>
            <div className="summary-content">
              <h4>Cleaned Data</h4>
              <p>{results.cleaned_shape[0]} rows × {results.cleaned_shape[1]} columns</p>
            </div>
          </div>
          
          <div className="results-summary-card">
            <div className="summary-icon-wrapper summary-purple">
              <Zap className="summary-icon" />
            </div>
            <div className="summary-content">
              <h4>Data Quality</h4>
              <p>{Math.round(((results.cleaned_shape[0] / results.original_shape[0]) * 100))}% retained</p>
            </div>
          </div>
          
          {results.ai_analysis_used && (
            <div className="results-summary-card ai-enhanced-card">
              <div className="summary-icon-wrapper summary-ai">
                <BarChart3 className="summary-icon" />
              </div>
              <div className="summary-content">
                <h4>AI Analysis</h4>
                <div className="ai-features-list">
                  {results.ai_details?.cleaning_ai_used && <span className="ai-feature-tag">Smart Cleaning</span>}
                  {results.ai_details?.visualization_ai_used && <span className="ai-feature-tag">Smart Plots</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Plots Section */}
        <div className="results-plots-section">
          <div className="plots-section-header">
            <h2 className="plots-section-title">
              Data Visualizations
            </h2>
            <p className="plots-section-subtitle">
              {availablePlots.length} interactive insights generated from your data
            </p>
          </div>
          
          <div className="modern-plots-grid">
            {availablePlots.map((config) => (
              <div key={config.key} className="modern-plot-card">
                <div className="plot-card-header">
                  <h3 className="plot-card-title">{config.title}</h3>
                  <p className="plot-card-description">{config.description}</p>
                </div>
                <div className="plot-card-container">
                  <img 
                    src={`data:image/png;base64,${plots[config.key]}`} 
                    alt={config.title}
                    className="plot-card-image"
                  />
                  <div className="plot-overlay">
                    <div className="plot-hover-text">View Details</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced AI Insights Section - At Bottom with Toggle */}
        <div className="enhanced-insights-toggle-section">
          <button 
            className="enhanced-insights-toggle-btn"
            onClick={() => setShowAIInsights(!showAIInsights)}
          >
            <div className="toggle-btn-content">
              <div className="toggle-btn-left">
                <div className="toggle-icon-wrapper">
                  <span className="toggle-icon">{showAIInsights ? '📊' : '🔍'}</span>
                </div>
                <div className="toggle-text-content">
                  <h4 className="toggle-title">
                    {showAIInsights ? 'Hide Detailed Insights' : 'Show Detailed Insights'}
                  </h4>
                  <p className="toggle-subtitle">
                    {showAIInsights ? 'Collapse analysis details' : 'AI recommendations & data cleaning summary'}
                  </p>
                </div>
              </div>
              <div className="toggle-arrow">
                {showAIInsights ? '🔼' : '🔽'}
              </div>
            </div>
          </button>
          
          {showAIInsights && (
            <div className="enhanced-insights-section">
              {/* Data Cleaning Summary - Moved here */}
              <div className="insights-card cleaning-summary-card">
                <div className="insights-card-header">
                  <div className="insights-icon-wrapper cleaning-icon">
                    <Database className="insights-icon" />
                  </div>
                  <div>
                    <h4>Data Cleaning Summary</h4>
                    <p>Automated data preprocessing steps applied</p>
                  </div>
                </div>
                <div className="cleaning-items-grid">
                  {Object.entries(results.cleaning_report).map(([key, value]) => (
                    <div key={key} className="modern-cleaning-item">
                      <span className="cleaning-item-label">{key.replace('_', ' ')}</span>
                      <span className="cleaning-item-value">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights - Only if AI was used */}
              {results.ai_analysis_used && (
                <>
                  {/* Key Insights */}
                  {aiInsights.key_insights_to_explore?.length > 0 && (
                    <div className="insights-card">
                      <div className="insights-card-header">
                        <div className="insights-icon-wrapper ai-icon">
                          <TrendingUp className="insights-icon" />
                        </div>
                        <div>
                          <h4>Key Insights to Explore</h4>
                          <p>AI-generated recommendations for deeper analysis</p>
                        </div>
                      </div>
                      <div className="insights-content">
                        {aiInsights.key_insights_to_explore.map((insight: string, index: number) => (
                          <div key={index} className="modern-insight-item">
                            <div className="insight-bullet"></div>
                            <span>{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Plot Insights */}
                  {aiInsights.recommended_plots?.length > 0 && (
                    <div className="insights-card">
                      <div className="insights-card-header">
                        <div className="insights-icon-wrapper viz-icon">
                          <BarChart3 className="insights-icon" />
                        </div>
                        <div>
                          <h4>AI Visualization Recommendations</h4>
                          <p>Suggested charts and plots for your dataset</p>
                        </div>
                      </div>
                      <div className="plot-recommendations-grid">
                        {aiInsights.recommended_plots.map((plot: any, index: number) => (
                          <div key={index} className="modern-plot-recommendation">
                            <div className="plot-rec-badges">
                              <span className="modern-plot-type-badge">{plot.plot_type}</span>
                              <span className={`modern-priority-badge priority-${plot.priority}`}>
                                {plot.priority}
                              </span>
                            </div>
                            <h5 className="plot-rec-title">{plot.title}</h5>
                            <p className="plot-rec-desc">{plot.description}</p>
                            {plot.columns && (
                              <div className="plot-rec-columns">
                                <span>Columns: </span>
                                {plot.columns.map((col: string, idx: number) => (
                                  <span key={idx} className="column-tag">{col}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Groupings */}
                  {aiInsights.suggested_groupings?.length > 0 && (
                    <div className="insights-card">
                      <div className="insights-card-header">
                        <div className="insights-icon-wrapper grouping-icon">
                          <Zap className="insights-icon" />
                        </div>
                        <div>
                          <h4>Suggested Data Groupings</h4>
                          <p>Potential column combinations for analysis</p>
                        </div>
                      </div>
                      <div className="insights-content">
                        {aiInsights.suggested_groupings.map((grouping: string, index: number) => (
                          <div key={index} className="modern-insight-item">
                            <div className="insight-bullet"></div>
                            <span>{grouping}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
