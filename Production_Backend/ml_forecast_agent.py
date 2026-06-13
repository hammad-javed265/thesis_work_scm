import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import sys
import os
import joblib  # Using joblib for model serialization

# Add parent directory to path to import sales_aggregator and cluster_manager
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
# from sales_aggregator import SalesAggregator # Aggregator not used directly in this new version
from cluster_manager import ClusterManager

class DemandForecastAgent:
    """
    Uses Random Forest to predict demand (Net Sale Qty) based on product attributes.
    Ref: Walkthrough - Prediction Layer (DFA)
    """
    def __init__(self, data_files=None):
        # Default to the 4 seasonal files if not provided
        self.data_files = data_files if data_files else [
            'HS_data.xlsx', 'AS_data.xlsx', 'SS_data.xlsx', 'WS_data.xlsx'
        ]
        # Enhanced model with more trees for better accuracy
        self.model = RandomForestRegressor(
            n_estimators=200,  # Increased from 100
            max_depth=30,      # Limit depth to prevent overfitting
            min_samples_split=5,  # Require more samples to split
            random_state=42,
            n_jobs=-1  # Use all CPU cores
        )
        self.encoders = {}
        # Enhanced Feature Set with interaction features
        self.feature_cols = [
            'Cluster', 'Category', 'Color', 'Price_Range', 'Season',
            'Cluster_Price', 'Category_Season', 'Cluster_AvgDemand'
        ]
        self.cm = ClusterManager()
        self.historical_avg = {}  # Store historical averages

    def save_model(self, filepath):
        """Saves the trained model and artifacts to disk."""
        artifacts = {
            'model': self.model,
            'encoders': self.encoders,
            'historical_avg': self.historical_avg,
            'feature_cols': self.feature_cols
        }
        joblib.dump(artifacts, filepath)
        print(f"Model artifacts saved to {filepath}")

    def load_model(self, filepath):
        """Loads a trained model and artifacts from disk."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")
            
        artifacts = joblib.load(filepath)
        self.model = artifacts['model']
        self.encoders = artifacts['encoders']
        self.historical_avg = artifacts['historical_avg']
        # self.feature_cols should remain same as class def
        print(f"Model loaded from {filepath}")

        
    @staticmethod
    def get_price_range(price):
        """Maps price to granular bracket ranges."""
        try:
            p = float(price)
            if p < 1500: return '<1500'
            elif p < 2000: return '1500-1999'
            elif p < 2500: return '2000-2499'
            elif p < 3000: return '2500-2999'
            elif p < 3500: return '3000-3499'
            elif p < 4000: return '3500-3999'
            elif p < 4500: return '4000-4499'
            elif p < 5000: return '4500-4999'
            elif p < 5500: return '5000-5499'
            elif p < 7500: return '5500-7499'
            elif p < 9500: return '7500-9499'
            elif p < 11500: return '9500-11499'
            else: return '11500+'
        except:
            return 'Unknown'

    def prepare_data(self):
        """Prepares training data from historical seasonal files."""
        print("Loading and preparing training data from seasonal files...")
        
        all_data = []
        for file in self.data_files:
            file_path = os.path.join(os.path.dirname(__file__), file)
            if not os.path.exists(file_path):
                print(f"Warning: Data file not found: {file_path}")
                continue
                
            print(f"Loading {file}...")
            df_season = pd.read_excel(file_path)
            all_data.append(df_season)
            
        if not all_data:
            raise FileNotFoundError("No training data files found!")
            
        df = pd.concat(all_data, ignore_index=True)
        print(f"Total rows loaded: {len(df)}")
        
        # 1. Filter out Online Stores (WarehouseID W109504, W109501)
        # Note: StoreName might be NaN for these, so filtering by WarehouseID is safer
        df = df[~df['WarehouseID'].isin(['W109504', 'W109501'])]
        # print(f"Rows after WarehousID filtering: {len(df)}")
        
        # 2. Map StoreName/ID to Cluster
        # Optimization: Map unique IDs first (more reliable)
        # Ensure WarehouseID is clean
        df = df.dropna(subset=['WarehouseID'])
        print(f"Rows with valid WarehouseID: {len(df)}")
        
        unique_ids = df['WarehouseID'].unique()
        id_cluster_map = {wid: self.cm.get_cluster_by_id(wid) for wid in unique_ids}
        
        # Apply ID mapping
        df['Cluster'] = df['WarehouseID'].map(id_cluster_map)
        
        # Fallback to StoreName for any remaining 'Unknown' or None (if any)
        # (Though we filtered online stores, so IDs should be good)
        
        # Explicit fillna with 'Unknown' if None
        df['Cluster'] = df['Cluster'].fillna('Unknown')
        
        unknown_clusters = df[df['Cluster'] == 'Unknown']
        if len(unknown_clusters) > 0:
            print(f"Warning: {len(unknown_clusters)} rows have Unknown cluster (ID match failed).")
            # Try StoreName mapping for these?
            # For now, let's just drop them to be safe and avoid data noise
            
        df = df[df['Cluster'] != 'Unknown']
        print(f"Rows after Cluster mapping: {len(df)}")
        
        # 3. Feature Engineering & Renaming to Standard Format
        # User columns: itemid, color, category, season, product_price, total_qty
        
        df['Category'] = df['category']
        df['Color'] = df['color']
        df['Season'] = df['season']
        
        # Create Price Range from product_price
        df['Price_Range'] = df['product_price'].apply(self.get_price_range)
        
        # Target: total_qty (which is Net Sales Qty)
        # Group by Features + Cluster to get total demand for that combo
        group_cols = ['Cluster', 'Category', 'Color', 'Price_Range', 'Season']
        
        print("Aggregating demand...")
        training_data = df.groupby(group_cols)['total_qty'].sum().reset_index()
        training_data.rename(columns={'total_qty': 'Net Sale Qty'}, inplace=True)
        
        # ==== ENHANCED FEATURE ENGINEERING ====
        print("Creating interaction features...")
        
        # Interaction Feature 1: Cluster_Price (cluster buying power × price sensitivity)
        training_data['Cluster_Price'] = training_data['Cluster'].astype(str) + '_' + training_data['Price_Range'].astype(str)
        
        # Interaction Feature 2: Category_Season (seasonal category trends)
        training_data['Category_Season'] = training_data['Category'].astype(str) + '_' + training_data['Season'].astype(str)
        
        # Historical Average Feature: Average demand by Cluster
        cluster_avg = training_data.groupby('Cluster')['Net Sale Qty'].mean().to_dict()
        training_data['Cluster_AvgDemand'] = training_data['Cluster'].map(cluster_avg)
        self.historical_avg['cluster'] = cluster_avg  # Store for prediction
        
        # Encode Categorical Features (including new interaction features)
        for col in self.feature_cols:
            if col == 'Cluster_AvgDemand':
                # Skip encoding for numerical feature
                continue
            le = LabelEncoder()
            training_data[col] = training_data[col].astype(str)
            training_data[col] = le.fit_transform(training_data[col])
            self.encoders[col] = le
            
        X = training_data[self.feature_cols]
        y = training_data['Net Sale Qty']
        
        print(f"Enhanced feature set shape: {X.shape}")
        return X, y

    def train(self):
        """Trains the Random Forest Model."""
        X, y = self.prepare_data()
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        print("Training Random Forest Model...")
        self.model.fit(X_train, y_train)
        
        score = self.model.score(X_test, y_test)
        print(f"Model Trained. R^2 Score on Test Data: {score:.4f}")
        
    def predict_demand(self, plan_data):
        """
        Predicts demand for new plan items using enhanced feature set.
        plan_data: DataFrame with columns ['Article', 'Color', 'Category', 'Price' OR 'Price_Range']
        """
        # We need to predict for EACH cluster for each article
        predictions = []
        
        # Optimize: Vectorized Prediction for all clusters at once
        
        clusters = self.cm.get_all_clusters()
        if not clusters:
            return pd.DataFrame()
            
        all_features = []
        metadata = [] # To map back to (Article, Color, Cluster)
        
        for _, row in plan_data.iterrows():
            article = row['Article']
            color = row['Color']
            category = row['Category']
            season = row.get('Season', 'WS')
            
            # Handle Price
            if 'Price' in row:
                price_range = self.get_price_range(row['Price'])
            else:
                price_range = row.get('Price_Range', 'Unknown')
                
            # Pre-calculate common features for this row
            # To speed up, we can broadcast these, but iteration is fine for item count
            
            for cluster in clusters:
                # Interaction Features
                cluster_price = f"{cluster}_{price_range}"
                category_season = f"{category}_{season}"
                cluster_avg_demand = self.historical_avg.get('cluster', {}).get(cluster, 0)
                
                # Feature Vector
                # ['Cluster', 'Category', 'Color', 'Price_Range', 'Season', 'Cluster_Price', 'Category_Season', 'Cluster_AvgDemand']
                all_features.append([
                    cluster, category, color, price_range, season, 
                    cluster_price, category_season, cluster_avg_demand
                ])
                metadata.append((article, color, cluster))

        if not all_features:
            return pd.DataFrame()

        # Create DataFrame for Batch Prediction
        features_df = pd.DataFrame(all_features, columns=self.feature_cols)
        
        # Batch Encode
        # We need to apply the SAME encoders. 
        # Note: applying encoders row-by-row or column-by-term.
        # Efficient way: Apply encoder transformation on the full column.
        
        for col in self.feature_cols:
            if col == 'Cluster_AvgDemand':
                continue
                
            if col in self.encoders:
                le = self.encoders[col]
                # Safe Transform: Handle unseen labels by mapping to 'Unknown' or 0
                # Since we can't easily inject 'Unknown' into the LabelEncoder if it wasn't there,
                # we do a dictionary lookup fallback.
                
                # Get map of classes to integers
                le_dict = dict(zip(le.classes_, le.transform(le.classes_)))
                
                # Map column, default to 0 (or a specific 'unknown' index if we had one)
                # Using 0 is a common fallback if 0 is a valid class, but ideally we'd have an 'Other' class.
                # Here we just assume 0 for unseen.
                features_df[col] = features_df[col].map(lambda x: le_dict.get(str(x), 0))
        
        # Batch Predict
        predicted_qtys = self.model.predict(features_df)
        
        # Reassemble logic
        for i, (article, color, cluster) in enumerate(metadata):
            predictions.append({
                'Article': article,
                'Color': color,
                'Cluster': cluster,
                'Predicted_Demand': max(0, predicted_qtys[i])
            })
                
        return pd.DataFrame(predictions)

if __name__ == "__main__":
    # Test
    agent = DemandForecastAgent()
    agent.train()
