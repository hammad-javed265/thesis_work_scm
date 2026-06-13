import pandas as pd
import numpy as np
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

class DistributionOptimizerAgent:
    """
    Optimizes distribution based on predicted demand and constraints.
    Ref: Walkthrough - Optimization Layer (DOA)
    """
    def __init__(self, cluster_manager):
        self.cm = cluster_manager
        
    def optimize_distribution(self, predictions_df, total_ip_pairs, pack_size=12, product_price=None):
        """
        Allocates packs to clusters to match predicted demand while respecting symmetry.
        constraints:
        1. Total Packs <= IP / 12
        2. Cluster Packs = k * StoreCount (Symmetry)
        3. k <= Max Cap (Dynamic based on Price)
        """
        available_packs = total_ip_pairs // pack_size
        remaining_packs = available_packs
        
        # Determine Max Cap based on Price (using new granular brackets)
        # Strategy:
        # - Budget (<2500): 3 packs (high volume)
        # - Mid-range (2500-4500): 2 packs (medium volume)
        # - Premium (>4500): 1 pack (controlled distribution)
        max_cap = 3 # Default
        if product_price is not None:
            try:
                p = float(product_price)
                if p < 2500:
                    max_cap = 3  # Budget & affordable range
                elif p < 4500:
                    max_cap = 2  # Mid-range pricing
                else:
                    max_cap = 1  # Premium pricing
            except:
                max_cap = 3 # Default if price invalid
        
        allocations = {}
        
        # 1. Calculate "Ideal" packs needed per cluster
        # Group predictions by cluster if multiple rows exist (should be 1 per article-cluster)
        # But here we assume input df is for ONE article
        
        cluster_needs = []
        for _, row in predictions_df.iterrows():
            cluster = row['Cluster']
            predicted_demand = row['Predicted_Demand']
            store_count = self.cm.get_store_count(cluster)
            
            if store_count == 0:
                continue
                
            # Ideal packs needed to cover demand
            ideal_packs = predicted_demand / pack_size
            
            # Ideal packs per store
            ideal_pps = ideal_packs / store_count
            
            cluster_needs.append({
                'Cluster': cluster,
                'StoreCount': store_count,
                'Ideal_PPS': ideal_pps,
                'Predicted_Demand': predicted_demand
            })
            
        # 2. Sort clusters by "Need" (Highest demand depth first)
        cluster_needs.sort(key=lambda x: x['Ideal_PPS'], reverse=True)
        
        # 3. Allocation Loop (Iterative Breadth-First for Max Spread)
        # Strategy: Prioritize coverage (k=1) for all clusters before increasing depth (k=2, 3)
        # This ensures maximum cluster reach when inventory is limited.
        
        final_allocation = {c: 0 for c in self.cm.get_all_clusters()}
        
        # Iterate target_k from 1 up to max_cap
        for target_k in range(1, max_cap + 1):
            # Try to upgrade all eligible clusters to this level
            for item in cluster_needs:
                cluster = item['Cluster']
                store_count = item['StoreCount']
                ideal_pps = item['Ideal_PPS']
                current_k = final_allocation[cluster]
                
                # Only process if currently at the previous level (sequential growth)
                if current_k != target_k - 1:
                    continue
                
                # Qualification Check (same thresholds as before)
                qualifies = False
                if target_k == 1 and ideal_pps >= 0.05: qualifies = True
                elif target_k == 2 and ideal_pps >= 1.5: qualifies = True
                elif target_k >= 3 and ideal_pps >= 2.5: qualifies = True
                
                if qualifies:
                    required_packs = store_count
                    if required_packs <= remaining_packs:
                        final_allocation[cluster] = target_k
                        remaining_packs -= required_packs
        
        # 4. Spillover Phase: Distribute remaining packs to highest demand clusters
        # We allow up to Max Cap
        
        # We loop until we can't distribute anymore
        while remaining_packs > 0:
            made_allocation = False
            for item in cluster_needs:
                cluster = item['Cluster']
                store_count = item['StoreCount']
                
                # Check if we can add 1 more pack per store
                current_k = final_allocation[cluster]
                if current_k < max_cap:
                    required_packs = store_count # Cost to add 1 pack/store
                    
                    if required_packs <= remaining_packs:
                        final_allocation[cluster] += 1
                        remaining_packs -= required_packs
                        made_allocation = True
                        
                        if remaining_packs == 0:
                            break
            
            # If we went through all clusters and couldn't add anything (e.g. remaining < smallest cluster size), stop
            if not made_allocation:
                break
                
        
        return final_allocation, remaining_packs

if __name__ == "__main__":
    from cluster_manager import ClusterManager
    cm = ClusterManager()
    optimizer = DistributionOptimizerAgent(cm)
    print("Optimizer Agent Ready.")
