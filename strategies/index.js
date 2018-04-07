module.exports = {
    strategies: {
        alertsrsi: {
            name: "Alerts RSI",
            targetMarket: "BTC"
        },
        alertsichimoku: {
            name: "Alerts Ichimoku",
            targetMarket: "BTC"
        },
        buydip: {
            name: "Buy Dip",
            buyAmountBTC: 0.018,
            profitTarget: 1.4,
            maxLoss: 0.8,
            maxTradingPairs: 5,
            targetMarket: "BTC"
        }
    }
}
