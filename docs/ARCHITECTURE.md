# System Architecture — ML-Driven Assortment Planning

## 1. Final Pipeline / System Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                       END-TO-END PIPELINE                           ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ┌──────────────┐    ┌──────────────────────────────────────────┐   ║
║  │  RAW DATA    │    │         TRAINING PIPELINE                 │   ║
║  │              │    │                                          │   ║
║  │ HS_data.xlsx │───►│  1. Load 4 seasonal Excel files          │   ║
║  │ AS_data.xlsx │    │  2. Filter online warehouses             │   ║
║  │ SS_data.xlsx │    │  3. Map WarehouseID → Cluster            │   ║
║  │ WS_data.xlsx │    │  4. Engineer price brackets              │   ║
║  └──────────────┘    │  5. Aggregate demand by feature combo    │   ║
║                      │  6. Add 3 interaction features            │   ║
║  ┌──────────────┐    │  7. Label-encode all categoricals         │   ║
║  │Store_Cluster │───►│  8. Train RandomForest (200 trees)        │   ║
║  │   .xlsx      │    │  9. Evaluate on 20% holdout (R²)         │   ║
║  └──────────────┘    │  10. Serialize → rf_model.pkl (joblib)   │   ║
║                      └──────────────────────────────────────────┘   ║
║                                          │                          ║
║                                          ▼ rf_model.pkl             ║
║                      ┌──────────────────────────────────────────┐   ║
║                      │         INFERENCE PIPELINE               │   ║
║                      │                                          │   ║
║  ┌──────────────┐    │  FastAPI Server (api.py)                  │   ║
║  │  IP Upload   │───►│  POST /generate_plan                     │   ║
║  │  Format.xlsx │    │        │                                 │   ║
║  └──────────────┘    │        ├─ For each article row:          │   ║
║                      │        │                                 │   ║
║                      │        ▼                                 │   ║
║                      │  DemandForecastAgent.predict_demand()    │   ║
║                      │  → Predicted demand per cluster          │   ║
║                      │        │                                 │   ║
║                      │        ▼                                 │   ║
║                      │  DistributionOptimizer.optimize()        │   ║
║                      │  → Pack allocations per cluster          │   ║
║                      │        │                                 │   ║
║                      │        ▼                                 │   ║
║                      │  JSON Response → Frontend Display        │   ║
║                      └──────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 2. Major Modules / Components

### 2.1 `ClusterManager` (`cluster_manager.py`)

**Role:** Data access layer for store cluster information.

Loads `Store_Cluster.xlsx` at construction time and builds three internal data structures:

- `id_to_cluster: Dict[str, str]` — maps each `WarehouseID` to its cluster label
- `cluster_counts: Dict[str, int]` — number of stores per cluster
- `clusters: List[str]` — all cluster labels sorted by business priority

**Priority Order:** `A+1 → A+2 → A → B+ → B → C1 → C2 → C3 → D`

---

### 2.2 `DemandForecastAgent` (`ml_forecast_agent.py`)

**Role:** Core ML component. Handles data preparation, model training, serialization, and batch inference.

#### Sub-components:

| Method | Purpose |
|--------|---------|
| `prepare_data()` | ETL pipeline — loads, filters, aggregates, and encodes training data |
| `train()` | Fits `RandomForestRegressor` on prepared data |
| `predict_demand(plan_data)` | Batch inference for all clusters for each plan item |
| `save_model(filepath)` | Persists model + encoders + historical averages via `joblib` |
| `load_model(filepath)` | Restores serialized artifacts from disk |
| `get_price_range(price)` | Static helper — maps numeric price to string bracket |

---

### 2.3 `DistributionOptimizerAgent` (`ml_optimizer_agent.py`)

**Role:** Constraint-aware allocation engine. Takes demand predictions and converts them to integer pack allocations.

#### Algorithm: Iterative Breadth-First Greedy

```
Phase 1 — Qualification Sweep (k = 1 to max_cap):
  For each target depth k:
    For each cluster (sorted by Ideal_PPS desc):
      If cluster is at k-1 packs AND qualifies for k packs:
        Allocate if inventory allows

Phase 2 — Spillover:
  While remaining_packs > 0:
    Try to add 1 more pack to highest-need clusters
    Stop when no more allocations fit
```

---

### 2.4 `api.py` — FastAPI Application

**Role:** Production HTTP server. Bridges the frontend and ML backend.

#### Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{"status": "active", "model_loaded": bool}` |
| `POST` | `/generate_plan` | Accepts Excel file upload, returns JSON allocation plan |

**Startup Lifespan:**
1. Loads `rf_model.pkl` into memory (`DemandForecastAgent.load_model()`)
2. Instantiates `ClusterManager` and `DistributionOptimizerAgent`
3. These objects are reused across all requests (no per-request reload)

---

### 2.5 `production_setup.py`

**Role:** One-time CLI script run before first deployment.

Steps:
1. Creates `data/` and `model_artifacts/` directories
2. Copies seasonal Excel files and `Store_Cluster.xlsx` from source
3. Instantiates `DemandForecastAgent` pointing to `data/` folder
4. Trains the model
5. Saves artifacts to `model_artifacts/rf_model.pkl`

---

### 2.6 Frontend (`initial_push/`)

**Role:** Web UI for assortment planners.

| Route | Purpose |
|-------|---------|
| `/` | Landing/home page |
| `/login` | Authentication via NextAuth |
| `/ml-planner` | Upload plan Excel, view cluster allocation results |

**Technology Stack:**
- Next.js 16 (App Router)
- TypeScript
- TailwindCSS v4
- next-auth v5 (beta) for session management
- `xlsx` library for client-side Excel parsing
- `react-icons` for UI icons

---

## 3. Input / Output of Each Major Component

### 3.1 ClusterManager

```
INPUT:
  data/Store_Cluster.xlsx
  ┌──────────────┬─────────┐
  │ Cluster Sr.  │  Code   │
  ├──────────────┼─────────┤
  │ A+1          │ W100001 │
  │ A+1          │ W100002 │
  │ A            │ W100010 │
  │ ...          │ ...     │
  └──────────────┴─────────┘

OUTPUT:
  id_to_cluster = {"W100001": "A+1", "W100002": "A+1", ...}
  cluster_counts = {"A+1": 12, "A": 8, "B": 15, ...}
  clusters       = ["A+1", "A+2", "A", "B+", "B", "C1", ...]
```

---

### 3.2 DemandForecastAgent — Training I/O

```
INPUT (per seasonal file):
  ┌─────────────┬──────────┬──────────┬───────────────┬───────────┬───────────┐
  │ WarehouseID │ category │  color   │ product_price │  season   │ total_qty │
  ├─────────────┼──────────┼──────────┼───────────────┼───────────┼───────────┤
  │ W109001     │ Casual   │  Black   │    2499       │    WS     │    144    │
  │ ...         │ ...      │  ...     │    ...        │    ...    │    ...    │
  └─────────────┴──────────┴──────────┴───────────────┴───────────┴───────────┘

FEATURE ENGINEERING:
  1. WarehouseID → Cluster (via ClusterManager)
  2. product_price → Price_Range (13-bin bracket)
  3. Groupby & Sum: (Cluster, Category, Color, Price_Range, Season) → Net Sale Qty
  4. Cluster_Price = Cluster + "_" + Price_Range
  5. Category_Season = Category + "_" + Season
  6. Cluster_AvgDemand = mean(Net Sale Qty) grouped by Cluster

OUTPUT (training matrix):
  X shape: (n_unique_combos, 8)  — 8 encoded features
  y shape: (n_unique_combos,)    — Net Sale Qty (float)
```

---

### 3.3 DemandForecastAgent — Inference I/O

```
INPUT (plan_data DataFrame):
  ┌─────────┬────────┬──────────┬───────┬────────┐
  │ Article │ Color  │ Category │ Price │ Season │
  ├─────────┼────────┼──────────┼───────┼────────┤
  │ ART001  │ Black  │ Casual   │ 2499  │  WS    │
  └─────────┴────────┴──────────┴───────┴────────┘

PROCESS:
  For each article × each cluster → build feature vector → batch predict

OUTPUT (predictions DataFrame):
  ┌─────────┬────────┬─────────┬──────────────────┐
  │ Article │ Color  │ Cluster │ Predicted_Demand  │
  ├─────────┼────────┼─────────┼──────────────────┤
  │ ART001  │ Black  │ A+1     │ 186.4            │
  │ ART001  │ Black  │ A+2     │ 120.1            │
  │ ART001  │ Black  │ A       │  98.7            │
  │ ...     │ ...    │ ...     │  ...             │
  └─────────┴────────┴─────────┴──────────────────┘
  (1 row per article–cluster combination, demand clipped to ≥ 0)
```

---

### 3.4 DistributionOptimizerAgent — I/O

```
INPUT:
  predictions_df   : DataFrame (Article × Cluster demand predictions)
  total_ip_pairs   : int   (e.g. 1440 pairs in initial purchase)
  pack_size        : int   (default = 12 pairs per pack)
  product_price    : float (determines max_cap)

COMPUTED INTERNALLY:
  available_packs = total_ip_pairs // pack_size    → e.g. 120
  max_cap         = 1 | 2 | 3  (based on price tier)
  Ideal_PPS       = predicted_demand / (pack_size × store_count)

OUTPUT:
  final_allocation = {
      "A+1": 2,   ← k packs per store in A+1 cluster
      "A+2": 2,
      "A":   1,
      "B+":  1,
      "B":   0,
      "C1":  0,
      ...
  }
  remaining_packs = 4  ← unallocated packs
```

---

### 3.5 FastAPI `/generate_plan` — Request/Response

```
REQUEST:
  POST /generate_plan
  Content-Type: multipart/form-data
  Body: file = <Excel file>

  Excel columns required:
  ┌─────────┬────────┬───────┬──────┬─────────┐
  │ Article │ Color  │ Price │  IP  │  Theme  │
  ├─────────┼────────┼───────┼──────┼─────────┤
  │ ART001  │ Black  │ 2499  │ 1440 │ Casual  │
  │ ART002  │ White  │ 3999  │  720 │ Formal  │
  └─────────┴────────┴───────┴──────┴─────────┘

RESPONSE (JSON):
  {
    "plan": [
      {
        "Article": "ART001",
        "Color": "Black",
        "Theme": "Casual",
        "Price": 2499,
        "Total_Pairs": 1440,
        "Remaining_Packs": 4,
        "Allocations": {
          "A+1": 2,
          "A+2": 2,
          "A": 1,
          "B+": 1,
          "B": 0,
          "C1": 0,
          ...
        }
      }
    ]
  }
```

---

## 4. Implementation Details

### 4.1 Feature Engineering

**Price Bracket Mapping (13 bins):**

| Range | Bracket Label |
|-------|--------------|
| < 1500 | `<1500` |
| 1500–1999 | `1500-1999` |
| 2000–2499 | `2000-2499` |
| 2500–2999 | `2500-2999` |
| 3000–3499 | `3000-3499` |
| 3500–3999 | `3500-3999` |
| 4000–4499 | `4000-4499` |
| 4500–4999 | `4500-4999` |
| 5000–5499 | `5000-5499` |
| 5500–7499 | `5500-7499` |
| 7500–9499 | `7500-9499` |
| 9500–11499 | `9500-11499` |
| ≥ 11500 | `11500+` |

**Why interaction features?**
- `Cluster_Price`: Captures the fact that premium clusters (A+1) may sustain higher-priced items better than budget clusters (C, D).
- `Category_Season`: Winter coats sell better in WS; Athleisure sells consistently across seasons — this encodes those trends directly.
- `Cluster_AvgDemand`: A numerical baseline signal preventing the model from treating all clusters as equal when their historic volumes differ by orders of magnitude.

### 4.2 Data Filtering

**Online store exclusion:** WarehouseIDs `W109504` and `W109501` are e-commerce warehouses and operate under different demand dynamics — excluded before training to avoid contaminating cluster-level brick-and-mortar predictions.

**Unknown cluster handling:** Rows where `WarehouseID` does not map to any cluster in `Store_Cluster.xlsx` are dropped (`Cluster == 'Unknown'`). A warning is printed with the count of such rows for audit purposes.

### 4.3 Unseen Label Handling (Inference)

At inference time, new articles may have colors, categories, or cluster-price combinations not seen during training. The safe-transform logic:
```python
le_dict = dict(zip(le.classes_, le.transform(le.classes_)))
features_df[col] = features_df[col].map(lambda x: le_dict.get(str(x), 0))
```
Unknown labels are mapped to index `0` (the first class the encoder saw during training). This is a pragmatic fallback — production robustness could be improved by adding an explicit `"Other"` class during training.

### 4.4 Vectorized Batch Prediction

Rather than calling `model.predict()` once per (article, cluster) pair, all feature vectors for all articles × all clusters are assembled into a single DataFrame and predicted in one batch call. This reduces Python overhead and leverages scikit-learn's parallelized forest traversal.

### 4.5 Authentication (Frontend)

NextAuth v5 beta handles session management. `middleware.ts` protects the `/ml-planner` route, redirecting unauthenticated users to `/login`.

---

## 5. Training / Inference Setup

### 5.1 Training

**Script:** `production_setup.py`

```
Environment:     CPU-only (scikit-learn RandomForest, n_jobs=-1)
Data Volume:     ~4 Excel files × ~100k–200k rows each
Training Time:   ~3–8 minutes on 8-core CPU
Memory Peak:     ~4–6 GB RAM during data loading + training
Model Size:      ~237 MB (rf_model.pkl, compressed via joblib)
Output:          model_artifacts/rf_model.pkl
Metric:          R² on 20% holdout set
```

**Reproducibility:** `random_state=42` is set in both `train_test_split` and `RandomForestRegressor` ensuring identical splits and results on the same hardware and scikit-learn version.

### 5.2 Inference

**Server:** `uvicorn api:app --host 0.0.0.0 --port 8000`

```
Model load time:    ~5–15 seconds at startup (joblib deserializes ~237 MB pkl)
Per-request time:   ~50–500 ms (varies with number of articles × clusters)
Memory (runtime):   ~1–2 GB (RandomForest in memory)
Concurrency:        Single-process uvicorn (add --workers N for production)
```

**Scaling considerations:**
- The model is stateless after loading — safe to run multiple workers
- For high load, pre-fork with `gunicorn -w 4 -k uvicorn.workers.UvicornWorker api:app`
- Data files are not re-read at inference time (training is offline)

---

*Last updated: June 2026*
