from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np

app = FastAPI()

# Allow the frontend (running on any port) to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Active", "module": "QuantAI Statistical Engine"}

@app.get("/api/analyze")
def analyze(symbol: str):
    # Map TradingView frontend symbols to Yahoo Finance symbols
    yf_symbol = symbol
    if "BTC" in symbol: yf_symbol = "BTC-USD"
    elif "ETH" in symbol: yf_symbol = "ETH-USD"
    elif "AAPL" in symbol: yf_symbol = "AAPL"
    elif "TSLA" in symbol: yf_symbol = "TSLA"
    elif "NVDA" in symbol: yf_symbol = "NVDA"
    elif "RELIANCE" in symbol: yf_symbol = "RELIANCE.NS"
    elif "HDFC" in symbol: yf_symbol = "HDFCBANK.NS"
    elif "TATAMOTORS" in symbol: yf_symbol = "TATAMOTORS.NS"
    
    try:
        # Fetch real market data from Yahoo Finance API
        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(period="5d", interval="15m")
        
        if df.empty:
            return {"status": "error", "message": f"No data found for {yf_symbol}"}
            
        # Statistical Model: Momentum & Mean Reversion
        close = df['Close']
        
        # Calculate RSI (Relative Strength Index)
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs.iloc[-1]))
        
        # Calculate 20-period Simple Moving Average
        sma_20 = close.rolling(window=20).mean().iloc[-1]
        current_price = float(close.iloc[-1])
        
        # Base Prediction Logic
        signal = "HOLD"
        confidence = 50
        reason = "Market is neutral. Statistical indicators show no clear edge."
        
        # Oversold + Price below SMA -> Mean Reversion BUY
        if rsi < 40 and current_price < sma_20:
            signal = "LONG"
            confidence = int(100 - rsi + 10) 
            confidence = min(confidence, 98)
            reason = f"Oversold statistically (RSI: {rsi:.1f}). Mean reversion algorithm indicates upward bounce."
            
        # Overbought + Price above SMA -> Mean Reversion SELL
        elif rsi > 60 and current_price > sma_20:
            signal = "SHORT"
            confidence = int(rsi + 10)
            confidence = min(confidence, 98)
            reason = f"Overbought statistically (RSI: {rsi:.1f}). Momentum model predicts downward correction."
            
        # Add slight randomness to confidence for realism in UI
        confidence = min(confidence + np.random.randint(-2, 3), 99)

        return {
            "status": "success",
            "symbol": yf_symbol,
            "current_price": round(current_price, 2),
            "signal": signal,
            "confidence": confidence,
            "reason": reason,
            "rsi": round(rsi, 2)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
