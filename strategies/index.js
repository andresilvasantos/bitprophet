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
			paperTrading: true,
			buyAmountMarket: 0.018,
			profitTarget: 2.4,
			maxLoss: 0.8,
			maxTradingPairs: 5,
			targetMarket: "BTC"
		}
	}
}
