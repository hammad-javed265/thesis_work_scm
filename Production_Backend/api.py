from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import shutil
import os
import io
import uvicorn
from contextlib import asynccontextmanager

# Import Agents
from ml_forecast_agent import DemandForecastAgent
from ml_optimizer_agent import DistributionOptimizerAgent
from cluster_manager import ClusterManager

# Global Agents
forecast_agent = None
optimizer = None

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model_artifacts', 'rf_model.pkl')

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load Model on Startup
    global forecast_agent, optimizer
    print("Loading ML Model...")
    
    if os.path.exists(MODEL_PATH):
        forecast_agent = DemandForecastAgent()
        forecast_agent.load_model(MODEL_PATH)
        print("✅ Forecast Model Loaded.")
    else:
        print("❌ Model file not found! Please run production_setup.py first.")
        
    cm = ClusterManager()
    optimizer = DistributionOptimizerAgent(cm)
    print("✅ Optimizer Agent Ready.")
    
    yield
    
    # Cleanup (if needed) on shutdown
    print("Shutting down API...")

app = FastAPI(title="ML Assortment Planner API", lifespan=lifespan)

# Theme to Category Mapping
THEME_TO_CATEGORY = {
    'Casual': '03 Casual',
    'Party Wear': '01 Fancy',
    'Fancy': '01 Fancy',
    'Formal': '02 Formal',
    'Winter': '04 Winter',
    'Athleisure': '06 Athleisure',
    'Ethnic': '05 Ethnic',
    'PU': '14 PU'
}

@app.get("/health")
async def health_check():
    return {"status": "active", "model_loaded": forecast_agent is not None}

@app.post("/generate_plan")
async def generate_plan(file: UploadFile = File(...)):
    if not forecast_agent:
        raise HTTPException(status_code=500, detail="Model not loaded.")
        
    try:
        # Read Excel File
        contents = await file.read()
        df_plan = pd.read_excel(io.BytesIO(contents))
        
        results = []
        
        for _, row in df_plan.iterrows():
            # Extract Info
            article = str(row['Article']).strip()
            color = str(row['Color']).strip()
            price = row.get('Price', 'Unknown')
            raw_ip = row.get('IP', 0)
            theme = row.get('Theme', 'Casual')
            
            if pd.isna(article) or article == 'nan':
                continue
                
            try:
                ip_qty = float(str(raw_ip).replace(',', '').strip())
            except:
                ip_qty = 0
                
            if ip_qty <= 0:
                continue
                
            # Map Theme -> Category
            category = THEME_TO_CATEGORY.get(theme, '03 Casual')
            
            # 1. Predict Demand
            plan_item = pd.DataFrame([{
                'Article': article, 
                'Color': color, 
                'Category': category, 
                'Price': price
            }])
            
            demand_preds = forecast_agent.predict_demand(plan_item)
            
            # 2. Optimize Distribution
            allocations, remaining = optimizer.optimize_distribution(
                demand_preds, 
                total_ip_pairs=ip_qty, 
                pack_size=12, 
                product_price=price
            )
            
            # 3. Format Result
            res_row = {
                'Article': article,
                'Color': color,
                'Theme': theme,
                'Price': price,
                'Total_Pairs': ip_qty,
                'Remaining_Packs': remaining,
                'Allocations': allocations
            }
            results.append(res_row)
            
        return JSONResponse(content={"plan": results})
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
