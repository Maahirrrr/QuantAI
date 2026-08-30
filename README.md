# QuantAI — Quantitative & AI-Powered Trading Engine

![QuantAI Banner](https://img.shields.io/badge/QuantAI-v14.0-00c076?style=for-the-badge&logo=probot&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

**QuantAI** is a high-performance, single-file quantitative trading workstation and algorithmic execution engine. It combines deterministic multi-indicator mathematical consensus models with an LLM reasoning layer (Claude Sonnet) for qualitative confirmation, disciplined risk management (Half-Kelly sizing, volatility regime gating, drawdown circuit breakers), and ultra-fast local scalp execution.

---

## 📑 Table of Contents
1. [Architectural Overview](#-architectural-overview)
2. [Trading Strategies & Decision Engines](#-trading-strategies--decision-engines)
   - [Swing Mode (5-Signal Ensemble + Claude AI)](#1-swing-mode-10s-cycle)
   - [Scalp Mode (Fast 2-Signal Local Engine)](#2-scalp-mode-⚡-2s-cycle)
3. [Risk Management Framework](#-risk-management-framework)
   - [Half-Kelly Dynamic Position Sizing](#1-half-kelly-dynamic-position-sizing)
   - [Hard Notional Balance Cap (15%) & SL Floor](#2-hard-notional-balance-cap-15--sl-floor)
   - [One-Sided Volatility Regime Gate](#3-one-sided-volatility-regime-gate)
   - [Drawdown Circuit Breaker & Top-Up Integrity](#4-drawdown-circuit-breaker)
4. [User Interface & Real-Time Monitoring](#-user-interface--real-time-monitoring)
5. [Keyboard Shortcuts](#-keyboard-shortcuts)
6. [Getting Started & Local Setup](#-getting-started--local-setup)

---

## 🏛 Architectural Overview

QuantAI employs a **hybrid dual-engine architecture**:

```
                              ┌────────────────────────────────────────┐
                              │            Incoming Ticks              │
                              │        (BTC, ETH, SOL, BNB)            │
                              └──────────────────┬─────────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
             [ SWING MODE (10s) ]                              [ SCALP MODE (2s) ]
            5-Signal Mathematical                             Fast Local Engine
                 Ensemble                                    (EMA 5/13 + RSI 7)
                        │                                                 │
          ┌─────────────┴─────────────┐                                   │
          ▼                           ▼                                   │
     Score 5/5                   Score 4/5 (or 1/5 Exit)                  │
[ Deterministic ]              [ Escalated to AI ]                        │
  Local Execution               Claude Sonnet Reasoning                   │
                               (Conf ≥ 68% required)                      │
          │                           │                                   │
          └─────────────┬─────────────┘                                   │
                        │                                                 │
                        ▼                                                 ▼
             ┌─────────────────────────────────────────────────────────────────┐
             │                   RISK & REGIME FILTERS                         │
             │  • Volatility Gate: Blocks if ATR Z-Score > +2.0 (Chaotic)     │
             │  • Circuit Breaker: Halts entries if Drawdown > 8%             │
             │  • Half-Kelly Position Sizing (0.5% - 3.0% risk target)        │
             │  • Non-negotiable 15% Max Equity Notional Hard Ceiling         │
             └────────────────────────────────┬────────────────────────────────┘
                                              │
                                              ▼
                                 [ SIMULATED EXECUTION ]
                          Auto TP (2:1 R:R) / SL / Trailing P&L
```

---

## 📊 Trading Strategies & Decision Engines

### 1. Swing Mode (10s Cycle)
In Swing Mode, QuantAI evaluates a 5-component quantitative ensemble across price and volume action every 10 seconds:

| Signal | Indicator & Settings | Bullish Vote Condition | Penalty / Exit Condition |
| :--- | :--- | :--- | :--- |
| **1. Triple EMA** | EMA(5, 20, 50) | `EMA5 > EMA20 > EMA50` (Alignment) | `EMA5 < EMA20 < EMA50` (-1 Score) |
| **2. RSI** | RSI(14) | `RSI < 38` (Oversold) OR `RSI < 55` (Mid-momentum) | `RSI > 65` (Overbought) |
| **3. ATR Volatility** | ATR(14) | `ATR % < 0.15%` of Price (Compression setup) | High baseline volatility |
| **4. MACD** | MACD(12, 26, 9) | `MACD > Signal` AND `MACD > 0` (Bull cross) | `MACD < Signal` AND `MACD < 0` (-1 Score) |
| **5. Mean Reversion** | Price Z-Score (20-period SMA & StdDev) | $Z < -1.5$ (Deep discount / oversold stretch) | $Z > +1.5$ (Overextended, -1 Score) |

#### Consensus Routing:
- **5 / 5 Score (Unanimous):** Immediate **Local BUY** executed instantly without API latency.
- **4 / 5 Score (Ambiguous Bullish):** Escalated to **Claude Sonnet API**. The model inspects multi-indicator values, technical context, and portfolio free margin. Only opens position if AI confidence is **$\ge 68\%$**.
- **2 / 5 to 3 / 5 Score (Neutral):** **HOLD / WAIT**.
- **1 / 5 Score (Ambiguous Bearish):** If a position is open and held for at least 120s, Claude evaluates the exit; sells if confidence is **$\ge 60\%$**.
- **0 / 5 Score (Total Breakdown):** Immediate **Local SELL** to preserve capital.
- **Minimum Holding Period:** 120 seconds to prevent whipsaws.

---

### 2. Scalp Mode ⚡ (2s Cycle)
Activated via the **`⚡ Scalp Mode`** button. Designed for high-frequency, responsive local momentum trading without external API roundtrips.

- **Loop Frequency:** 2,000 ms.
- **Fast 2-Signal Strict Confluence Rule:**
  - **Entry (BUY):** `EMA(5) > EMA(13)` **AND** `RSI(7) < 60`. *(Both must agree simultaneously. If RSI $\ge 60$, the momentum is already overextended).*
  - **Exit (SELL):** `EMA(5) < EMA(13)` **AND** `RSI(7) > 40`. *(Both must agree simultaneously).*
  - **Disagreement:** **WAIT / HOLD** (No speculative single-indicator entries).
- **Target & Stop Ratio:**
  - $\text{Take Profit (TP)} = 1.0 \times \text{ATR}$
  - $\text{Stop Loss (SL)} = 0.5 \times \text{ATR}$
  - **Reward-to-Risk (R:R):** Exactly **2:1**.
- **Minimum Holding Period:** 15 seconds.
- **Risk Cap:** Hard ceiling of **1.5%** balance risk per trade.

---

## 🛡 Risk Management Framework

### 1. Half-Kelly Dynamic Position Sizing
Replaces naive flat percentage sizing with mathematically sound Kelly criterion calculations:

$$\text{Win Rate } (W) = \frac{\text{Winning Trades (last 20)}}{\text{Total Closed Trades (last 20)}} \quad (\text{default: } 0.50)$$

$$\text{Reward-to-Risk } (R) = \frac{\text{Average Win Amount}}{\text{Average Loss Amount}} \quad (\text{default: } 1.50)$$

$$\text{Full Kelly Fraction: } f^* = W - \frac{1 - W}{R}$$

$$\text{Half-Kelly Risk Percentage: } \text{risk\_pct} = \text{clamp}(0.5 \times f^*, \; 0.5\%, \; \text{Cap}_{\text{max}})$$

*Where $\text{Cap}_{\text{max}} = 3.0\%$ for Swing Mode and $1.5\%$ for Scalp Mode.*

---

### 2. Hard Notional Balance Cap (15%) & SL Floor
1. **Stop-Loss Floor:** $\text{SL\_distance} = \max(\text{ATR} \times \text{multiplier}, \; \text{Price} \times 0.008)$. Prevents hyper-leveraging and unrealistic stop-loss distances during near-zero ATR market regimes.
2. **Absolute 15% Equity Ceiling:** Under no circumstances can a single position exceed **15% of current balance**.
3. **Audited Risk Shortfall:** When the 15% cap binds, QuantAI executes the trade at the safer capped notional size and explicitly logs the target vs. actual dollar risk shortfall.

---

### 3. One-Sided Volatility Regime Gate
QuantAI continuously tracks a rolling 50-tick mean ($\mu_{\text{ATR}}$) and standard deviation ($\sigma_{\text{ATR}}$) of ATR:

$$Z_{\text{ATR}} = \frac{\text{ATR} - \mu_{\text{ATR}}}{\sigma_{\text{ATR}}}$$

- **High-Chaos Filter:** Blocks new entries whenever $Z_{\text{ATR}} > +2.0$ (extreme volatility / chaotic spikes).
- **One-Sided Logic:** Negative $Z_{\text{ATR}}$ (volatility compression / squeeze) is allowed through, ensuring seamless synergy with breakout setups.
- **Enforcement:** Active in **both** Swing and Scalp modes.

---

### 4. Drawdown Circuit Breaker
Protects the portfolio from cascading losing streaks:

$$\text{Current Equity} = \text{Balance} + \text{Unrealized P\&L}$$

$$\text{Peak Equity} = \max(\text{Peak Equity}, \; \text{Current Equity})$$

$$\text{Drawdown \%} = \frac{\text{Peak Equity} - \text{Current Equity}}{\text{Peak Equity}} \times 100$$

- **Halt Trigger:** When Drawdown exceeds **8.0%**, all new entry signals (both Local & AI) are immediately blocked. Auto TP/SL management remains fully operational.
- **Recovery Hysteresis:** Entries resume automatically once Drawdown recovers below **3.0%**.
- **Top-Up Integrity:** Manual demo fund additions (e.g. `+$500`) increment `Balance` and `PeakEquity` simultaneously by the exact same amount, guaranteeing that capital injections cannot artificially mask real drawdowns.

---

## 🖥 User Interface & Real-Time Monitoring

- **TradingView Pro Chart:** Integrated TradingView widget supporting `1m`, `5m`, `15m`, `1h`, `4h`, and `1D` resolutions for BTC, ETH, SOL, and BNB.
- **Signal Engine Strip:** 5 uniform indicator meters, live Z-score calculation, and 5-pip consensus LED lights.
- **Trade History Ledger:** Replaces legacy orderbook visuals with a real-time transaction ledger detailing:
  - Asset & Side (`BUY` / `SELL`, with `⚡` Scalp tags)
  - Execution timestamp
  - Filled quantity & USD position notional
  - Entry Price $\rightarrow$ Exit Price
  - Net Profit / Loss in USD and return percentage (`+X.XX%` / `-X.XX%`)
  - Exit Trigger Reason (`Take Profit`, `Stop Loss`, `AI Exit`, `Signal Exit`)
- **P&L Curve:** Real-time Chart.js interactive equity curve.
- **Execution Log:** Terminal log with color-coded tags (`BUY`, `SELL`, `AI`, `HOLD`, `ERR`).

---

## ⌨ Keyboard Shortcuts

| Shortcut Key | Action |
| :---: | :--- |
| **`S`** | **Start Bot** |
| **`X`** | **Stop Bot** |
| **`T`** | **Top-Up (+$500 Demo Capital)** |
| **`1` – `6`** | Switch Timeframe (`1m`, `5m`, `15m`, `1h`, `4h`, `1D`) |

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- Python 3.x or Node.js (for local static HTTP serving)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Running Locally
1. Clone this repository:
   ```bash
   git clone https://github.com/Maahirrrr/QuantAI.git
   cd QuantAI
   ```

2. Start a local HTTP server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Or using Node.js
   npx serve .
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
