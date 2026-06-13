import os
import shutil
import sys

# Define Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.join(BASE_DIR, '..') # Root of Thesis 1
PROD_DIR = BASE_DIR
DATA_DIR = os.path.join(PROD_DIR, 'data')
ARTIFACTS_DIR = os.path.join(PROD_DIR, 'model_artifacts')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

def copy_data_files():
    """Copies necessary Excel files to Production_Backend/data"""
    files_to_copy = [
        'ML_Planning/Store_Cluster.xlsx',
        'ML_Planning/HS_data.xlsx',
        'ML_Planning/AS_data.xlsx',
        'ML_Planning/SS_data.xlsx',
        'ML_Planning/WS_data.xlsx'
    ]
    
    print("Copying data files...")
    for file in files_to_copy:
        src = os.path.join(SOURCE_DIR, file)
        
        # Handle files in subfolders (e.g. ML_Planning/HS_data.xlsx)
        filename = os.path.basename(file)
        dst = os.path.join(DATA_DIR, filename)
        
        try:
            if os.path.exists(src):
                shutil.copy2(src, dst)
                print(f"✅ Copied {filename}")
            else:
                print(f"❌ Warning: Source file not found: {src}")
        except PermissionError:
            print(f"⚠️ Warning: Could not copy {filename}. The file is currently open in another program (e.g., Excel). Please close it and try again.")
        except Exception as e:
            print(f"❌ Error copying {filename}: {str(e)}")

def train_and_save_model():
    """Trains the model and saves it to disk."""
    print("\nInitializing Forecast Agent...")
    from ml_forecast_agent import DemandForecastAgent
    
    # Point agent to the copied data files in ./data
    data_files = [
        'data/HS_data.xlsx', 'data/AS_data.xlsx', 
        'data/SS_data.xlsx', 'data/WS_data.xlsx'
    ]
    
    agent = DemandForecastAgent(data_files=data_files)
    
    print("Starting Training (this may take a minute)...")
    agent.train()
    
    # Save Model
    model_path = os.path.join(ARTIFACTS_DIR, 'rf_model.pkl')
    agent.save_model(model_path)
    print(f"✅ Model saved to {model_path}")

if __name__ == "__main__":
    copy_data_files()
    train_and_save_model()
