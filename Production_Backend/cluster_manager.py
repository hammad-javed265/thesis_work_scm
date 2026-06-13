import pandas as pd
import os

class ClusterManager:
    """
    Manages store-to-cluster mapping for Production.
    Reads from 'data/Store_Cluster.xlsx'.
    """
    
    def __init__(self):
        # Path relative to this script (Production_Backend/cluster_manager.py)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.cluster_file = os.path.join(base_dir, 'data', 'Store_Cluster.xlsx')
        
        self.id_to_cluster = {}
        self.cluster_counts = {}
        self.clusters = []
        
        self._load_data()
        
    def _load_data(self):
        if not os.path.exists(self.cluster_file):
            print(f"Warning: Cluster file not found at {self.cluster_file}")
            return

        try:
            # Header is on Row index 1 (0-based) based on inspection
            df = pd.read_excel(self.cluster_file, header=1)
            
            # expected columns: 'Cluster Sr.' and 'Code'
            # Normalize column names just in case (strip whitespace)
            df.columns = [str(c).strip() for c in df.columns]
            
            if 'Cluster Sr.' not in df.columns or 'Code' not in df.columns:
                print(f"Error: Missing required columns in {self.cluster_file}. Found: {df.columns}")
                return
                
            # Clean data
            df['Cluster'] = df['Cluster Sr.'].astype(str).str.strip()
            df['ID'] = df['Code'].astype(str).str.strip()
            
            # Filter valid IDs (start with W or legitimate ID)
            # Accessing existing logic, usually W...
            valid_df = df[df['ID'] != 'nan']
            
            # 1. Build Mapping (Exclude Online)
            mask = (~valid_df['Cluster'].isin(['Online', 'Cluster Sr.', 'nan']))
            filtered_df = valid_df[mask]
            
            self.id_to_cluster = pd.Series(filtered_df.Cluster.values, index=filtered_df.ID).to_dict()
            
            # 2. Calculate Counts
            counts = filtered_df.groupby('Cluster')['ID'].nunique()
            self.cluster_counts = counts.to_dict()
            
            # 3. List of Clusters (sorted usually helps, or strict priority if needed)
            # If specific priority is needed (A+1, A, etc), we might need to sort manually.
            # For now, let's take unique clusters from file.
            # Defined Priority for display consistency if present, else alphanumeric
            priority_order = ['A+1', 'A+2', 'A', 'B+', 'B', 'C1', 'C2', 'C3', 'D']
            found_clusters = list(self.cluster_counts.keys())
            
            # Sort found clusters based on priority list, others at end
            self.clusters = sorted(found_clusters, key=lambda x: priority_order.index(x) if x in priority_order else 999)
            
            print(f"Loaded {len(self.id_to_cluster)} store mappings. Clusters: {self.clusters}")
            
        except Exception as e:
            print(f"Failed to load cluster data: {str(e)}")

    def get_cluster_by_id(self, warehouse_id):
        """Finds cluster via WarehouseID."""
        wid = str(warehouse_id).strip()
        return self.id_to_cluster.get(wid, 'Unknown')

    def get_store_count(self, cluster_name):
        """Returns the store count for a cluster."""
        return self.cluster_counts.get(str(cluster_name).strip(), 0)

    def get_all_clusters(self):
        """Returns list of all available clusters."""
        return self.clusters

if __name__ == "__main__":
    cm = ClusterManager()
    print("Clusters:", cm.get_all_clusters())
    print("Counts:", cm.cluster_counts)
