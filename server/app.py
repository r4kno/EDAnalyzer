from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import io

# Load environment variables FIRST
load_dotenv()

# Now import eda after env vars are loaded
from eda import load_data_from_url, perform_eda_with_visualizations

app = Flask(__name__)
CORS(app)

def upload_cleaned_data_to_cloudinary(cleaned_df, original_filename):
    """Upload cleaned DataFrame to Cloudinary and return download URL"""
    try:
        # Convert DataFrame to CSV
        csv_buffer = io.StringIO()
        cleaned_df.to_csv(csv_buffer, index=False)
        csv_content = csv_buffer.getvalue()
        
        # Prepare file for upload
        files = {
            'file': (f"cleaned_{original_filename}", csv_content, 'text/csv')
        }
        
        data = {
            'upload_preset': os.getenv('VITE_CLOUDINARY_UPLOAD_PRESET', 'ED_Analyzer'),
            'cloud_name': os.getenv('VITE_CLOUDINARY_CLOUD_NAME', 'dtu8mgezf'),
            'resource_type': 'raw'
        }
        
        cloud_name = os.getenv('VITE_CLOUDINARY_CLOUD_NAME', 'dtu8mgezf')
        upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/raw/upload"
        
        response = requests.post(upload_url, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            return result.get('secure_url')
        else:
            print(f"Cloudinary upload failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"Error uploading to Cloudinary: {e}")
        return None

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
        
        # Extract original filename from URL
        original_filename = file_link.split('/')[-1].split('.')[0] + '.csv'
        
        # Step 1: Load data from URL
        df = load_data_from_url(file_link)
        if df is None:
            return jsonify({"error": "Failed to load data from URL"}), 400
        
        # Step 2: Perform AI-guided EDA
        result = perform_eda_with_visualizations(df, analysis_request)
        
        # Step 3: Upload cleaned data to Cloudinary
        cleaned_data_url = upload_cleaned_data_to_cloudinary(result['cleaned_data'], original_filename)
        
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
            "file_url": file_link,
            "cleaned_data_url": cleaned_data_url  # Add cleaned data download URL
        })
        
    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

@app.route('/api/debug-ai-detailed', methods=['GET'])
def debug_ai_detailed():
    """Detailed AI debugging"""
    import google.generativeai as genai
    
    try:
        # Check environment
        api_key = os.getenv('GEMINI_API_KEY')
        
        debug_info = {
            "api_key_present": bool(api_key),
            "api_key_length": len(api_key) if api_key else 0,
            "api_key_prefix": api_key[:10] if api_key else None
        }
        
        if not api_key:
            return jsonify({
                "status": "error",
                "message": "No API key found",
                "debug": debug_info
            })
        
        # Configure and test
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Make actual API call
        print("Making test API call to Gemini...")
        response = model.generate_content("Say 'Hello from Gemini' if you receive this")
        print(f"Response received: {response.text}")
        
        return jsonify({
            "status": "success",
            "api_response": response.text,
            "debug": debug_info,
            "model_configured": True
        })
        
    except Exception as e:
        print(f"AI test failed: {e}")
        import traceback
        return jsonify({
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()[-500:],  # Last 500 chars
            "debug": debug_info if 'debug_info' in locals() else {}
        })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)