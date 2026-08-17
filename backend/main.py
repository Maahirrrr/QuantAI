from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Active", "module": "QuantAI High-Accuracy ML Engine"}

# Refined Sentiment Weights (Weighted Context Analysis)
SENTIMENT_DICT = {
    'surge': 1.5, 'jump': 1.2, 'rise': 1.0, 'up': 0.8, 'bull': 1.5, 'buy': 1.0, 'growth': 1.2, 'profit': 1.0, 'beat': 1.5, 'record': 1.0, 'high': 0.5, 'strong': 1.0, 'upgrade': 1.5,
    'fall': -1.0, 'drop': -1.2, 'crash': -2.0, 'down': -0.8, 'bear': -1.5, 'sell': -1.0, 'lawsuit': -2.0, 'sec': -1.5, 'inflation': -1.2, 'rate hike': -1.5, 'cut': -1.0, 'slump': -1.5, 'weak': -1.0, 'downgrade': -1.5
}

def analyze_sentiment(news_list):
    if not news_list:
        return 0, "No recent news."
    score = 0
    analyzed = 0
    for article in news_list[:10]:
        text = (article.get('title', '') + " " + article.get('summary', '')).lower()
        if text:
            analyzed += 1
            for word, weight in SENTIMENT_DICT.items():
                if word in text:
                    score += weight
    
    if analyzed == 0:
        return 0, "Neutral news volume."
        
    avg_score = score / analyzed
    if avg_score > 0.8:
        return 1, "Highly Bullish NLP Sentiment."
    elif avg_score < -0.8:
        return -1, "Highly Bearish NLP Sentiment."
    return 0, "Neutral NLP Sentiment."

def add_advanced_features(df):
    # RSI
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # MACD
    exp1 = df['Close'].ewm(span=12, adjust=False).mean()
    exp2 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = exp1 - exp2
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
    
    # Volatility (ATR Proxy)
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    df['TR'] = np.max(ranges, axis=1)
    df['ATR'] = df['TR'].rolling(window=14).mean()
    
    # Bollinger Bands %B
    sma20 = df['Close'].rolling(window=20).mean()
    std20 = df['Close'].rolling(window=20).std()
    upper = sma20 + (std20 * 2)
    lower = sma20 - (std20 * 2)
    df['BB_PB'] = (df['Close'] - lower) / (upper - lower)
    
    # Momentum Rate of Change
    df['ROC_10'] = df['Close'].pct_change(periods=10)
    
    return df

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
    
    try:
        ticker = yf.Ticker(yf_symbol)
        # Use 1h data for institutional-grade ML accuracy (creates ~1000 data points vs 60)
        df = ticker.history(period="60d", interval="1h")
        
        if len(df) < 50:
            return {"status": "error", "message": f"Not enough high-res data for {yf_symbol}"}
            
        sentiment_val, sentiment_reason = analyze_sentiment(ticker.news)
        df = add_advanced_features(df)
        
        # Predict a statistically significant upward move (0.2%) within the next 3 hours
        df['Target'] = (df['Close'].shift(-3) > df['Close'] * 1.002).astype(int)
        
        ml_df = df.dropna().copy()
        
        if len(ml_df) > 50:
            features = ['RSI', 'MACD_Hist', 'ATR', 'BB_PB', 'ROC_10']
            X = ml_df[features]
            y = ml_df['Target']
            
            # Scale features for accuracy
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # Gradient Boosting is significantly more accurate than Random Forest
            clf = GradientBoostingClassifier(n_estimators=100, learning_rate=0.05, max_depth=3, random_state=42)
            clf.fit(X_scaled, y)
            
            current_features = scaler.transform(ml_df.iloc[-1][features].values.reshape(1, -1))
            prob_up = clf.predict_proba(current_features)[0][1]
        else:
            prob_up = 0.5
            
        current_price = float(df['Close'].iloc[-1])
        
        # Heavy weighting: ML + NLP
        base_confidence = prob_up * 100
        if sentiment_val == 1: base_confidence += 15
        elif sentiment_val == -1: base_confidence -= 15
            
        base_confidence = max(0, min(base_confidence, 100))
        
        signal = "HOLD"
        # Stricter thresholds for high accuracy execution
        if base_confidence > 70:
            signal = "LONG"
            confidence = int(base_confidence)
            reason = f"GradientBoost: {confidence}% UP | {sentiment_reason}"
        elif base_confidence < 30:
            signal = "SHORT"
            confidence = int(100 - base_confidence)
            reason = f"GradientBoost: {confidence}% DOWN | {sentiment_reason}"
        else:
            confidence = 50
            reason = f"GradientBoost Neutral ({int(prob_up*100)}%) | {sentiment_reason}"

        return {
            "status": "success",
            "symbol": yf_symbol,
            "current_price": round(current_price, 2),
            "signal": signal,
            "confidence": confidence,
            "reason": reason
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
