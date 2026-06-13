# 🧠 ML-Driven Assortment Planning System for Supply Chain Management

> **Thesis Project** — An end-to-end machine learning system that predicts retail demand and optimizes product distribution across store clusters.

---

## 📌 Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Major Modules & Components](#major-modules--components)
4. [Model Architecture](#model-architecture)
5. [Input / Output of Each Component](#input--output-of-each-component)
6. [Implementation Details](#implementation-details)
7. [Training & Inference Setup](#training--inference-setup)
8. [How to Run the Code](#how-to-run-the-code)
9. [How to Reproduce Results](#how-to-reproduce-results)
10. [Dataset Location & Source](#dataset-location--source)
11. [Hardware & Software Requirements](#hardware--software-requirements)

---

## Project Overview

This project implements a **two-stage ML pipeline** for retail supply chain optimization:

| Stage | Module | Purpose |
|-------|--------|---------|
| **Stage 1** | `DemandForecastAgent` | Predicts per-cluster demand for new products using a Random Forest Regressor trained on historical seasonal sales data |
| **Stage 2** | `DistributionOptimizerAgent` | Allocates pack quantities to store clusters under inventory constraints using a greedy breadth-first strategy |

A **Next.js frontend** (`initial_push/`) provides an authenticated web interface for planners to upload assortment plans and receive cluster-level distribution recommendations in real time.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        SUPPLY CHAIN ML SYSTEM                                │
│                                                                              │
│  ┌─────────────────────┐         ┌──────────────────────────────────────┐   │
│  │   Frontend (Next.js) │         │        Python Backend (FastAPI)       │   │
│  │   initial_push/      │         │        Production_Backend/            │   │
│  │                      │         │                                      │   │
│  │  ┌────────────────┐  │  HTTP   │  ┌────────────────┐                 │   │
│  │  │  Login (Auth)  │  │ POST    │  │   api.py        │                │   │
│  │  │  next-auth     │  │ ──────► │  │  /generate_plan │                │   │
│  │  └────────────────┘  │         │  │  /health        │                │   │
│  │                      │         │  └───────┬─────────┘                │   │
│  │  ┌────────────────┐  │         │          │                          │   │
│  │  │  ML Planner UI │  │ ◄────── │  ┌───────▼──────────────────────┐  │   │
│  │  │  Upload Excel  │  │  JSON   │  │   DemandForecastAgent         │  │   │
│  │  │  View Results  │  │         │  │   ml_forecast_agent.py        │  │   │
│  │  └────────────────┘  │         │  │                               │  │   │
│  └─────────────────────┘         │  │  RandomForest (200 trees)     │  │   │
│                                   │  │  Features: Cluster, Category, │  │   │
│                                   │  │  Color, Price_Range, Season + │  │   │
│                                   │  │  3 interaction features        │  │   │
│                                   │  └───────────────┬───────────────┘  │   │
│                                   │                  │ Predicted Demand  │   │
│                                   │  ┌───────────────▼───────────────┐  │   │
│                                   │  │  DistributionOptimizerAgent   │  │   │
│                                   │  │  ml_optimizer_agent.py        │  │   │
│                                   │  │                               │  │   │
│                                   │  │  Greedy Breadth-First         │  │   │
│                                   │  │  Pack Allocation under:       │  │   │
│                                   │  │  - IP inventory constraint    │  │   │
│                                   │  │  - Symmetry (k × store count) │  │   │
│                                   │  │  - Price-based max cap (1-3)  │  │   │
│                                   │  └───────────────┬───────────────┘  │   │
│                                   │                  │ Allocations Dict  │   │
│                                   │  ┌───────────────▼───────────────┐  │   │
│                                   │  │  ClusterManager               │  │   │
│                                   │  │  cluster_manager.py           │  │   │
│                                   │  │  Store_Cluster.xlsx           │  │   │
│                                   │  │  Priority: A+1 > A+2 > A >   │  │   │
│                                   │  │           B+ > B > C1..D      │  │   │
│                                   │  └───────────────────────────────┘  │   │
│                                   └──────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Training Data (data/)                                               │   │
│  │  HS_data.xlsx | AS_data.xlsx | SS_data.xlsx | WS_data.xlsx          │   │
│  │  (Hot Summer | Autumn Spring | Spring Summer | Winter)               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Major Modules & Components

### Backend (`Production_Backend/`)

| File | Class / Role | Description |
|------|-------------|-------------|
| `api.py` | `FastAPI app` | REST API server; exposes `/health` and `/generate_plan` endpoints |
| `ml_forecast_agent.py` | `DemandForecastAgent` | Trains and serves the Random Forest demand forecasting model |
| `ml_optimizer_agent.py` | `DistributionOptimizerAgent` | Greedy pack-allocation optimizer with inventory and symmetry constraints |
| `cluster_manager.py` | `ClusterManager` | Loads store-to-cluster mappings; provides store counts per cluster |
| `production_setup.py` | Setup Script | One-time setup: copies data files and trains + saves the model to disk |

### Frontend (`initial_push/`)

| Path | Role |
|------|------|
| `app/page.tsx` | Root/home page |
| `app/login/` | Authentication page (next-auth) |
| `app/ml-planner/` | Main ML planner UI — Excel upload & result display |
| `app/api/` | Next.js API routes |
| `app/components/` | Shared React components |
| `auth.ts` | NextAuth configuration |
| `middleware.ts` | Route protection middleware |

---

## Model Architecture

### Demand Forecast Model — Random Forest Regressor

```
Input Features (8 total)
├── Cluster              (store tier: A+1, A+2, A, B+, B, C1, C2, C3, D)
├── Category             (product category e.g. 01 Fancy, 03 Casual, 04 Winter …)
├── Color                (product color)
├── Price_Range          (13-bracket price bins: <1500, 1500-1999, … 11500+)
├── Season               (HS | AS | SS | WS)
├── Cluster_Price        [INTERACTION] = Cluster + "_" + Price_Range
├── Category_Season      [INTERACTION] = Category + "_" + Season
└── Cluster_AvgDemand    [NUMERICAL] = historical mean demand for the cluster

           │
           ▼
  ┌─────────────────────────────┐
  │   RandomForestRegressor     │
  │   n_estimators  : 200       │
  │   max_depth     : 30        │
  │   min_samples_split : 5     │
  │   random_state  : 42        │
  │   n_jobs        : -1        │
  └─────────────────────────────┘
           │
           ▼
  Predicted Net Sale Qty (per Article–Color–Cluster combination)
```

**Target Variable:** `Net Sale Qty` — the aggregated net sales quantity for a (Cluster, Category, Color, Price_Range, Season) combination.

**Label Encoding:** All categorical features are label-encoded with `sklearn.LabelEncoder`. Unseen labels at inference time default to index `0`.

**Train/Test Split:** 80 / 20, `random_state=42`.

**Serialization:** Model artifacts (fitted `RandomForestRegressor`, encoders dict, historical averages) are persisted via `joblib` to `model_artifacts/rf_model.pkl`.

---

## Input / Output of Each Component

### 1. `ClusterManager`
| | Detail |
|--|--------|
| **Input** | `data/Store_Cluster.xlsx` — sheet with columns `Cluster Sr.` and `Code` (WarehouseID) |
| **Output** | `id_to_cluster: dict`, `cluster_counts: dict`, `clusters: list` (priority-sorted) |
| **Key Methods** | `get_cluster_by_id(wid)`, `get_store_count(cluster)`, `get_all_clusters()` |

### 2. `DemandForecastAgent.prepare_data()`
| | Detail |
|--|--------|
| **Input** | 4 Excel files: `HS_data.xlsx`, `AS_data.xlsx`, `SS_data.xlsx`, `WS_data.xlsx` |
| **Columns used** | `WarehouseID`, `category`, `color`, `product_price`, `total_qty`, `season` |
| **Output** | Feature matrix `X` (shape: `n_combos × 8`) and target vector `y` (`Net Sale Qty`) |
| **Filtering** | Drops online warehouses (W109504, W109501); drops rows with unknown cluster |

### 3. `DemandForecastAgent.train()`
| | Detail |
|--|--------|
| **Input** | Output of `prepare_data()` |
| **Output** | Fitted `RandomForestRegressor`; prints R² score on 20% holdout |

### 4. `DemandForecastAgent.predict_demand(plan_data)`
| | Detail |
|--|--------|
| **Input** | DataFrame with columns: `Article`, `Color`, `Category`, `Price` (or `Price_Range`), optionally `Season` |
| **Output** | DataFrame with columns: `Article`, `Color`, `Cluster`, `Predicted_Demand` — one row per (Article, Color, Cluster) combination |

### 5. `DistributionOptimizerAgent.optimize_distribution()`
| | Detail |
|--|--------|
| **Input** | `predictions_df` (from DFA), `total_ip_pairs` (int), `pack_size=12`, `product_price` (float) |
| **Output** | `(final_allocation: dict[cluster → k], remaining_packs: int)` |
| **Constraints** | ① Total packs ≤ IP ÷ 12  ② Cluster packs = k × store_count  ③ k ≤ max_cap (price-driven) |

### 6. `api.py — POST /generate_plan`
| | Detail |
|--|--------|
| **Input** | Multipart Excel file upload with columns: `Article`, `Color`, `Price`, `IP`, `Theme` |
| **Output** | JSON `{"plan": [{Article, Color, Theme, Price, Total_Pairs, Remaining_Packs, Allocations}, …]}` |

---

## Implementation Details

### Price-Based Maximum Cap (Optimizer)

| Price Range | Max Cap (k) | Rationale |
|-------------|-------------|-----------|
| < PKR 2,500 | 3 packs/store | Budget — high volume expected |
| PKR 2,500–4,499 | 2 packs/store | Mid-range — moderate volume |
| ≥ PKR 4,500 | 1 pack/store | Premium — controlled distribution |

### Allocation Strategy (Breadth-First Greedy)

Clusters are processed in demand-priority order (highest `Ideal_PPS = predicted_demand / (pack_size × store_count)` first). Allocation depth increases iteratively (k=1 → 2 → 3) ensuring maximum store coverage before increasing depth:

- **k=1 threshold:** `Ideal_PPS ≥ 0.05`
- **k=2 threshold:** `Ideal_PPS ≥ 1.5`
- **k=3 threshold:** `Ideal_PPS ≥ 2.5`

Any remaining packs after the main loop enter a **spillover phase** that redistributes them to highest-need clusters up to `max_cap`.

### Theme → Category Mapping

| Theme | Internal Category |
|-------|-----------------|
| Casual | 03 Casual |
| Party Wear / Fancy | 01 Fancy |
| Formal | 02 Formal |
| Winter | 04 Winter |
| Athleisure | 06 Athleisure |
| Ethnic | 05 Ethnic |
| PU | 14 PU |

### Interaction Features Rationale

| Feature | Captures |
|---------|---------|
| `Cluster_Price` | Cluster-level buying power sensitivity to price bracket |
| `Category_Season` | Seasonal demand trends per category |
| `Cluster_AvgDemand` | Numerical baseline demand signal for each cluster |

---

## Training & Inference Setup

### Training

```bash
# Step 1: Run the one-time production setup (copies data + trains model)
cd Production_Backend
python production_setup.py
```

- Reads 4 seasonal Excel files from `data/`
- Aggregates sales by `(Cluster, Category, Color, Price_Range, Season)`
- Engineers 3 interaction features
- Trains `RandomForestRegressor` with 200 trees
- Saves full artifact bundle to `model_artifacts/rf_model.pkl` (~237 MB)
- Prints R² score on 20% test split

### Inference

The API server loads the model once at startup and handles inference requests:

```bash
# Step 2: Start the FastAPI inference server
cd Production_Backend
uvicorn api:app --host 0.0.0.0 --port 8000
```

At startup the lifespan handler:
1. Loads `rf_model.pkl` via `joblib.load()`
2. Restores encoders + historical averages
3. Instantiates `ClusterManager` and `DistributionOptimizerAgent`

Every `/generate_plan` call:
1. Parses uploaded Excel row-by-row
2. Calls `predict_demand()` → vectorized batch prediction across all clusters
3. Calls `optimize_distribution()` for each article
4. Returns consolidated JSON allocation plan

---

## How to Run the Code

### Prerequisites

- Python 3.9+
- Node.js 18+
- Git

---

### Backend Setup

```bash
# 1. Navigate to backend
cd Production_Backend

# 2. Install Python dependencies
pip install fastapi uvicorn pandas numpy scikit-learn openpyxl joblib

# 3. Run production setup (trains and saves model — only needed once)
python production_setup.py

# 4. Start the API server
uvicorn api:app --host 0.0.0.0 --port 8000 --reload

# API will be available at http://localhost:8000
# Health check: GET http://localhost:8000/health
```

### Frontend Setup

```bash
# 1. Navigate to frontend
cd initial_push

# 2. Install Node dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your AUTH_SECRET and backend URL

# 4. Start the development server
npm run dev

# App will be available at http://localhost:5000
```

---

## How to Reproduce Results

1. **Obtain the dataset** (see [Dataset Location & Source](#dataset-location--source))
2. **Place files** in `Production_Backend/data/`:
   - `HS_data.xlsx`, `AS_data.xlsx`, `SS_data.xlsx`, `WS_data.xlsx`
   - `Store_Cluster.xlsx`
3. **Run training:**
   ```bash
   cd Production_Backend
   python production_setup.py
   ```
4. **Verify model performance** — the script prints the R² score on the 20% holdout set.
5. **Start the API** and upload an assortment plan Excel via the frontend or directly:
   ```bash
   curl -X POST http://localhost:8000/generate_plan \
        -F "file=@IP_Upload_Format.xlsx"
   ```
6. The `data/IP Upload Format.xlsx` file contains the expected upload template.

---

## Dataset Location & Source

| File | Size | Description |
|------|------|-------------|
| `Production_Backend/data/HS_data.xlsx` | ~40 MB | Hot Summer season sales history |
| `Production_Backend/data/AS_data.xlsx` | ~37 MB | Autumn-Spring season sales history |
| `Production_Backend/data/SS_data.xlsx` | ~40 MB | Spring-Summer season sales history |
| `Production_Backend/data/WS_data.xlsx` | ~51 MB | Winter season sales history |
| `Production_Backend/data/Store_Cluster.xlsx` | ~21 KB | Store-to-cluster mapping (`Cluster Sr.`, `Code`) |
| `Production_Backend/data/IP Upload Format.xlsx` | ~21 KB | Template for plan upload |

> ⚠️ **Note:** Raw data files are excluded from this repository (via `.gitignore`) due to file size and confidentiality. Contact the thesis supervisor or data owner for access.

**Data Schema (Seasonal Sales Files):**

| Column | Type | Description |
|--------|------|-------------|
| `WarehouseID` | string | Unique store/warehouse identifier (e.g. `W109501`) |
| `StoreName` | string | Display name of the store |
| `category` | string | Product category |
| `color` | string | Product color |
| `season` | string | Season code (HS / AS / SS / WS) |
| `product_price` | float | Retail price in PKR |
| `total_qty` | int | Net sales quantity |

---

## Hardware & Software Requirements

### Software

| Component | Version |
|-----------|---------|
| Python | ≥ 3.9 |
| scikit-learn | ≥ 1.3 |
| pandas | ≥ 2.0 |
| numpy | ≥ 1.24 |
| fastapi | ≥ 0.110 |
| uvicorn | ≥ 0.29 |
| joblib | ≥ 1.3 |
| openpyxl | ≥ 3.1 |
| Node.js | ≥ 18 |
| Next.js | 16.0.3 |
| next-auth | ^5.0.0-beta |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |

### Hardware (Training)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8+ cores (training uses `n_jobs=-1`) |
| RAM | 8 GB | 16 GB (data loading peaks ~4–6 GB) |
| Disk | 2 GB free | 5 GB free (model artifact ~237 MB) |
| GPU | Not required | Not required (CPU-only Random Forest) |

### Hardware (Inference / API)

| Resource | Minimum |
|----------|---------|
| CPU | 2 cores |
| RAM | 4 GB (model in memory ~1 GB) |
| Disk | 500 MB |

---

## Project Structure

```
supply_chain_thesis/
├── README.md                        ← This file
├── docs/
│   └── ARCHITECTURE.md              ← Detailed architecture documentation
├── Production_Backend/              ← Python ML backend
│   ├── api.py                       ← FastAPI REST API
│   ├── ml_forecast_agent.py         ← Random Forest demand forecasting
│   ├── ml_optimizer_agent.py        ← Pack distribution optimizer
│   ├── cluster_manager.py           ← Store cluster management
│   ├── production_setup.py          ← One-time training & setup script
│   ├── data/                        ← Data files (gitignored)
│   │   ├── HS_data.xlsx
│   │   ├── AS_data.xlsx
│   │   ├── SS_data.xlsx
│   │   ├── WS_data.xlsx
│   │   ├── Store_Cluster.xlsx
│   │   └── IP Upload Format.xlsx
│   └── model_artifacts/             ← Saved model (gitignored)
│       └── rf_model.pkl
└── initial_push/                    ← Next.js frontend
    ├── app/
    │   ├── page.tsx                 ← Home page
    │   ├── login/                   ← Auth page
    │   ├── ml-planner/              ← Main planner UI
    │   ├── api/                     ← Next.js API routes
    │   └── components/              ← Shared components
    ├── auth.ts                      ← NextAuth config
    ├── middleware.ts                 ← Route protection
    └── package.json
```

---

## License

This project is developed as part of an MS thesis. All rights reserved.
