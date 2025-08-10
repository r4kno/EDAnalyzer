import React, { useState, useEffect, type JSX } from 'react';
import { Upload, BarChart3, TrendingUp, Database, FileSpreadsheet, Zap, MessageSquare, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './App.css';

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  
  // Dynamic plot configurations based on actual plots returned
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
      const margin = 15; // Reduced margin for better space utilization
      let yPosition = margin;
      let currentPage = 1;

      // Helper function to add footer
      const addFooter = (pageNum: number) => {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text('ED Analyzer', margin, pageHeight - 8);
        pdf.text(`Page ${pageNum}`, pageWidth - margin - 15, pageHeight - 8);
      };

      // Helper function to check if new page is needed
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

      // Helper function to get image dimensions
      const getImageDimensions = (base64String: string): Promise<{width: number, height: number}> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = function() {
            resolve({ width: this.width, height: this.height });
          };
          img.src = `data:image/png;base64,${base64String}`;
        });
      };

      // Title Page
      pdf.setFontSize(28);
      pdf.setTextColor(59, 130, 246);
      pdf.text('ED Analyzer', pageWidth / 2, 50, { align: 'center' });
      
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Data Analysis Report', pageWidth / 2, 70, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 85, { align: 'center' });
      
      // Add a decorative line
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(59, 130, 246);
      pdf.line(pageWidth / 2 - 30, 95, pageWidth / 2 + 30, 95);
      
      yPosition = 120;

      // Executive Summary Section
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Executive Summary', margin, yPosition);
      
      // Add underline
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

      // Data Summary Section - Compact table
      checkNewPage(45);
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Data Overview', margin, yPosition);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPosition + 2, margin + 35, yPosition + 2);
      yPosition += 12;

      // Create a more compact summary table
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

      // Data Cleaning Summary - More compact
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
        
        // Split into two columns for better space utilization
        for (let i = 0; i < midPoint; i++) {
          const [key, value] = cleaningEntries[i];
          pdf.setTextColor(80, 80, 80);
          pdf.text(`${key.replace('_', ' ')}:`, margin, yPosition);
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${value}`, margin + 50, yPosition);
          
          // Second column
          if (cleaningEntries[i + midPoint]) {
            const [key2, value2] = cleaningEntries[i + midPoint];
            pdf.setTextColor(80, 80, 80);
            pdf.text(`${key2.replace('_', ' ')}:`, margin + 100, yPosition);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`${value2}`, margin + 150, yPosition);
          }
          yPosition += 5;
        }
        yPosition += 10;
      }

      // Visualizations Section - New page for better presentation
      checkNewPage(0, true);
      pdf.setFontSize(18);
      pdf.setTextColor(59, 130, 246);
      pdf.text('Data Visualizations', pageWidth / 2, yPosition, { align: 'center' });
      pdf.line(pageWidth / 2 - 40, yPosition + 3, pageWidth / 2 + 40, yPosition + 3);
      yPosition += 20;

      // Process plots with dynamic sizing
      for (let i = 0; i < availablePlots.length; i++) {
        const config = availablePlots[i];
        
        try {
          // Get actual image dimensions
          const imageDimensions = await getImageDimensions(plots[config.key]);
          
          // Calculate optimal dimensions while maintaining aspect ratio
          const maxWidth = pageWidth - 2 * margin;
          const maxHeight = 120; // Maximum height per plot
          
          const aspectRatio = imageDimensions.width / imageDimensions.height;
          let imgWidth = maxWidth;
          let imgHeight = imgWidth / aspectRatio;
          
          // If height exceeds maximum, adjust width accordingly
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * aspectRatio;
          }
          
          // Check if we need a new page
          const requiredSpace = imgHeight + 25; // Image + title space
          checkNewPage(requiredSpace);

          // Plot title and description - more compact
          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          pdf.text(config.title, margin, yPosition);
          yPosition += 8;

          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          const descText = pdf.splitTextToSize(config.description, pageWidth - 2 * margin);
          pdf.text(descText, margin, yPosition);
          yPosition += descText.length * 3 + 5;

          // Center the image horizontally
          const xPosition = (pageWidth - imgWidth) / 2;
          
          // Add the image
          const imgData = `data:image/png;base64,${plots[config.key]}`;
          pdf.addImage(imgData, 'PNG', xPosition, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 15;

        } catch (error) {
          console.error('Error adding image to PDF:', error);
          // Fallback for broken images
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

      // AI Insights Section - Only if available and substantial
      if (results.ai_analysis_used && aiInsights.key_insights_to_explore?.length > 0) {
        checkNewPage(0, true);
        
        pdf.setFontSize(16);
        pdf.setTextColor(59, 130, 246);
        pdf.text('AI-Generated Insights', pageWidth / 2, yPosition, { align: 'center' });
        pdf.line(pageWidth / 2 - 35, yPosition + 3, pageWidth / 2 + 35, yPosition + 3);
        yPosition += 20;

        // Key Insights - More compact formatting
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Key Findings', margin, yPosition);
        yPosition += 10;

        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        aiInsights.key_insights_to_explore.forEach((insight: string, index: number) => {
          checkNewPage(12);
          const bullet = '•';
          pdf.text(bullet, margin, yPosition);
          const insightText = pdf.splitTextToSize(insight, pageWidth - 2 * margin - 8);
          pdf.text(insightText, margin + 5, yPosition);
          yPosition += insightText.length * 4 + 3;
        });

        // Visualization Recommendations - Condensed format
        if (aiInsights.recommended_plots?.length > 0) {
          yPosition += 8;
          checkNewPage(30);

          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);
          pdf.text('Visualization Recommendations', margin, yPosition);
          yPosition += 10;

          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          aiInsights.recommended_plots.slice(0, 5).forEach((plot: any, index: number) => { // Limit to top 5 recommendations
            checkNewPage(15);
            pdf.text(`${index + 1}. ${plot.title} (${plot.plot_type})`, margin, yPosition);
            yPosition += 5;
            
            const plotDesc = pdf.splitTextToSize(plot.description, pageWidth - 2 * margin - 10);
            pdf.text(plotDesc, margin + 5, yPosition);
            yPosition += plotDesc.length * 3 + 4;
          });
        }
      }

      // Add footer to last page
      addFooter(currentPage);

      // Save the PDF with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const fileName = `ED_Analyzer_Report_${timestamp}.pdf`;
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
          <div style={{ display: 'flex', gap: '1rem', position: 'absolute', top: 0, left: 0, flexWrap: 'wrap' }}>
            {/* <button onClick={onBackToUpload} className="modern-back-btn">
              <Upload className="back-icon" />
              New Analysis
            </button> */}
            
            <button 
              onClick={generatePDF} 
              className="modern-back-btn"
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

export default function EDAnalyzerHomepage(): JSX.Element {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [floatingElements, setFloatingElements] = useState<FloatingElement[]>([]);
  const [dragCounter, setDragCounter] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [analysisRequest, setAnalysisRequest] = useState<string>('');
  
  // Add these new states for results
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);


  // Generate floating data elements for background animation
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
    const res = fetch("http://127.0.0.1:5000")
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(error => console.error("Error fetching data:", error));
    console.log("Backend response:", res);
  }, []);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setDragActive(false);
      }
      return newCounter;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragCounter(0);
    
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
        setIsUploading(true);
        
        // Start progress simulation
        const progressPromise = simulateProgress(file);
        
        // Handle file submission logic here
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "ED_Analyzer");
        formData.append("cloud_name", "dtu8mgezf");

        const res = await fetch("https://api.cloudinary.com/v1_1/dtu8mgezf/raw/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        console.log("Uploaded file URL:", data.secure_url);

        // Wait for progress to complete
        await progressPromise;
        
        // Start analysis phase
        setIsAnalyzing(true);

        const backendRes = await fetch("http://127.0.0.1:5000/api/file", {
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
        console.log("Backend response:", backendData);
        
        // Store results and show results page
        setAnalysisResults(backendData);
        setShowResults(true);
        
      } catch (error) {
        console.error("Upload error:", error);
        alert("Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
        setIsAnalyzing(false);
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
            Transform your raw datasets into powerful insights with our advanced analytics engine. 
            Upload your data and unlock hidden patterns, trends, and correlations with AI-powered analysis.
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
                {isAnalyzing ? 'Analyzing data...' : `Uploading... ${Math.round(uploadProgress)}%`}
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
        </div>
      </div>
    </div>
  );
}