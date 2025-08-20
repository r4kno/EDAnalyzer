# ED Analyzer

Advanced data analytics platform for transforming raw datasets into actionable insights. Upload your data and discover hidden patterns with AI-powered analysis.

[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11-green)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-Latest-green)](https://flask.palletsprojects.com/)

## 🚀 Features

- **Drag & Drop File Upload**: Easy CSV and Excel file upload with visual feedback
- **Intelligent Data Analysis**: Automated exploratory data analysis (EDA)
- **AI-Powered Insights**: Enhanced analysis with artificial intelligence
- **Interactive Visualizations**: Dynamic charts and graphs for data exploration
- **PDF Report Generation**: Export comprehensive analysis reports
- **Real-time Progress Tracking**: Live updates during data processing
- **Responsive Design**: Modern UI that works on all devices


## 📁 Project Structure

```
ED Analyzer/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   ├── App.css        # Application styles
│   │   ├── main.tsx       # React entry point
│   │   └── assets/        # Static assets
│   ├── public/            # Public assets
│   ├── package.json       # Frontend dependencies
│   ├── vite.config.ts     # Vite configuration
│   └── tsconfig.json      # TypeScript configuration
│
├── server/                # Python Backend
│   ├── app.py            # Flask application
│   ├── eda.py            # EDA processing logic
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
│
└── README.md             # Project documentation
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ed-analyzer.git
cd ed-analyzer
```

### 2. Backend Setup
```bash
cd server

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "FLASK_ENV=development" > .env
```

### 3. Frontend Setup
```bash
cd ../client

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Start the Application
```bash
# Terminal 1 - Backend
cd server
python app.py

# Terminal 2 - Frontend  
cd client
npm run dev
```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

## 📊 Usage

### 1. Upload Data
- Navigate to the application in your browser
- Drag and drop a CSV or Excel file onto the upload area
- Or click to browse and select a file
- Supported formats: `.csv`, `.xlsx`, `.xls`

### 2. Analysis Process
- Click "Start Analysis" to begin processing
- Watch real-time progress updates
- The system performs automated EDA including:
  - Data cleaning and preprocessing
  - Statistical analysis
  - Correlation analysis
  - Distribution analysis
  - Missing value analysis

### 3. View Results
- Interactive visualizations are generated automatically
- Explore different chart types and insights
- View data quality metrics and recommendations

### 4. Export Reports
- Generate comprehensive PDF reports
- Reports include all visualizations and insights
- Download with timestamp for record keeping

## 🔧 API Endpoints

### POST `/analyze`
Analyze uploaded dataset and generate insights.

**Request:**
- `file`: Multipart file upload (CSV/Excel)
- `ai_analysis`: Boolean for AI enhancement

**Response:**
```json
{
  "success": true,
  "results": {
    "original_shape": [1000, 10],
    "cleaned_shape": [950, 10],
    "visualizations": {...},
    "ai_analysis_used": true
  }
}
```

## 🎨 Key Components

### Frontend Components

#### [`EDAnalyzerHomepage`](client/src/App.tsx)
Main application component handling:
- File upload with drag & drop
- Progress tracking
- Results visualization
- PDF generation

### Backend Modules

#### [`app.py`](server/app.py)
Flask application with:
- File upload handling
- CORS configuration
- API endpoint routing

#### [`eda.py`](server/eda.py)
Data analysis engine featuring:
- Automated data cleaning
- Statistical analysis
- Visualization generation
- AI-enhanced insights

## 🔮 Technologies Used

### Frontend Stack
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Next-generation build tool
- **jsPDF**: Client-side PDF generation
- **Lucide React**: Beautiful icons

### Backend Stack
- **Flask**: Lightweight Python web framework
- **Pandas**: Data manipulation and analysis
- **Matplotlib/Seaborn**: Data visualization
- **NumPy**: Numerical computing

### Development Tools
- **ESLint**: Code linting
- **Git**: Version control
- **npm**: Package management
- **pip**: Python package management

## 🚀 Deployment

### Frontend (Vercel/Netlify)
```bash
cd client
npm run build
# Deploy dist/ folder
```

### Backend (Heroku/Railway)
```bash
cd server
# Add Procfile: web: python app.py
# Deploy with platform of choice
```

## 📬 Contact

For any queries, reach out at [onkargupta0864@gmail.com] or connect via [LinkedIn](https://www.linkedin.com/in/onkar-gupta-6398ba264/).

---
