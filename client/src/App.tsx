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
    <div className="results-container">
      {/* Header */}
      <div className="results-header">
        <button onClick={onBackToUpload} className="back-btn">
          ← Back to Upload
        </button>
        <div className="results-title-section">
          <h1 className="results-title">Analysis Results</h1>
          <p className="results-subtitle">{results.message}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <h4>Original Data</h4>
          <p>{results.original_shape[0]} rows × {results.original_shape[1]} columns</p>
        </div>
        <div className="summary-card">
          <h4>Cleaned Data</h4>
          <p>{results.cleaned_shape[0]} rows × {results.cleaned_shape[1]} columns</p>
        </div>
        <div className="summary-card">
          <h4>Data Quality</h4>
          <p>{Math.round(((results.cleaned_shape[0] / results.original_shape[0]) * 100))}% retained</p>
        </div>
      </div>

      {/* AI Insights Section - NEW! */}
      {aiInsights.key_insights_to_explore && (
        <div className="ai-insights-section">
          <h3>🤖 AI-Generated Insights</h3>
          
          {/* Key Insights */}
          {aiInsights.key_insights_to_explore?.length > 0 && (
            <div className="insights-card">
              <h4>Key Insights to Explore</h4>
              <ul className="insights-list">
                {aiInsights.key_insights_to_explore.map((insight: string, index: number) => (
                  <li key={index} className="insight-item">{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Plot Insights */}
          {aiInsights.recommended_plots?.length > 0 && (
            <div className="insights-card">
              <h4>AI Visualization Recommendations</h4>
              <div className="plot-recommendations">
                {aiInsights.recommended_plots.map((plot: any, index: number) => (
                  <div key={index} className="plot-recommendation">
                    <div className="plot-rec-header">
                      <span className="plot-type-badge">{plot.plot_type}</span>
                      <span className={`priority-badge priority-${plot.priority}`}>
                        {plot.priority} priority
                      </span>
                    </div>
                    <h5>{plot.title}</h5>
                    <p className="plot-rec-description">{plot.description}</p>
                    {plot.columns && (
                      <p className="plot-columns">Columns: {plot.columns.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Groupings */}
          {aiInsights.suggested_groupings?.length > 0 && (
            <div className="insights-card">
              <h4>Suggested Data Groupings</h4>
              <ul className="groupings-list">
                {aiInsights.suggested_groupings.map((grouping: string, index: number) => (
                  <li key={index} className="grouping-item">{grouping}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Cleaning Report */}
      <div className="cleaning-report">
        <h3>Data Cleaning Summary</h3>
        <div className="cleaning-items">
          {Object.entries(results.cleaning_report).map(([key, value]) => (
            <div key={key} className="cleaning-item">
              <span className="cleaning-label">{key.replace('_', ' ')}:</span>
              <span className="cleaning-value">{value as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic Plots Grid */}
      <div className="plots-section">
        <h2 className="plots-title">
          Data Visualizations {availablePlots.length > 0 && `(${availablePlots.length} plots)`}
        </h2>
        <div className="plots-grid">
          {availablePlots.map((config) => (
            <PlotCard
              key={config.key}
              title={config.title}
              plotData={plots[config.key]}
              description={config.description}
            />
          ))}
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

  const simulateProgress = (): Promise<void> => {
    return new Promise((resolve) => {
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            resolve();
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 200);
    });
  };

    const handleSubmit = async() => {
    if (file) {
      try {
        setIsUploading(true);
        
        // Start progress simulation
        const progressPromise = simulateProgress();
        
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
      <div className="main-content w-100">
        
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
            <p>Supported formats: CSV, Excel (.xlsx, .xls), JSON</p>
          </div>
        </div>
      </div>
    </div>
  );
}