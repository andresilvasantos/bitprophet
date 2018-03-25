module.exports = {
    version: "0.3.3",
    startTime: new Date(),
    pairs: [],
    pairsInfo: {},
    btcUSDTPair: null,
    paused: false,
    startBTCAmount: 0,
    tradingFees: 0.0005,
    btcAnalysis: {
        price: -1,
        rsi5m: -1,
        rsi15m: -1,
        dangerZone: false
    },
    strategies: {
        alertsrsi: {
            name: "Alerts RSI"
        },
        alertsichimoku: {
            name: "Alerts Ichimoku"
        },
        buydip: {
            name: "Buy Dip",
            buyAmountBTC: 0.018,
            profitTarget: 1.8,
            maxLoss: 1.8,
            maxTradingPairs: 4,
        }
    }
}
