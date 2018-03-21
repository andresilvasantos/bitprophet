module.exports = {
    version: "0.2.7",
    startTime: new Date(),
    pairs: [],
    pairsInfo: {},
    btcUSDTPair: null,
    paused: false,
    redAlert: false,
    strategies: {
        alertsrsi: {
            name: "Alerts RSI"
        },
        alertsichimoku: {
            name: "Alerts Ichimoku"
        },
        buydip: {
            name: "Buy Dip",
            buyAmountBTC: 0.005,
            profitTarget: 1.8,
            maxLoss: 1.8,
            maxTradingPairs: 6
        }
    }
}
