from flask import Flask, request, jsonify
from flask_cors import CORS
from eda import load_data_from_url, perform_eda_with_visualizations
from dotenv import load_dotenv

load_dotenv()  # Load environment variables

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
        analysis_request = data.get('analysis_request', '')  # User context for AI
        
        print(f"Processing file: {file_link}")
        print(f"User context: {analysis_request}")
        
        # Step 1: Load data from URL
        df = load_data_from_url(file_link)
        if df is None:
            return jsonify({"error": "Failed to load data from URL"}), 400
        
        # Step 2: Perform AI-guided EDA
        result = perform_eda_with_visualizations(df, analysis_request)
        
        # Return comprehensive results
        return jsonify({
            "message": "Analysis complete with AI-guided insights! 🤖📊",
            "original_shape": list(df.shape),
            "cleaned_shape": list(result['cleaned_data'].shape),
            "cleaning_report": result['cleaning_report'],
            "summary": result['summary'],
            "plots": result['visualizations'],
            "ai_insights": result['ai_recommendations'],
            "file_url": file_link
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)