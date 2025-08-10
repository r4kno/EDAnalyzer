import React, { useState, useEffect, type JSX } from 'react';
import { Upload, BarChart3, TrendingUp, Database, FileSpreadsheet, Zap, MessageSquare, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import './App.css';

interface FloatingElement {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
}

const ResultsView: React.FC<{ 
  results: any; 
  onBackToUpload: () => void; 
}> = ({ results, onBackToUpload }) => {
  const plots = results.plots || {};
  const aiInsights = results.ai_insights || {};
  const [showAIInsights, setShowAIInsights] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  
  const availablePlots = Object.keys(plots).map(key => {
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

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;
      let currentPage = 1;

      const addFooter = (pageNum: number) => {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        
        pdf.textWithLink('ED Analyzer', margin, pageHeight - 8, {
          url: 'https://github.com/r4kno/EDAnalyzer'
        });

        pdf.text(`Page ${pageNum}`, pageWidth - margin - 15, pageHeight - 8);
      };

      const checkNewPage = (requiredHeight: number, forceNewPage = false) => {
        if (yPosition + requiredHeight > pageHeight - 20 || forceNewPage) {
          addFooter(currentPage);
          pdf.addPage();
          currentPage++;
          yPosition = margin;
          return true;
        }
        return false;
      };

      const getImageDimensions = (base64String: string): Promise<{width: number, height: number}> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          };
          img.src = `data:image/png;base64,${base64String}`;
        });
      };

      pdf.setFontSize(28);
      pdf.setTextColor(59, 130, 246);
      pdf.text('ED Analyzer', pageWidth / 2, 50, { align: 'center' });
      
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Data Analysis Report', pageWidth / 2, 70, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 85, { align: 'center' });
      
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(59, 130, 246);
      pdf.line(pageWidth / 2 - 30, 95, pageWidth / 2 + 30, 95);
      
      yPosition = 120;

      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Executive Summary', margin, yPosition);
      
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(59, 130, 246);
      pdf.line(margin, yPosition + 2, margin + 50, yPosition + 2);
      yPosition += 12;

      pdf.setFontSize(11);
      pdf.setTextColor(60, 60, 60);
      const summaryText = results.message || 'Data analysis completed successfully with comprehensive insights and visualizations.';
      const splitSummary = pdf.splitTextToSize(summaryText, pageWidth - 2 * margin);
      pdf.text(splitSummary, margin, yPosition);
      yPosition += splitSummary.length * 5 + 15;

      checkNewPage(45);
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Data Overview', margin, yPosition);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPosition + 2, margin + 35, yPosition + 2);
      yPosition += 12;

      const summaryData = [
        ['Original Data', `${results.original_shape[0]} rows × ${results.original_shape[1]} columns`],
        ['Cleaned Data', `${results.cleaned_shape[0]} rows × ${results.cleaned_shape[1]} columns`],
        ['Data Retention', `${Math.round(((results.cleaned_shape[0] / results.original_shape[0]) * 100))}%`],
        ['AI Enhancement', results.ai_analysis_used ? 'Enabled' : 'Standard Analysis']
      ];

      pdf.setFontSize(10);
      summaryData.forEach(([label, value]) => {
        pdf.setTextColor(80, 80, 80);
        pdf.text(`${label}:`, margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        pdf.text(value, margin + 45, yPosition);
        yPosition += 6;
      });
      yPosition += 10;

      if (results.cleaning_report && Object.keys(results.cleaning_report).length > 0) {
        checkNewPage(40);
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Data Processing', margin, yPosition);
        pdf.line(margin, yPosition + 2, margin + 40, yPosition + 2);
        yPosition += 12;

        pdf.setFontSize(9);
        const cleaningEntries = Object.entries(results.cleaning_report);
        const midPoint = Math.ceil(cleaningEntries.length / 2);

        for (let i = 0; i < midPoint; i++) {
          const [key, value] = cleaningEntries[i];
          const wrappedValue = pdf.splitTextToSize(String(value), 40);

          pdf.setTextColor(80, 80, 80);
          pdf.text(`${key.replace('_', ' ')}:`, margin, yPosition);
          pdf.setTextColor(0, 0, 0);
          pdf.text(wrappedValue, margin + 50, yPosition);

          if (cleaningEntries[i + midPoint]) {
            const [key2, value2] = cleaningEntries[i + midPoint];
            const wrappedValue2 = pdf.splitTextToSize(String(value2), 40);

            pdf.setTextColor(80, 80, 80);
            pdf.text(`${key2.replace('_', ' ')}:`, margin + 100, yPosition);
            pdf.setTextColor(0, 0, 0);
            pdf.text(wrappedValue2, margin + 150, yPosition);
          }

          const rowHeight = Math.max(
            pdf.getTextDimensions(wrappedValue).h * wrappedValue.length,
            cleaningEntries[i + midPoint]
              ? pdf.getTextDimensions(
                  pdf.splitTextToSize(String(cleaningEntries[i + midPoint][1]), 40)
                ).h *
                  pdf.splitTextToSize(
                    String(cleaningEntries[i + midPoint][1]),
                    40
                  ).length
              : 0
          );
          yPosition += rowHeight + 2;
        }
        yPosition += 10;
      }

      checkNewPage(0, true);
      pdf.setFontSize(18);
      pdf.setTextColor(59, 130, 246);
      pdf.text('Data Visualizations', pageWidth / 2, yPosition, { align: 'center' });
      pdf.line(pageWidth / 2 - 40, yPosition + 3, pageWidth / 2 + 40, yPosition + 3);
      yPosition += 20;

      for (let i = 0; i < availablePlots.length; i++) {
        const config = availablePlots[i];
        
        try {
          const imageDimensions = await getImageDimensions(plots[config.key]);
          
          const maxWidth = pageWidth - 2 ;
          const maxHeight = 200;
          
          const aspectRatio = imageDimensions.width / imageDimensions.height;
          let imgWidth = maxWidth;
          let imgHeight = imgWidth / aspectRatio;
          
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * aspectRatio;
          }
          
          const requiredSpace = imgHeight + 25;
          checkNewPage(requiredSpace);

          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          pdf.text(config.title, margin, yPosition);
          yPosition += 8;

          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          const descText = pdf.splitTextToSize(config.description, pageWidth - 2 * margin);
          pdf.text(descText, margin, yPosition);
          yPosition += descText.length * 3 + 5;

          const xPosition = (pageWidth - imgWidth) / 2;
          
          const imgData = `data:image/png;base64,${plots[config.key]}`;
          pdf.addImage(imgData, 'PNG', xPosition, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 15;

        } catch (error) {
          console.error('Error adding image to PDF:', error);
          checkNewPage(25);
          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          pdf.text(config.title, margin, yPosition);
          yPosition += 10;
          
          pdf.setFontSize(10);
          pdf.setTextColor(255, 0, 0);
          pdf.text('Visualization could not be loaded', margin, yPosition);
          yPosition += 15;
        }
      }

      if (results.ai_analysis_used && aiInsights.key_insights_to_explore?.length > 0) {
        checkNewPage(0, true);
        
        pdf.setFontSize(16);
        pdf.setTextColor(59, 130, 246);
        pdf.text('AI-Generated Insights', pageWidth / 2, yPosition, { align: 'center' });
        pdf.line(pageWidth / 2 - 35, yPosition + 3, pageWidth / 2 + 35, yPosition + 3);
        yPosition += 20;

        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Key Findings', margin, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        aiInsights.key_insights_to_explore.forEach((insight: string) => {
          checkNewPage(12);
          const bullet = '•';
          pdf.text(bullet, margin, yPosition);
          const insightText = pdf.splitTextToSize(insight, pageWidth - 2 * margin - 8);
          pdf.text(insightText, margin + 5, yPosition);
          yPosition += insightText.length * 4 + 3;
        });

        if (aiInsights.recommended_plots?.length > 0) {
          yPosition += 8;
          checkNewPage(30);

          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          pdf.text('Visualization Recommendations', margin, yPosition);
          yPosition += 10;

          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          aiInsights.recommended_plots.slice(0, 5).forEach((plot: any, index: number) => {
            checkNewPage(15);
            pdf.text(`${index + 1}. ${plot.title} (${plot.plot_type})`, margin, yPosition);
            yPosition += 5;
            
            const plotDesc = pdf.splitTextToSize(plot.description, pageWidth - 2 * margin - 10);
            pdf.text(plotDesc, margin + 5, yPosition);
            yPosition += plotDesc.length * 3 + 4;
          });
        }
      }

      addFooter(currentPage);

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const fileName = `EDA_Report_${timestamp}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="results-app-container">
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

      <div className="grid-overlay" />

      <div className="results-main-content">
        <div className="results-header-section">
          <div className="buttons" style={{
            width: '100%',
            height: '50px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 1rem'
          }}>
            <button onClick={onBackToUpload} className='modern-back-btn'>
              <Upload className="back-icon" />
              New Analysis
            </button>
            <button 
              className="modern-back-btn"
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              style={{ 
                background: isGeneratingPDF ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                borderColor: isGeneratingPDF ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                color: isGeneratingPDF ? '#9ca3af' : '#10b981'
              }}
            >
              <Download className="back-icon" />
              {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
          
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
                </div>
              </div>
            ))}
          </div>
        </div>

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

              {results.ai_analysis_used && (
                <>
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

export default function EDAnalyzerHomepage(): JSX.Element {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [floatingElements, setFloatingElements] = useState<FloatingElement[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [analysisRequest, setAnalysisRequest] = useState<string>('');
  const [file_link, setFileLink] = useState<string | null>(null);

  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const elements: FloatingElement[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 20 + 10,
      opacity: Math.random() * 0.3 + 0.1,
      duration: Math.random() * 20 + 10
    }));
    setFloatingElements(elements);
  }, []);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "https://edanalyzer.onrender.com";
    fetch(baseUrl)
      .then(response => response.json())
      .then(data => {
        if (import.meta.env.DEV) {
          console.log('Backend health check:', data);
        }
      })
      .catch(error => {
        console.error("Backend connection failed:", error);
      });
  }, []);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the upload area entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const simulateProgress = (file: File): Promise<void> => {
    return new Promise((resolve) => {
      const sizeMB = file.size / (1024 * 1024); // bytes → MB
      const duration = (sizeMB / 0.1) * 1000;  // 10s per 0.1 MB

      setUploadProgress(0);

      const stepTime = 200; // ms between updates
      const totalSteps = duration / stepTime;

      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            resolve();
            return 100;
          }
          // Base increment so we finish in target time
          const baseIncrement = 100 / totalSteps;
          // Add small randomness (±30% of base increment)
          const randomFactor = 1 + (Math.random() - 0.5) * 0.6;
          return Math.min(prev + baseIncrement * randomFactor, 100);
        });
      }, stepTime);
    });
  };

  const handleSubmit = async() => {
    if (file) {
      try {
        setError(null);
        setIsUploading(true);
        
        // Start progress simulation
        const progressPromise = simulateProgress(file);
        
        // Handle file submission logic here
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "ED_Analyzer");
        formData.append("cloud_name", import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dtu8mgezf");

        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dtu8mgezf";
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        setFileLink(data.secure_url);
        console.log("Uploaded file URL:", data.secure_url);

        // Wait for progress to complete
        await progressPromise;
        
        // Start analysis phase
        

        const backendRes = await fetch(`${import.meta.env.VITE_API_URL || "https://edanalyzer.onrender.com"}/api/file`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            file_link: data.secure_url,
            analysis_request: analysisRequest 
          })
        });

        const backendData = await backendRes.json();
        if (import.meta.env.DEV) {
          console.log("Backend response:", backendData);
        }
        
        // Store results and show results page
        setAnalysisResults(backendData);
        setShowResults(true);
        
      } catch (error) {
        console.error("Upload error:", error);
        setError(error instanceof Error ? error.message : "Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
       
        
      
        setUploadProgress(0);
      }
    }
  };

  const resetToUpload = () => {
    setShowResults(false);
    setAnalysisResults(null);
    setFile(null);
    setAnalysisRequest('');
  };

  // Add this condition at the beginning of the return statement
  if (showResults && analysisResults) {
    return <ResultsView results={analysisResults} onBackToUpload={resetToUpload} />;
  }

  return (
    <div className="app-container w-screen">
      {/* Animated Background Elements */}
      <div className="floating-bg">
        {floatingElements.map((element) => (
          <div
            key={element.id}
            className="floating-element"
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.size}px`,
              height: `${element.size}px`,
              opacity: element.opacity,
              animationDuration: `${element.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Grid Pattern Overlay */}
      <div className="grid-overlay" />

      {/* Main Content */}
      <div className="main-content w-100 ">
        
        {/* Header Section */}
        <div className="header-section">
          <div className="logo-container">
            <div className="logo-wrapper">
              <BarChart3 className="logo-icon" />
              <div className="logo-dot" />
            </div>
          </div>
          
          <h1 className="main-title">
            ED Analyzer
          </h1>
          
          <p className="description">
            Transform your raw datasets into powerful insights with advanced analytics engine. 
            Upload your data and unlock hidden patterns, trends, and correlations with AI-powered Exploratory Data Analysis.
          </p>

          {/* Feature Icons */}
          <div className="features-container">
            <div className="feature-item">
              <div className="feature-icon-wrapper feature-blue">
                <Database className="feature-icon" />
              </div>
              <span className="feature-label">Data Processing</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper feature-purple">
                <TrendingUp className="feature-icon" />
              </div>
              <span className="feature-label">Trend Analysis</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper feature-pink">
                <Zap className="feature-icon" />
              </div>
              <span className="feature-label">Real-time Results</span>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="upload-container">
          <div 
            className={`upload-area ${dragActive ? 'drag-active' : ''} ${file ? 'file-ready' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="upload-content">
              {file ? (
                <div className="file-ready-content">
                  <FileSpreadsheet className="file-icon" />
                  <h3 className="file-title">File Ready for Analysis</h3>
                  <p className="file-name">{file.name}</p>
                  <p className="file-size">
                    File size: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className={`upload-icon ${dragActive ? 'drag-active' : ''}`} />
                  <h3 className="upload-title">Upload Your Dataset</h3>
                  <p className="upload-description">
                    Drag and drop your CSV, Excel, or JSON files here, or click to browse
                  </p>
                </div>
              )}
              
              <input
                type="file"
                id="file-upload"
                className="file-input"
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileSelect}
              />
              
              {!file && (
                <label htmlFor="file-upload" className="choose-file-btn">
                  <Upload className="btn-icon" />
                  Choose File
                </label>
              )}
            </div>

            {/* Progress indicator for file upload */}
            {dragActive && (
              <div className="drop-overlay">
                <div className="drop-text">Drop your file here!</div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="progress-text">
                {file_link ? 'Analyzing data...Please wait.' : `Uploading... ${Math.round(uploadProgress)}%`}
              </p>
            </div>
          )}

          {/* Analysis Request Text Field */}
          {file && !isUploading && (
            <div className="analysis-request-container">
              <div className="request-header">
                <MessageSquare className="request-icon" />
                <h4 className="request-title">What would you like to analyze?</h4>
              </div>
              <textarea
                className="analysis-textarea"
                placeholder="Describe what insights you're looking for... (e.g., 'Find trends in sales data', 'Identify customer patterns', 'Analyze correlation between variables')"
                value={analysisRequest}
                onChange={(e) => setAnalysisRequest(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Submit Button */}
          {file && !isUploading && (
            <div className="submit-container">
              <button onClick={handleSubmit} className="submit-btn">
                <BarChart3 className="submit-icon" />
                Start Analysis
              </button>
            </div>
          )}

          {/* Supported Formats */}
          <div className="formats-info">
            <p>Supported formats: CSV, Excel (.xlsx, .xls)</p>
          </div>

          {/* Error Message Display */}
          {error && (
  <div className="error-message" style={{
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '1rem',
    borderRadius: '8px',
    margin: '1rem 0'
  }}>
    {error}
  </div>
)}
        </div>

      </div>

        {/* Professional Footer */}
        <footer className="professional-footer">
          <div className="footer-content">
            <div className="footer-section footer-brand">
              <div className="footer-logo">
                <BarChart3 className="footer-logo-icon" />
                <span className="footer-brand-name">ED Analyzer</span>
              </div>
              <p className="footer-description">
                Advanced data analytics platform for transforming raw datasets into actionable insights. 
                Upload your data and discover hidden patterns with AI-powered analysis.
              </p>
              <div className="footer-tech-stack">
                <span className="tech-badge">React</span>
                <span className="tech-badge">TypeScript</span>
                <span className="tech-badge">Python</span>
                <span className="tech-badge">AI/ML</span>
              </div>
            </div>

            <div className="footer-section footer-datasets">
              <h4 className="footer-section-title">Sample Datasets</h4>
              <div className="footer-dataset-links">
                <a 
                  href="https://res.cloudinary.com/dtu8mgezf/raw/upload/v1754835451/ft7munl6xfizbzsbjzug.csv" 
                  download
                  className="footer-dataset-link"
                >
                  <svg className="dataset-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                  <div className="dataset-content">
                    <span className="dataset-title">Sales Analytics</span>
                    <span className="dataset-subtitle">E-commerce sales data • 12K rows</span>
                  </div>
                </a>
                
                <a 
                  href="https://res.cloudinary.com/dtu8mgezf/raw/upload/v1754835540/hf5wovgm8vzbpjtfhloj.csv" 
                  download
                  className="footer-dataset-link"
                >
                  <svg className="dataset-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                  <div className="dataset-content">
                    <span className="dataset-title">Customer Behavior</span>
                    <span className="dataset-subtitle">User interaction patterns • 8.5K rows</span>
                  </div>
                </a>

                <a 
                  href="https://res.cloudinary.com/dtu8mgezf/raw/upload/v1754835606/bcfvrccanrdionnovvhs.csv" 
                  download
                  className="footer-dataset-link"
                >
                  <svg className="dataset-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                  <div className="dataset-content">
                    <span className="dataset-title">Financial Metrics</span>
                    <span className="dataset-subtitle">Stock market data • 15K rows</span>
                  </div>
                </a>
              </div>
              <a href='https://www.kaggle.com/datasets?fileType=csv&sizeEnd=10%2CMB'>
              <button className="explore-datasets-btn">
                <Database className="explore-icon" />
                <span>Explore More Datasets</span>
              </button>
              </a>
            </div>

            <div className="footer-section footer-connect">
              <h4 className="footer-section-title">Connect & Contribute</h4>
              <div className="footer-social-links">
                <a 
                  href="https://ed-analyzer.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-social-link github-link"
                >
                  <svg className="social-icon github-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <div className="link-content">
                    <span className="link-title">GitHub</span>
                    <span className="link-subtitle">View source & contribute</span>
                  </div>
                </a>

                <a href="mailto:onkargupta0864@gmail.com" className="footer-social-link email-link">
                  <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  <div className="link-content">
                    <span className="link-title">Email</span>
                    <span className="link-subtitle">onkargupta0864@gmail.com</span>
                  </div>
                </a>

                <a href="" className="footer-social-link feedback-link">
                  <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                  <div className="link-content">
                    <span className="link-title">Feedback</span>
                    <span className="link-subtitle">Share your thoughts</span>
                  </div>
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="footer-bottom-content">
              <div className="footer-copyright">
                <p>&copy; {new Date().getFullYear()} ED Analyzer. Built with ❤️ for data enthusiasts.</p>
              </div>
              <div className="footer-version">
                <span className="version-badge">v1.2.0</span>
              </div>
            </div>
          </div>
        </footer>
    </div>
  );
}