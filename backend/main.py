from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Active", "module": "QuantAI Statistical Engine with ML & NLP"}

# Simple NLP Keyword scoring
BEARISH_WORDS = ['fall', 'drop', 'crash', 'down', 'bear', 'sell', 'lawsuit', 'sec', 'inflation', 'rate hike', 'cut', 'slump', 'weak', 'lower']
BULLISH_WORDS = ['surge', 'jump', 'rise', 'up', 'bull', 'buy', 'growth', 'profit', 'beat', 'record', 'high', 'partnership', 'strong', 'higher']

def analyze_sentiment(news_list):
    if not news_list:
        return 0, "No recent news."
    score = 0
    analyzed = 0
    for article in news_list[:5]:
        text = (article.get('title', '') + " " + article.get('summary', '')).lower()
        if text:
            analyzed += 1
            bull_score = sum(1 for word in BULLISH_WORDS if word in text)
            bear_score = sum(1 for word in BEARISH_WORDS if word in text)
            score += (bull_score - bear_score)
    
    if analyzed == 0:
        return 0, "Neutral news volume."
        
    avg_score = score / analyzed
    if avg_score > 0.5:
        return 1, "Bullish NLP Sentiment."
    elif avg_score < -0.5:
        return -1, "Bearish NLP Sentiment."
    return 0, "Neutral NLP Sentiment."

def compute_rsi(series, window):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

@app.get("/api/analyze")
def analyze(symbol: str):
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
        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(period="90d", interval="1d")
        
        if len(df) < 20:
            return {"status": "error", "message": f"Not enough data for {yf_symbol}"}
            
        # 1. NLP Sentiment from Headlines
        sentiment_val, sentiment_reason = analyze_sentiment(ticker.news)
        
        # 2. Machine Learning Pipeline (Random Forest)
        df['RSI'] = compute_rsi(df['Close'], 14)
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        df['Return'] = df['Close'].pct_change()
        df['Vol'] = df['Return'].rolling(window=10).std()
        
        # Target: Will the next day's return be positive?
        df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
        
        ml_df = df.dropna()
        
        if len(ml_df) > 20:
            features = ['RSI', 'Return', 'Vol']
            X = ml_df[features]
            y = ml_df['Target']
            
            # Train a micro-model instantly
            clf = RandomForestClassifier(n_estimators=50, max_depth=3, random_state=42)
            clf.fit(X, y)
            
            # Predict probability of UP
            current_features = ml_df.iloc[-1][features].values.reshape(1, -1)
            prob_up = clf.predict_proba(current_features)[0][1]
        else:
            prob_up = 0.5
            
        # 3. Aggregation Logic
        current_price = float(df['Close'].iloc[-1])
        rsi = float(df['RSI'].iloc[-1]) if 'RSI' in df else 50.0
        
        signal = "HOLD"
        base_confidence = prob_up * 100
        
        # NLP Bias overriding technicals
        if sentiment_val == 1: base_confidence += 15
        elif sentiment_val == -1: base_confidence -= 15
            
        base_confidence = max(0, min(base_confidence, 100))
        
        if base_confidence > 65:
            signal = "LONG"
            confidence = int(base_confidence)
            reason = f"ML Score: {confidence}% UP | {sentiment_reason}"
        elif base_confidence < 35:
            signal = "SHORT"
            confidence = int(100 - base_confidence)
            reason = f"ML Score: {confidence}% DOWN | {sentiment_reason}"
        else:
            confidence = 50
            reason = f"ML Indecisive ({int(prob_up*100)}%) | {sentiment_reason}"

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
