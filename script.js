const scanBtn = document.getElementById('scanBtn');
const tableBody = document.getElementById('tableBody');
const updateTimeSpan = document.getElementById('updateTime');

const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT'];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function calcSMA(data, period) {
    let sma = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j];
        }
        sma.push(sum / period);
    }
    return sma;
}

function calcBollingerBands(closingPrices) {
    const period = 20;
    if (closingPrices.length < period) return null;
    
    const smaHistory = calcSMA(closingPrices, period);
    const lastSma = smaHistory[smaHistory.length - 1];
    
    const slice = closingPrices.slice(-period);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - lastSma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
        upper: lastSma + (2 * stdDev),
        middle: lastSma,
        lower: lastSma - (2 * stdDev)
    };
}

function calcRSI(closingPrices) {
    const period = 14;
    if (closingPrices.length <= period) return 50; 

    let gains = [];
    let losses = [];

    for (let i = 1; i < closingPrices.length; i++) {
        let diff = closingPrices[i] - closingPrices[i - 1];
        if (diff >= 0) {
            gains.push(diff);
            losses.push(0);
        } else {
            gains.push(0);
            losses.push(Math.abs(diff));
        }
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < gains.length; i++) {
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function evaluateSignal(price, rsi, bb) {
    if (!bb) return '<span class="badge neutral">No Data</span>';
    
    if (price <= bb.lower && rsi < 30) {
        return `<span class="badge buy">🟢 BUY (RSI: ${rsi.toFixed(1)})</span>`;
    } else if (price >= bb.upper && rsi > 80) {
        return `<span class="badge sell">🔴 SELL (RSI: ${rsi.toFixed(1)})</span>`;
    }
    
    return `<span class="badge neutral">Hold (RSI: ${rsi.toFixed(1)})</span>`;
}

async function runTechnicalScanner() {
    tableBody.innerHTML = `<tr><td colspan="5" class="loading">Parsing chart metrics from Binance network...</td></tr>`;
    
    let rowsHtml = '';
    
    for (const symbol of symbols) {
        try {
            let currentPrice = 0;
            let signals = {};
            const timeframes = ['15m', '1h', '4h'];

            for (const tf of timeframes) {
                const res = await fetch(`https://binance.com{symbol}&interval=${tf}&limit=50`);
                
                if (!res.ok) throw new Error("API Limit");
                
                const klines = await res.json();
                
                // FIXED CRITICAL LINE: target index [4] explicitly to read closing numbers
                const closes = klines.map(k => parseFloat(k[4])); 
                const lastPrice = closes[closes.length - 1];
                currentPrice = lastPrice; 

                const rsiVal = calcRSI(closes);
                const bbVal = calcBollingerBands(closes);
                
                signals[tf] = evaluateSignal(lastPrice, rsiVal, bbVal);
                
                // Add a robust 300ms pause to ensure smooth data retrieval
                await sleep(300);
            }

            const cleanName = symbol.replace('USDT', '');
            rowsHtml += `
                <tr>
                    <td class="coin-cell">
                        <div>
                            <span class="coin-name">${cleanName}</span>
                            <span class="coin-symbol">USDT Spot</span>
                        </div>
                    </td>
                    <td><strong>$${currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                    <td>${signals['15m']}</td>
                    <td>${signals['1h']}</td>
                    <td>${signals['4h']}</td>
                </tr>
            `;
            
            // Progressive interface loading updates
            tableBody.innerHTML = rowsHtml + `<tr><td colspan="5" class="loading" style="font-size:0.8rem;">Calculating structural indicators...</td></tr>`;
            
        } catch (err) {
            console.error(err);
            const cleanName = symbol.replace('USDT', '');
            rowsHtml += `
                <tr>
                    <td><span class="coin-name">${cleanName}</span></td>
                    <td colspan="4" class="error">Data processing dropped due to network threshold protection.</td>
                </tr>
            `;
            tableBody.innerHTML = rowsHtml;
            // Sleep longer on error to clear rate limits
            await sleep(1000);
        }
    }

    tableBody.innerHTML = rowsHtml;
    const now = new Date();
    updateTimeSpan.textContent = now.toLocaleTimeString() + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
}

scanBtn.addEventListener('click', runTechnicalScanner);
window.addEventListener('DOMContentLoaded', runTechnicalScanner);
