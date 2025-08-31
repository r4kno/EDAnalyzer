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

# Configure Gemini API
model = None
ai_available = False

try:
    api_key = os.getenv('GEMINI_API_KEY')
    if api_key:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        # Test the model
        test_response = model.generate_content("Test")
        ai_available = True
except Exception as e:
    model = None
    ai_available = False
    
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

class SmartDataCleaner:
    def __init__(self, df, user_context=""):
        self.df = df.copy()
        self.original_df = df.copy()
        self.cleaning_report = {}
        self.user_context = user_context
        self.ai_used = False
    
    def auto_clean(self):
        """AI-guided adaptive cleaning based on data characteristics"""
        cleaning_strategy = self.get_ai_cleaning_strategy()
        self.apply_ai_recommendations(cleaning_strategy)
        return self.df, self.cleaning_report, self.ai_used
    
    def get_ai_cleaning_strategy(self):
        """Get AI recommendations for data cleaning"""
        if model is None:
            self.ai_used = False
            return self.fallback_strategy()
        
        try:
            context = self.prepare_data_context()
            
            prompt = f"""
            Analyze this dataset and provide cleaning recommendations as valid JSON:
            
            Dataset Context:
            {context}
            
            User Context: {self.user_context}
            
            Return ONLY a JSON object with this structure:
            {{
                "missing_data_strategy": {{"column_name": {{"action": "fill_with_median", "reasoning": "explanation"}}}},
                "outlier_strategy": {{"column_name": {{"action": "remove", "reasoning": "explanation"}}}},
                "type_conversions": {{"column_name": {{"target_type": "datetime", "reasoning": "explanation"}}}},
                "general_recommendations": ["recommendation1", "recommendation2"]
            }}
            
            Available actions for missing data: fill_with_median, fill_with_mean, fill_with_mode, custom_value, leave_empty, drop_column
            Available actions for outliers: remove, cap_at_percentile, keep
            Available target types: datetime, categorical, numeric
            """
            
            response = model.generate_content(prompt)
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                strategy = json.loads(json_match.group())
                self.ai_used = True
                return strategy
            else:
                self.ai_used = False
                return self.fallback_strategy()
                
        except Exception as e:
            print(f"AI recommendation failed: {e}")
            self.ai_used = False
            return self.fallback_strategy()
    
    def prepare_data_context(self):
        """Prepare comprehensive data context for AI analysis"""
        context = {
            "shape": self.df.shape,
            "columns": {},
            "sample_data": self.df.head(3).to_dict('records')
        }
        
        for col in self.df.columns:
            col_info = {
                "dtype": str(self.df[col].dtype),
                "null_count": int(self.df[col].isnull().sum()),
                "null_percentage": float(self.df[col].isnull().sum() / len(self.df) * 100),
                "unique_count": int(self.df[col].nunique()),
                "sample_values": [str(x) for x in self.df[col].dropna().head(5).tolist()]
            }
            
            # Add summary stats for numeric columns
            if pd.api.types.is_numeric_dtype(self.df[col]):
                col_info.update({
                    "mean": float(self.df[col].mean()) if not self.df[col].isnull().all() else None,
                    "std": float(self.df[col].std()) if not self.df[col].isnull().all() else None,
                    "min": float(self.df[col].min()) if not self.df[col].isnull().all() else None,
                    "max": float(self.df[col].max()) if not self.df[col].isnull().all() else None,
                    "q25": float(self.df[col].quantile(0.25)) if not self.df[col].isnull().all() else None,
                    "q75": float(self.df[col].quantile(0.75)) if not self.df[col].isnull().all() else None
                })
            
            context["columns"][col] = col_info
        
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
        """Apply specific missing data strategy for a column"""
        action = action_info.get("action", "fill_with_mode")
        missing_before = self.df[col].isnull().sum()
        
        if missing_before == 0:
            return
        
        try:
            if action == "fill_with_mode":
                if not self.df[col].mode().empty:
                    fill_value = self.df[col].mode()[0]
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

def get_ai_visualization_recommendations(df, user_context=""):
    """Get AI recommendations for which visualizations to create"""
    if model is None:
        return get_fallback_visualization_plan(df)
    
    try:
        context = prepare_viz_context(df)
        
        prompt = f"""
        Analyze this dataset and recommend the most insightful visualizations as valid JSON:
        
        Dataset: {context}
        if user context talks about any plot or relation between variables, include that plot for sure. Focus on user context and prioritize it
        User Context: {user_context}
        
        Return ONLY a JSON object with this structure:
        {{
            "recommended_plots": [
                {{
                    "plot_type": "correlation|distribution|scatter|box|bar|line|heatmap",
                    "columns": ["col1", "col2"],
                    "title": "Plot Title",
                    "description": "Why this plot is useful for this specific dataset",
                    "priority": "high|medium|low"
                }}
            ],
            "key_insights_to_explore": ["insight1", "insight2"],
            "suggested_groupings": [["col1", "col2"]]
        }}
        
        Focus on the most relevant visualizations for this specific dataset and user context.
        """
        
        response = model.generate_content(prompt)
        
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if json_match:
            recommendations = json.loads(json_match.group())
            return recommendations
        else:
            return get_fallback_visualization_plan(df)
            
    except Exception as e:
        print(f"AI visualization recommendations failed: {e}")
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
        "key_insights_to_explore": ["Basic data patterns", "Distribution analysis", "Correlation insights"],
        "suggested_groupings": []
    }

def generate_ai_guided_visualizations(df, cleaned_df, user_context=""):
    """Generate visualizations based on AI recommendations with comprehensive fallback"""
    
    plt.style.use('dark_background')
    sns.set_palette("husl")
    
    plots = {}
    ai_viz_used = False
    
    # Always include data overview
    plots['data_overview'] = create_data_overview_plot(df, cleaned_df)
    
    try:
        # Get AI recommendations
        viz_recommendations = get_ai_visualization_recommendations(cleaned_df, user_context)
        
        # Check if AI was actually used
        if model is not None and viz_recommendations.get("recommended_plots"):
            ai_viz_used = True
    
    except Exception as e:
        print(f"AI visualization failed: {e}")
        viz_recommendations = get_fallback_visualization_plan(cleaned_df)
        ai_viz_used = False
    
    # Always add comprehensive plots
    try:
        # Missing Data Heatmap
        if df.isnull().sum().sum() > 0:
            plots['missing_data'] = create_missing_data_plot(df)
        
        # Correlation Matrix
        numeric_cols = cleaned_df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 1:
            plots['correlation'] = create_correlation_plot(cleaned_df[numeric_cols])
        
        # Distribution plots
        if len(numeric_cols) > 0:
            plots['distributions'] = create_distribution_plots(cleaned_df[numeric_cols])
        
        # Categorical analysis
        categorical_cols = cleaned_df.select_dtypes(include=['object', 'category']).columns
        if len(categorical_cols) > 0:
            plots['categorical'] = create_categorical_plots(cleaned_df[categorical_cols])
            
    except Exception as e:
        print(f"Error creating plots: {e}")
    
    return plots, viz_recommendations, ai_viz_used

def smart_data_cleaning(df, user_context=""):
    """Main function that uses AI-guided SmartDataCleaner with fallback"""
    try:
        cleaner = SmartDataCleaner(df, user_context)
        cleaned_df, report, ai_used = cleaner.auto_clean()
        return cleaned_df, report, ai_used
    except Exception as e:
        print(f"Smart cleaning failed, using basic cleaning: {e}")
        cleaned_df, report = basic_data_cleaning(df)
        return cleaned_df, report, False

def basic_data_cleaning(df):
    """Basic cleaning logic as fallback"""
    try:
        cleaned_df = df.copy()
        cleaning_report = {}
        
        # Remove duplicates
        initial_rows = len(cleaned_df)
        cleaned_df = cleaned_df.drop_duplicates().reset_index(drop=True)
        duplicates_removed = initial_rows - len(cleaned_df)
        cleaning_report['duplicates'] = f"Removed {duplicates_removed} duplicate rows"
        
        # Handle missing values
        for col in cleaned_df.columns:
            missing_count = cleaned_df[col].isnull().sum()
            if missing_count > 0:
                try:
                    if cleaned_df[col].dtype in ['int64', 'float64']:
                        fill_value = cleaned_df[col].median()
                        cleaned_df.loc[cleaned_df[col].isnull(), col] = fill_value
                        cleaning_report[col] = f"Filled {missing_count} missing values with median ({fill_value:.2f})"
                    else:
                        if not cleaned_df[col].mode().empty:
                            fill_value = cleaned_df[col].mode()[0]
                            cleaned_df.loc[cleaned_df[col].isnull(), col] = fill_value
                            cleaning_report[col] = f"Filled {missing_count} missing values with mode ({fill_value})"
                except Exception as e:
                    print(f"Error handling missing values in {col}: {e}")
        
        return cleaned_df, cleaning_report
    
    except Exception as e:
        print(f"Basic cleaning failed: {e}")
        return df, {'error': f'Cleaning failed: {str(e)}'}

def get_data_summary(df):
    """Enhanced data summary"""
    try:
        return {
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'data_types': {str(k): str(v) for k, v in df.dtypes.items()},
            'missing_values': {str(k): int(v) for k, v in df.isnull().sum().items()},
            'memory_usage': f"{df.memory_usage(deep=True).sum() / 1024:.2f} KB"
        }
    except Exception as e:
        return {
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'error': str(e)
        }

def perform_eda_with_visualizations(df, user_context=""):
    """Main EDA function"""
    try:
        # Step 1: Data Cleaning
        cleaned_df, cleaning_report, ai_cleaning_used = smart_data_cleaning(df, user_context)
        
        # Step 2: Visualization Generation
        plots, viz_recommendations, ai_viz_used = generate_ai_guided_visualizations(df, cleaned_df, user_context)
        
        # Step 3: Summary Generation
        summary = get_data_summary(cleaned_df)
        
        ai_analysis_used = ai_cleaning_used or ai_viz_used
        
        return {
            'cleaned_data': cleaned_df,
            'cleaning_report': cleaning_report,
            'summary': summary,
            'visualizations': plots,
            'ai_recommendations': viz_recommendations,
            'ai_used': ai_analysis_used,
            'ai_details': {
                'cleaning_ai_used': ai_cleaning_used,
                'visualization_ai_used': ai_viz_used
            }
        }
    
    except Exception as e:
        print(f"Main EDA process failed: {e}")
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
            },
            'ai_used': False,
            'ai_details': {
                'cleaning_ai_used': False,
                'visualization_ai_used': False
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
            },
            'ai_used': False,
            'ai_details': {
                'cleaning_ai_used': False,
                'visualization_ai_used': False
            }
        }

# Visualization Functions
def create_data_overview_plot(original_df, cleaned_df):
    """Compare original vs cleaned data"""
    try:
        fig, axes = plt.subplots(2, 2, figsize=(12, 8))
        fig.suptitle('Data Cleaning Overview', fontsize=16, color='white')
        
        shapes = ['Original', 'Cleaned']
        rows = [original_df.shape[0], cleaned_df.shape[0]]
        cols = [original_df.shape[1], cleaned_df.shape[1]]
        
        axes[0,0].bar(shapes, rows, color=['#ff6b6b', '#4ecdc4'])
        axes[0,0].set_title('Rows Count')
        axes[0,0].set_ylabel('Number of Rows')
        
        axes[0,1].bar(shapes, cols, color=['#ff6b6b', '#4ecdc4'])
        axes[0,1].set_title('Columns Count')
        axes[0,1].set_ylabel('Number of Columns')
        
        original_missing = original_df.isnull().sum().sum()
        cleaned_missing = cleaned_df.isnull().sum().sum()
        
        axes[1,0].bar(shapes, [original_missing, cleaned_missing], color=['#ff6b6b', '#4ecdc4'])
        axes[1,0].set_title('Missing Values')
        axes[1,0].set_ylabel('Count')
        
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