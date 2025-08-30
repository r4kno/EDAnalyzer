from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load environment variables FIRST
load_dotenv()

# Now import eda after env vars are loaded
from eda import load_data_from_url, perform_eda_with_visualizations

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({"message": "ED Analyzer Backend is running!"})

@app.route('/api/file', methods=['POST'])
def process_file():
    try:
        data = request.get_json()
        if not data or 'file_link' not in data:
            return jsonify({"error": "No file link provided"}), 400
        
        file_link = data['file_link']
        analysis_request = data.get('analysis_request', '')
        
        # Step 1: Load data from URL
        df = load_data_from_url(file_link)
        if df is None:
            return jsonify({"error": "Failed to load data from URL"}), 400
        
        # Step 2: Perform AI-guided EDA
        result = perform_eda_with_visualizations(df, analysis_request)
        
        # Determine message based on AI usage
        ai_used = result.get('ai_used', False)
        if ai_used:
            message = "Analysis complete with AI-guided insights! 🤖📊"
        else:
            message = "Analysis complete with comprehensive insights! 📊"
        
        # Return comprehensive results
        return jsonify({
            "message": message,
            "original_shape": list(df.shape),
            "cleaned_shape": list(result['cleaned_data'].shape),
            "cleaning_report": result['cleaning_report'],
            "summary": result['summary'],
            "plots": result['visualizations'],
            "ai_insights": result['ai_recommendations'],
            "ai_used": result['ai_used'],
            "ai_details": result['ai_details'],
            "file_url": file_link
        })
        
    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)