# QuantAI — Quantitative & AI-Powered Trading Engine

![QuantAI Banner](https://img.shields.io/badge/QuantAI-v15.0-00c076?style=for-the-badge&logo=probot&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-blue?style=for-the-badge)
![Feed](https://img.shields.io/badge/Data%20Feed-Binance%20Spot%20Live-F0B90B?style=for-the-badge&logo=binance&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

> ⚠️ **DISCLAIMER & SIMULATION NOTICE**
> **QuantAI operates exclusively as a simulated paper-trading engine.** All balances, orders, execution fills, and P&L metrics are virtual demo currency. **Only the price ticker and candle data are sourced live from Binance Spot REST APIs.**

---

## 📑 Table of Contents
1. [Architectural Overview](#-architectural-overview)
2. [Real Market Data Feed (Binance Spot)](#-real-market-data-feed-binance-spot)
3. [Trading Strategies & Decision Engines](#-trading-strategies--decision-engines)
   - [Swing Mode (5-Signal Ensemble + Claude AI)](#1-swing-mode-8s-cycle)
   - [Scalp Mode (Fast Multi-Factor Local Engine)](#2-scalp-mode-⚡-2s-cycle)
4. [Realistic Execution & Market Friction](#-realistic-execution--market-friction)
   - [Exchange Trading Fees (0.075% per side)](#1-exchange-trading-fees-0075-per-side)
   - [Dynamic Slippage Model](#2-dynamic-slippage-model)
   - [Anti-Whipsaw Cooldown (15-second pause)](#3-anti-whipsaw-cooldown-15-second-pause)
5. [Risk Management Framework](#-risk-management-framework)
   - [Wired Half-Kelly Position Sizing](#1-wired-half-kelly-position-sizing)
   - [Regime-Aware TP/SL Distances](#2-regime-aware-tpsl-distances)
   - [Per-Asset Volatility Profiles (BTC, ETH, SOL, BNB)](#3-per-asset-volatility-profiles)
   - [Drawdown Circuit Breaker & Volatility Gate](#4-drawdown-circuit-breaker--volatility-gate)
6. [Keyboard Shortcuts](#-keyboard-shortcuts)
7. [Getting Started & Local Setup](#-getting-started--local-setup)

---

## 🏛 Architectural Overview

```
                              ┌────────────────────────────────────────┐
                              │       LIVE BINANCE REST API FEED       │
                              │    (Real-time Ticker & 1m Klines)      │
                              └──────────────────┬─────────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
             [ SWING MODE (8s) ]                               [ SCALP MODE (2s) ]
            5-Signal Mathematical                             Fast Local Engine
                 Ensemble                                   (EMAs, RSI7, MACD, Z)
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
             │                RISK, REGIME & SIZING ENGINE                     │
             │  • Wired Half-Kelly Sizing (0.5% - 3.0% risk)                  │
             │  • Non-negotiable 15% Max Equity Notional Hard Ceiling         │
             │  • Regime-Aware TP/SL: Widens in high ATR, tightens in low ATR  │
             │  • One-Sided Volatility Gate (Blocks if ATR Z > +2.2)          │
             │  • Drawdown Circuit Breaker (8% pause, 3% reset)               │
             │  • 15s Anti-Whipsaw Cooldown after 3 consecutive losses        │
             └────────────────────────────────┬────────────────────────────────┘
                                              │
                                              ▼
                                 [ REALISTIC SIMULATION ]
                       • 0.075% Maker/Taker Fees Deducted On Entry & Exit
                       • ATR & Size Scaled Dynamic Slippage
                       • Multi-Stage Trailing Profit Locks (BE / +0.14% / +0.35%)
```

---

## 🌐 Real Market Data Feed (Binance Spot)

1. **Live REST Ticker Polling:** Every 2-3 seconds, QuantAI polls `https://api.binance.com/api/v3/ticker/price?symbol={PAIR}USDT` with automatic fallback to `https://data-api.binance.vision`.
2. **Instant 100-Candle Preloading:** On pair selection (`BTC`, `ETH`, `SOL`, `BNB`), the engine preloads 100 1-minute historical candles from Binance Klines to compute all indicators (`EMA 5/13/20/34/50`, `RSI`, `ATR`, `MACD`, `Z-Score`) immediately against real market structure.
3. **Visual & Trading Agreement:** Sourced from the exact same Binance Spot market as the embedded TradingView chart widget, ensuring complete visual price parity.
4. **Resilient Failover:** If network or rate limits occur, the live badge switches to `Feed Stale`, holds the last valid price, and retries with backoff without crashing or resorting to synthetic random walks.

---

## 📊 Trading Strategies & Decision Engines

### 1. Swing Mode (8s Cycle)
Evaluates a 5-component quantitative ensemble:
- **Triple EMA (5, 20, 50):** Trend alignment (`EMA5 > EMA20 > EMA50`).
- **RSI (14):** Oversold dip buying (`< 36-38`) or momentum trend (`< 55`); penalizes overbought (`> 64-68`).
- **ATR Volatility (14):** Validates compressed volatility setups relative to the asset's benchmark.
- **MACD (12, 26, 9):** Positive bullish cross above signal and zero lines.
- **Mean Reversion Z-Score (20p):** Discount stretch entry ($Z < -1.5$).
- **Consensus Execution:** 5/5 triggers instant **Local BUY**; 4/5 triggers **Claude AI** confirmation; 0/5 triggers instant **Local SELL**.

### 2. Scalp Mode ⚡ (2s Cycle)
- **Ultra-Fast Local Scoring (0 to 100%):** Combines `EMA 5/13/34` stack, `RSI(7)` optimal entry window (42-56), micro-MACD velocity, and price action above SMA20.
- **Dynamic Conviction Sizing:** High-conviction setups allocate 12%-15% balance; standard setups allocate 6%-9%; conservative setups allocate 3%-5%.
- **Multi-Stage Trailing Profit Locks:**
  - **Stage 1 (+0.10% profit):** Stop-Loss moves to **+0.02% Break-Even (Risk-Free)**.
  - **Stage 2 (+0.22% profit):** Locks in **+0.14% guaranteed profit**.
  - **Stage 3 (+0.48% profit):** Locks in **+0.35% profit**.
  - **TP Target:** Full profit-taking at regime-calculated $1.8:1 - 2.4:1$ R:R.

---

## 💸 Realistic Execution & Market Friction

### 1. Exchange Trading Fees (0.075% per side)
- On Entry: $\text{Entry Fee} = \text{Position Size} \times 0.00075$ (deducted from cash balance).
- On Exit: $\text{Exit Fee} = \text{Exit Notional} \times 0.00075$ (deducted from proceeds).
- Trade ledger displays exact Net P&L after all exchange commissions.

### 2. Dynamic Slippage Model
$$\text{Slippage \%} = \text{clamp}\left((\text{ATR \%} \times 0.02) + \left(\frac{\text{Position Size}}{\text{Balance}} \times 0.0002\right) + \text{jitter}, \; 0.01\%, \; 0.08\%\right)$$
- BUY orders fill slightly above the market price; SELL orders fill slightly below.

### 3. Anti-Whipsaw Cooldown (15-Second Pause)
- If 3 consecutive losses occur, QuantAI automatically triggers a 15-second entry cooldown (`S.cooldownUntil`) to prevent churning during choppy sideways ranges.

---

## 🛡 Risk Management Framework

### 1. Wired Half-Kelly Position Sizing
Position sizing is directly wired to historical expectancy:

$$\text{Kelly Fraction: } f^* = W - \frac{1 - W}{R}$$

$$\text{Risk Target: } \text{risk\_pct} = \text{clamp}(0.5 \times f^* \times \text{conviction}, \; 0.5\%, \; \text{Cap}_{\text{max}})$$

$$\text{Position Size (USD): } \text{size} = \min\left(\frac{\text{Balance} \times \text{risk\_pct}}{\text{SL Distance}} \times \text{Price}, \; \text{Balance} \times 0.15\right)$$

### 2. Regime-Aware TP/SL Distances
- **High Volatility ($Z_{\text{ATR}} > +0.8$):** Widens SL by $1.25\times$ and TP by $2.4\times$ (2.4:1 R:R).
- **Low Volatility ($Z_{\text{ATR}} < -0.5$):** Tightens SL by $0.85\times$ and TP by $1.8\times$ (1.8:1 R:R).

### 3. Per-Asset Volatility Profiles
| Asset | Base ATR Benchmark | RSI Oversold / Overbought | Min Stop Floor (Swing / Scalp) | Fee Rate |
| :--- | :---: | :---: | :---: | :---: |
| **BTC** | 0.08% | 36 / 64 | 0.40% / 0.20% | 0.075% |
| **ETH** | 0.12% | 35 / 65 | 0.50% / 0.25% | 0.075% |
| **SOL** | 0.25% | 33 / 68 | 0.80% / 0.40% | 0.075% |
| **BNB** | 0.10% | 36 / 63 | 0.45% / 0.22% | 0.050% |

### 4. Drawdown Circuit Breaker & Volatility Gate
- **Drawdown Breaker:** Pauses new entries if drawdown from peak equity exceeds **8.0%**; automatically resumes when recovered below **3.0%**.
- **One-Sided Volatility Gate:** Blocks entries only when $Z_{\text{ATR}} > +2.2$ (hyper-chaotic regime). Allows volatility squeezes ($Z < 0$) through.

---

## ⌨ Keyboard Shortcuts

| Key | Action |
| :---: | :--- |
| **`S`** | **Start Bot** |
| **`X`** | **Stop Bot** |
| **`T`** | **Top-Up (+$500 Demo Balance)** |
| **`1` – `6`** | Switch Resolution (`1m`, `5m`, `15m`, `1h`, `4h`, `1D`) |

---

## 🚀 Getting Started & Local Setup

```bash
# Clone the repository
git clone https://github.com/Maahirrrr/QuantAI.git
cd QuantAI

# Run local HTTP server
python -m http.server 8000

# Open in your browser
http://localhost:8000
```
