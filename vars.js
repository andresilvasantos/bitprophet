module.exports = {
	startTime: new Date(),
	currentDay: -1,
	paused: false,
	pairs: [],
	pairsInfo: {},
	strategies: [],
	commands: [],
	startBTCAmount: 0,
	tradingFees: 0.0005,
	minTradeAmount: 0.002,
	btcAnalysis: {
		price: -1,
		rsi5m: -1,
		rsi15m: -1,
		dangerZone: false
	},
}
