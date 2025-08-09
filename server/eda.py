import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import requests
from io import StringIO
import re
import base64
from io import BytesIO
import google.generativeai as genai
import json
import os

# Configure Gemini API with error handling
try:
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-2.5-flash')  # Updated model name
except Exception as e:
    print(f"Gemini API setup failed: {e}")
    model = None

def load_data_from_url(file_url):
    """Load data from Cloudinary URL"""
    try:
        response = requests.get(file_url)
        if response.status_code == 200:
            if file_url.endswith('.csv'):
                return pd.read_csv(StringIO(response.text))
            elif file_url.endswith(('.xlsx', '.xls')):
                return pd.read_excel(response.content)
            elif file_url.endswith('.json'):
                return pd.read_json(StringIO(response.text))
        return None
    except Exception as e:
        print(f"Error loading data: {e}")
        return None

def smart_type_detection(df, column):
    """Intelligently detect and suggest column types"""
    sample_values = df[column].dropna().astype(str).head(100)
    
    patterns = {
        'date': [
            r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
            r'\d{2}-\d{2}-\d{4}',  # DD-MM-YYYY
        ],
        'price': [
            r'^\$?\d+\.?\d*$',     # $123.45 or 123.45
            r'^\d+,\d{3}',         # 1,234
        ],
        'phone': [r'\d{3}-\d{3}-\d{4}', r'\(\d{3}\)\s?\d{3}-\d{4}'],
        'email': [r'^[^@]+@[^@]+\.[^@]+$'],
    }
    
    detected_types = []
    
    for type_name, pattern_list in patterns.items():
        matches = 0
        for pattern in pattern_list:
            matches += sample_values.str.match(pattern).sum()
        
        match_rate = matches / len(sample_values)
        if match_rate > 0.7:  # 70% match threshold
            detected_types.append((type_name, match_rate))
    
    # Check for categorical (low cardinality)
    if df[column].nunique() / len(df[column]) < 0.1:
        detected_types.append(('categorical', df[column].nunique() / len(df[column])))
    
    return detected_types

def smart_column_transformer(df, column, target_type, confidence_threshold=0.8):
    """Universal column transformer with validation"""
    
    transformers = {
        'datetime': [
            lambda x: pd.to_datetime(x, errors='coerce'),
            lambda x: pd.to_datetime(x, format='%Y-%m-%d', errors='coerce'),
            lambda x: pd.to_datetime(x, format='%m/%d/%Y', errors='coerce'),
        ],
        'numeric': [
            lambda x: pd.to_numeric(x.astype(str).str.replace(r'[$,]', '', regex=True), errors='coerce'),
            lambda x: pd.to_numeric(x, errors='coerce'),
        ],
        'categorical': [
            lambda x: x.astype('category'),
        ]
    }
    
    original_column = df[column].copy()
    
    for transformer in transformers.get(target_type, []):
        try:
            converted = transformer(df[column])
            success_rate = (converted.notna().sum() / len(converted))
            
            if success_rate >= confidence_threshold:
                return converted, success_rate
        except Exception as e:
            continue
    
    return original_column, 0  # No successful conversion

class SmartDataCleaner:
    def __init__(self, df, user_context=""):
        self.df = df.copy()
        self.original_df = df.copy()
        self.cleaning_report = {}
        self.user_context = user_context
    
    def auto_clean(self):
        """AI-guided adaptive cleaning based on data characteristics"""
        # Get AI recommendations for cleaning strategy
        cleaning_strategy = self.get_ai_cleaning_strategy()
        
        # Apply recommended cleaning steps
        self.apply_ai_recommendations(cleaning_strategy)
        
        return self.df, self.cleaning_report
    
    def get_ai_cleaning_strategy(self):
        """Get AI recommendations for data cleaning"""
        if model is None:
            print("AI model not available, using fallback strategy")
            return self.fallback_strategy()
        
        try:
            # Prepare data context for AI
            data_context = self.prepare_data_context()
            
            prompt = f"""
            You are a data science expert. Analyze this dataset and provide specific cleaning recommendations.

            Dataset Context:
            {data_context}

            User Context: {self.user_context}

            Please provide recommendations in the following JSON format:
            {{
                "missing_data_strategy": {{
                    "column_name": {{
                        "action": "fill_with_mode|fill_with_median|fill_with_mean|drop_column|leave_empty|custom_value",
                        "reasoning": "explanation for this choice",
                        "custom_value": "only if action is custom_value"
                    }}
                }},
                "outlier_strategy": {{
                    "column_name": {{
                        "action": "remove|keep|cap_at_percentile",
                        "reasoning": "explanation",
                        "percentile": "only if capping"
                    }}
                }},
                "type_conversions": {{
                    "column_name": {{
                        "target_type": "datetime|categorical|numeric",
                        "reasoning": "explanation"
                    }}
                }},
                "general_recommendations": ["list of general cleaning suggestions"]
            }}

            Consider the semantic meaning of columns and business logic. For example:
            - Date columns with missing values might indicate ongoing/open cases
            - ID columns should not be filled
            - Status columns might have meaningful empty states
            """
            
            response = model.generate_content(prompt)
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return self.fallback_strategy()
        except Exception as e:
            print(f"AI recommendation failed: {e}")
            return self.fallback_strategy()
    
    def prepare_data_context(self):
        """Prepare dataset context for AI analysis"""
        context = {
            "shape": self.df.shape,
            "columns": {}
        }
        
        for col in self.df.columns:
            try:
                context["columns"][col] = {
                    "type": str(self.df[col].dtype),
                    "missing_count": int(self.df[col].isnull().sum()),
                    "missing_percentage": float(self.df[col].isnull().sum() / len(self.df) * 100),
                    "unique_values": int(self.df[col].nunique()),
                    "sample_values": [str(x) for x in self.df[col].dropna().head(5).tolist()]
                }
            except Exception as e:
                context["columns"][col] = {
                    "type": str(self.df[col].dtype),
                    "error": f"Could not process column: {str(e)}"
                }
        
        return json.dumps(context, indent=2, default=str)
    
    def apply_ai_recommendations(self, strategy):
        """Apply AI-recommended cleaning strategies"""
        # Handle missing data
        for col, action_info in strategy.get("missing_data_strategy", {}).items():
            if col in self.df.columns:
                self.apply_missing_data_strategy(col, action_info)
        
        # Handle outliers
        for col, action_info in strategy.get("outlier_strategy", {}).items():
            if col in self.df.columns:
                self.apply_outlier_strategy(col, action_info)
        
        # Handle type conversions
        for col, conversion_info in strategy.get("type_conversions", {}).items():
            if col in self.df.columns:
                self.apply_type_conversion(col, conversion_info)
        
        # Remove duplicates (always safe)
        self.remove_duplicates()
    
    def apply_missing_data_strategy(self, col, action_info):
        """Apply specific missing data strategy for a column - FIXED pandas warning"""
        action = action_info.get("action", "fill_with_mode")
        missing_before = self.df[col].isnull().sum()
        
        if missing_before == 0:
            return
        
        try:
            if action == "fill_with_mode":
                if not self.df[col].mode().empty:
                    fill_value = self.df[col].mode()[0]
                    # Fix pandas warning - use .loc instead of .fillna(inplace=True)
                    self.df.loc[self.df[col].isnull(), col] = fill_value
                    self.cleaning_report[col] = f"Filled {missing_before} missing values with mode ({fill_value}) - {action_info.get('reasoning', '')}"
        
            elif action == "fill_with_median":
                if self.df[col].dtype in ['int64', 'float64']:
                    fill_value = self.df[col].median()
                    self.df.loc[self.df[col].isnull(), col] = fill_value
                    self.cleaning_report[col] = f"Filled {missing_before} missing values with median ({fill_value:.2f}) - {action_info.get('reasoning', '')}"
        
            elif action == "fill_with_mean":
                if self.df[col].dtype in ['int64', 'float64']:
                    fill_value = self.df[col].mean()
                    self.df.loc[self.df[col].isnull(), col] = fill_value
                    self.cleaning_report[col] = f"Filled {missing_before} missing values with mean ({fill_value:.2f}) - {action_info.get('reasoning', '')}"
        
            elif action == "custom_value":
                custom_value = action_info.get("custom_value", "Unknown")
                self.df.loc[self.df[col].isnull(), col] = custom_value
                self.cleaning_report[col] = f"Filled {missing_before} missing values with '{custom_value}' - {action_info.get('reasoning', '')}"
        
            elif action == "leave_empty":
                self.cleaning_report[col] = f"Left {missing_before} missing values as-is - {action_info.get('reasoning', '')}"
        
            elif action == "drop_column":
                self.df = self.df.drop(columns=[col])
                self.cleaning_report[col] = f"Dropped column due to excessive missing data - {action_info.get('reasoning', '')}"
        
        except Exception as e:
            print(f"Error applying missing data strategy for {col}: {e}")
    
    def apply_outlier_strategy(self, col, action_info):
        """Apply outlier handling strategy"""
        try:
            if self.df[col].dtype not in ['int64', 'float64']:
                return
            
            action = action_info.get("action", "keep")
            
            # Calculate outliers using IQR method
            q1 = self.df[col].quantile(0.25)
            q3 = self.df[col].quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            outliers = ((self.df[col] < lower_bound) | (self.df[col] > upper_bound))
            outlier_count = outliers.sum()
            
            if action == "remove" and outlier_count > 0:
                self.df = self.df[~outliers].reset_index(drop=True)
                self.cleaning_report[f"{col}_outliers"] = f"Removed {outlier_count} outliers - {action_info.get('reasoning', '')}"
            
            elif action == "cap_at_percentile":
                percentile = action_info.get("percentile", 95)
                lower_cap = self.df[col].quantile((100-percentile)/200)
                upper_cap = self.df[col].quantile(percentile/100)
                
                capped_count = ((self.df[col] < lower_cap) | (self.df[col] > upper_cap)).sum()
                self.df[col] = self.df[col].clip(lower=lower_cap, upper=upper_cap)
                self.cleaning_report[f"{col}_capping"] = f"Capped {capped_count} values at {percentile}th percentile - {action_info.get('reasoning', '')}"
        
        except Exception as e:
            print(f"Error applying outlier strategy for {col}: {e}")
    
    def apply_type_conversion(self, col, conversion_info):
        """Apply type conversion"""
        target_type = conversion_info.get("target_type")
        
        try:
            if target_type == "datetime":
                converted = pd.to_datetime(self.df[col], errors='coerce')
                success_rate = converted.notna().sum() / len(converted)
                if success_rate > 0.7:
                    self.df[col] = converted
                    self.cleaning_report[f"{col}_conversion"] = f"Converted to datetime - {conversion_info.get('reasoning', '')}"
            
            elif target_type == "categorical":
                self.df[col] = self.df[col].astype('category')
                self.cleaning_report[f"{col}_conversion"] = f"Converted to categorical - {conversion_info.get('reasoning', '')}"
            
            elif target_type == "numeric":
                converted = pd.to_numeric(self.df[col], errors='coerce')
                success_rate = converted.notna().sum() / len(converted)
                if success_rate > 0.7:
                    self.df[col] = converted
                    self.cleaning_report[f"{col}_conversion"] = f"Converted to numeric - {conversion_info.get('reasoning', '')}"
        
        except Exception as e:
            print(f"Type conversion failed for {col}: {e}")
    
    def fallback_strategy(self):
        """Fallback strategy if AI fails"""
        return {
            "missing_data_strategy": {col: {"action": "fill_with_mode", "reasoning": "Fallback strategy"} 
                                    for col in self.df.columns if self.df[col].isnull().sum() > 0},
            "outlier_strategy": {},
            "type_conversions": {},
            "general_recommendations": ["Applied fallback cleaning strategy"]
        }
    
    def remove_duplicates(self):
        initial_rows = len(self.df)
        self.df = self.df.drop_duplicates().reset_index(drop=True)
        final_rows = len(self.df)
        removed = initial_rows - final_rows
        self.cleaning_report['duplicates'] = f"Removed {removed} duplicate rows"

# Add the missing AI visualization functions
def get_ai_visualization_recommendations(df, user_context=""):
    """Get AI recommendations for which visualizations to create"""
    
    if model is None:
        return get_fallback_visualization_plan(df)
    
    try:
        # Prepare data context
        data_context = prepare_viz_context(df)
        
        prompt = f"""
        You are a data visualization expert. Analyze this dataset and recommend the most insightful visualizations.

        Dataset Context:
        {data_context}

        User Context: {user_context}

        Please provide recommendations in JSON format:
        {{
            "recommended_plots": [
                {{
                    "plot_type": "correlation|distribution|categorical|time_series|comparison|custom",
                    "columns": ["column1", "column2"],
                    "title": "Plot Title",
                    "description": "Why this plot is valuable",
                    "priority": "high|medium|low"
                }}
            ],
            "key_insights_to_explore": ["insight1", "insight2"],
            "suggested_groupings": ["column combinations that might reveal patterns"]
        }}

        Focus on:
        1. Most meaningful relationships and patterns
        2. Business-relevant insights
        3. Data quality issues to highlight
        4. Anomalies worth investigating
        """
        
        response = model.generate_content(prompt)
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return get_fallback_visualization_plan(df)
    except Exception as e:
        print(f"AI visualization recommendation failed: {e}")
        return get_fallback_visualization_plan(df)

def prepare_viz_context(df):
    """Prepare context for visualization recommendations"""
    context = {
        "shape": df.shape,
        "columns": {}
    }
    
    for col in df.columns:
        try:
            context["columns"][col] = {
                "type": str(df[col].dtype),
                "unique_values": int(df[col].nunique()),
                "missing_percentage": float(df[col].isnull().sum() / len(df) * 100),
                "sample_values": [str(x) for x in df[col].dropna().head(3).tolist()]
            }
            
            if df[col].dtype in ['int64', 'float64']:
                context["columns"][col].update({
                    "min": float(df[col].min()),
                    "max": float(df[col].max()),
                    "mean": float(df[col].mean()),
                    "std": float(df[col].std())
                })
        except Exception as e:
            context["columns"][col] = {"type": str(df[col].dtype), "error": str(e)}
    
    return json.dumps(context, indent=2, default=str)

def get_fallback_visualization_plan(df):
    """Fallback visualization plan"""
    return {
        "recommended_plots": [
            {
                "plot_type": "correlation",
                "columns": df.select_dtypes(include=[np.number]).columns.tolist(),
                "title": "Correlation Analysis",
                "description": "Relationships between numerical variables",
                "priority": "high"
            }
        ],
        "key_insights_to_explore": ["Basic data patterns"],
        "suggested_groupings": []
    }

def generate_ai_guided_visualizations(df, cleaned_df, user_context=""):
    """Generate visualizations based on AI recommendations or fallback to comprehensive plots"""
    
    plt.style.use('dark_background')
    sns.set_palette("husl")
    
    plots = {}
    
    # Always include data overview
    plots['data_overview'] = create_data_overview_plot(df, cleaned_df)
    
    try:
        # Get AI recommendations
        viz_recommendations = get_ai_visualization_recommendations(cleaned_df, user_context)
        
        # Generate some AI-recommended plots if available
        for rec in viz_recommendations.get("recommended_plots", []):
            try:
                plot_type = rec.get("plot_type")
                columns = rec.get("columns", [])
                title = rec.get("title", "Analysis")
                
                # Ensure columns exist in dataframe
                valid_columns = [col for col in columns if col in cleaned_df.columns]
                
                if not valid_columns:
                    continue
                
                if plot_type == "correlation" and len(valid_columns) > 1:
                    numeric_cols = [col for col in valid_columns if cleaned_df[col].dtype in ['int64', 'float64']]
                    if len(numeric_cols) > 1:
                        plots['ai_correlation'] = create_correlation_plot(cleaned_df[numeric_cols], title)
            except Exception as e:
                print(f"Error creating AI plot: {e}")
                continue
    
    except Exception as e:
        print(f"AI visualization failed: {e}")
        viz_recommendations = get_fallback_visualization_plan(cleaned_df)
    
    # Always add comprehensive fallback plots (your original good plots)
    try:
        # Missing Data Heatmap
        if df.isnull().sum().sum() > 0:
            plots['missing_data'] = create_missing_data_plot(df)
        
        # Correlation Matrix (for numerical columns)
        numeric_cols = cleaned_df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 1:
            plots['correlation'] = create_correlation_plot(cleaned_df[numeric_cols])
        
        # Distribution plots for numerical columns
        if len(numeric_cols) > 0:
            plots['distributions'] = create_distribution_plots(cleaned_df[numeric_cols])
        
        # Categorical analysis
        categorical_cols = cleaned_df.select_dtypes(include=['object', 'category']).columns
        if len(categorical_cols) > 0:
            plots['categorical'] = create_categorical_plots(cleaned_df[categorical_cols])
            
    except Exception as e:
        print(f"Error creating fallback plots: {e}")
    
    return plots, viz_recommendations

# Enhanced data summary and cleaning functions
def get_data_summary(df):
    """Enhanced data summary with smart profiling"""
    try:
        basic_summary = {
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'data_types': {str(k): str(v) for k, v in df.dtypes.items()},
            'missing_values': {str(k): int(v) for k, v in df.isnull().sum().items()},
            'memory_usage': f"{df.memory_usage(deep=True).sum() / 1024:.2f} KB"
        }
        
        # Add smart profiling
        profile = analyze_dataset_characteristics(df)
        pipeline = build_eda_pipeline(df)
        
        enhanced_summary = {
            **basic_summary,
            'data_characteristics': profile,
            'recommended_pipeline': pipeline
        }
        
        return enhanced_summary
    except Exception as e:
        print(f"Error in get_data_summary: {e}")
        return {
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'error': str(e)
        }

def analyze_dataset_characteristics(df):
    """Profile dataset to understand its characteristics"""
    try:
        profile = {
            'shape': df.shape,
            'has_numerical': len(df.select_dtypes(include=[np.number]).columns) > 0,
            'has_categorical': len(df.select_dtypes(include=['object', 'category']).columns) > 0,
            'has_datetime': len(df.select_dtypes(include=['datetime64']).columns) > 0,
            'missing_data_pct': float((df.isnull().sum().sum() / (df.shape[0] * df.shape[1])) * 100),
            'duplicate_rows': int(df.duplicated().sum()),
            'column_types': {str(k): str(v) for k, v in df.dtypes.items()}
        }
        return profile
    except Exception as e:
        print(f"Error in analyze_dataset_characteristics: {e}")
        return {'error': str(e)}

def build_eda_pipeline(df, user_description=""):
    """Build adaptive EDA pipeline based on data characteristics"""
    try:
        profile = analyze_dataset_characteristics(df)
        
        pipeline = {
            'cleaning_steps': ['remove_duplicates', 'handle_missing_values', 'outlier_detection'],
            'analysis_steps': ['basic_info', 'missing_data_analysis', 'correlation_analysis', 'distribution_plots'],
            'warnings': [],
            'data_profile': profile
        }
        
        if profile.get('missing_data_pct', 0) > 50:
            pipeline['warnings'].append("High percentage of missing data - data quality may be poor")
        
        return pipeline
    except Exception as e:
        print(f"Error in build_eda_pipeline: {e}")
        return {'error': str(e)}

def smart_data_cleaning(df, user_context=""):
    """Main function that uses AI-guided SmartDataCleaner with fallback"""
    try:
        cleaner = SmartDataCleaner(df, user_context)
        cleaned_df, report = cleaner.auto_clean()
        return cleaned_df, report
    except Exception as e:
        print(f"Smart cleaning failed, using basic cleaning: {e}")
        return basic_data_cleaning(df)

def basic_data_cleaning(df):
    """Basic cleaning logic as fallback - FIXED pandas warnings"""
    try:
        cleaned_df = df.copy()
        cleaning_report = {}
        
        # Remove duplicates
        initial_rows = len(cleaned_df)
        cleaned_df = cleaned_df.drop_duplicates().reset_index(drop=True)
        duplicates_removed = initial_rows - len(cleaned_df)
        cleaning_report['duplicates'] = f"Removed {duplicates_removed} duplicate rows"
        
        # Handle missing values intelligently
        for col in cleaned_df.columns:
            missing_count = cleaned_df[col].isnull().sum()
            if missing_count > 0:
                try:
                    if cleaned_df[col].dtype in ['int64', 'float64']:
                        # Use median for numerical data
                        fill_value = cleaned_df[col].median()
                        # Fix pandas warning - use .loc instead of .fillna(inplace=True)
                        cleaned_df.loc[cleaned_df[col].isnull(), col] = fill_value
                        cleaning_report[col] = f"Filled {missing_count} missing values with median ({fill_value:.2f})"
                    else:
                        # Use mode for categorical data
                        if not cleaned_df[col].mode().empty:
                            fill_value = cleaned_df[col].mode()[0]
                            cleaned_df.loc[cleaned_df[col].isnull(), col] = fill_value
                            cleaning_report[col] = f"Filled {missing_count} missing values with mode ({fill_value})"
                except Exception as e:
                    print(f"Error handling missing values in {col}: {e}")
        
        # Handle outliers for numerical columns
        numeric_cols = cleaned_df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            try:
                q1 = cleaned_df[col].quantile(0.25)
                q3 = cleaned_df[col].quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                outliers = ((cleaned_df[col] < lower_bound) | (cleaned_df[col] > upper_bound))
                outlier_count = outliers.sum()
                
                # Only remove if outliers are less than 5% of data
                if outlier_count > 0 and outlier_count / len(cleaned_df) < 0.05:
                    cleaned_df = cleaned_df[~outliers].reset_index(drop=True)
                    cleaning_report[f"{col}_outliers"] = f"Removed {outlier_count} outliers"
            except Exception as e:
                print(f"Error handling outliers in {col}: {e}")
        
        return cleaned_df, cleaning_report
    
    except Exception as e:
        print(f"Basic cleaning failed: {e}")
        return df, {'error': f'Cleaning failed: {str(e)}'}

# Your original good visualization functions
def create_data_overview_plot(original_df, cleaned_df):
    """Compare original vs cleaned data"""
    try:
        fig, axes = plt.subplots(2, 2, figsize=(12, 8))
        fig.suptitle('Data Cleaning Overview', fontsize=16, color='white')
        
        # Shape comparison
        shapes = ['Original', 'Cleaned']
        rows = [original_df.shape[0], cleaned_df.shape[0]]
        cols = [original_df.shape[1], cleaned_df.shape[1]]
        
        axes[0,0].bar(shapes, rows, color=['#ff6b6b', '#4ecdc4'])
        axes[0,0].set_title('Rows Count')
        axes[0,0].set_ylabel('Number of Rows')
        
        axes[0,1].bar(shapes, cols, color=['#ff6b6b', '#4ecdc4'])
        axes[0,1].set_title('Columns Count')
        axes[0,1].set_ylabel('Number of Columns')
        
        # Missing values comparison
        original_missing = original_df.isnull().sum().sum()
        cleaned_missing = cleaned_df.isnull().sum().sum()
        
        axes[1,0].bar(shapes, [original_missing, cleaned_missing], color=['#ff6b6b', '#4ecdc4'])
        axes[1,0].set_title('Missing Values')
        axes[1,0].set_ylabel('Count')
        
        # Data types distribution
        original_types = original_df.dtypes.value_counts()
        cleaned_types = cleaned_df.dtypes.value_counts()
        
        all_types = set(original_types.index) | set(cleaned_types.index)
        type_names = [str(t) for t in all_types]
        original_counts = [original_types.get(t, 0) for t in all_types]
        cleaned_counts = [cleaned_types.get(t, 0) for t in all_types]
        
        x = np.arange(len(type_names))
        width = 0.35
        
        axes[1,1].bar(x - width/2, original_counts, width, label='Original', color='#ff6b6b')
        axes[1,1].bar(x + width/2, cleaned_counts, width, label='Cleaned', color='#4ecdc4')
        axes[1,1].set_title('Data Types Distribution')
        axes[1,1].set_xticks(x)
        axes[1,1].set_xticklabels(type_names, rotation=45)
        axes[1,1].legend()
        
        plt.tight_layout()
        return plot_to_base64(fig)
    except Exception as e:
        print(f"Error creating data overview plot: {e}")
        return ""

def create_missing_data_plot(df):
    """Create missing data heatmap"""
    try:
        fig, ax = plt.subplots(figsize=(10, 6))
        
        missing_data = df.isnull()
        sns.heatmap(missing_data, cbar=True, cmap='viridis', ax=ax)
        ax.set_title('Missing Data Pattern', fontsize=14, color='white')
        
        plt.tight_layout()
        return plot_to_base64(fig)
    except Exception as e:
        print(f"Error creating missing data plot: {e}")
        return ""

def create_correlation_plot(df_numeric, title="Correlation Matrix"):
    """Create correlation matrix heatmap"""
    try:
        fig, ax = plt.subplots(figsize=(10, 8))
        
        correlation = df_numeric.corr()
        mask = np.triu(np.ones_like(correlation, dtype=bool))
        
        sns.heatmap(correlation, mask=mask, annot=True, cmap='coolwarm', 
                    center=0, square=True, ax=ax)
        ax.set_title(title, fontsize=14, color='white')
        
        plt.tight_layout()
        return plot_to_base64(fig)
    except Exception as e:
        print(f"Error creating correlation plot: {e}")
        return ""

def create_distribution_plots(df_numeric):
    """Create distribution plots for numerical columns"""
    try:
        n_cols = min(3, len(df_numeric.columns))
        n_rows = (len(df_numeric.columns) + n_cols - 1) // n_cols
        
        fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5*n_rows))
        if n_rows == 1:
            axes = [axes] if n_cols == 1 else axes
        else:
            axes = axes.flatten()
        
        for i, col in enumerate(df_numeric.columns):
            if i < len(axes):
                sns.histplot(df_numeric[col].dropna(), kde=True, ax=axes[i])
                axes[i].set_title(f'Distribution of {col}', color='white')
        
        # Hide empty subplots
        for i in range(len(df_numeric.columns), len(axes)):
            axes[i].set_visible(False)
        
        plt.tight_layout()
        return plot_to_base64(fig)
    except Exception as e:
        print(f"Error creating distribution plots: {e}")
        return ""

def create_categorical_plots(df_categorical):
    """Create plots for categorical columns"""
    try:
        n_cols = min(2, len(df_categorical.columns))
        n_rows = (len(df_categorical.columns) + n_cols - 1) // n_cols
        
        fig, axes = plt.subplots(n_rows, n_cols, figsize=(12, 5*n_rows))
        if n_rows == 1:
            axes = [axes] if n_cols == 1 else axes
        else:
            axes = axes.flatten()
        
        for i, col in enumerate(df_categorical.columns):
            if i < len(axes):
                top_categories = df_categorical[col].value_counts().head(10)
                sns.barplot(x=top_categories.values, y=top_categories.index, ax=axes[i])
                axes[i].set_title(f'Top Categories in {col}', color='white')
        
        # Hide empty subplots
        for i in range(len(df_categorical.columns), len(axes)):
            axes[i].set_visible(False)
        
        plt.tight_layout()
        return plot_to_base64(fig)
    except Exception as e:
        print(f"Error creating categorical plots: {e}")
        return ""

def plot_to_base64(fig):
    """Convert matplotlib figure to base64 string"""
    try:
        buffer = BytesIO()
        fig.savefig(buffer, format='png', bbox_inches='tight', 
                    facecolor='#1a1a1a', edgecolor='none', dpi=100)
        buffer.seek(0)
        plot_data = buffer.getvalue()
        buffer.close()
        plt.close(fig)
        
        return base64.b64encode(plot_data).decode('utf-8')
    except Exception as e:
        print(f"Error converting plot to base64: {e}")
        plt.close(fig)
        return ""

def perform_eda_with_visualizations(df, user_context=""):
    """Main EDA function that includes AI-guided analysis with robust fallbacks"""
    
    try:
        # Clean the data with AI guidance (falls back to basic cleaning if AI fails)
        cleaned_df, cleaning_report = smart_data_cleaning(df, user_context)
        
        # Generate visualizations (AI-guided with comprehensive fallback)
        plots, viz_recommendations = generate_ai_guided_visualizations(df, cleaned_df, user_context)
        
        # Get summary
        summary = get_data_summary(cleaned_df)
        
        return {
            'cleaned_data': cleaned_df,
            'cleaning_report': cleaning_report,
            'summary': summary,
            'visualizations': plots,
            'ai_recommendations': viz_recommendations
        }
    
    except Exception as e:
        print(f"EDA failed completely, using emergency fallback: {e}")
        return emergency_fallback_eda(df)

def emergency_fallback_eda(df):
    """Last resort EDA if everything fails"""
    try:
        cleaned_df, cleaning_report = basic_data_cleaning(df)
        
        plots = {}
        plots['data_overview'] = create_data_overview_plot(df, cleaned_df)
        
        summary = {
            'shape': cleaned_df.shape,
            'columns': cleaned_df.columns.tolist(),
            'data_types': {str(k): str(v) for k, v in cleaned_df.dtypes.items()},
            'missing_values': {str(k): int(v) for k, v in cleaned_df.isnull().sum().items()},
            'memory_usage': f"{cleaned_df.memory_usage(deep=True).sum() / 1024:.2f} KB"
        }
        
        return {
            'cleaned_data': cleaned_df,
            'cleaning_report': cleaning_report,
            'summary': summary,
            'visualizations': plots,
            'ai_recommendations': {
                'recommended_plots': [],
                'key_insights_to_explore': ['Emergency fallback analysis completed'],
                'suggested_groupings': []
            }
        }
    except Exception as e:
        print(f"Emergency fallback failed: {e}")
        return {
            'cleaned_data': df,
            'cleaning_report': {'error': f'All analysis methods failed: {str(e)}'},
            'summary': {'error': 'Summary generation failed'},
            'visualizations': {},
            'ai_recommendations': {
                'recommended_plots': [],
                'key_insights_to_explore': ['Analysis failed'],
                'suggested_groupings': []
            }
        }