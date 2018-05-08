var vars = require(__dirname + "/../vars.js")
var exchUtils = require(__dirname + "/../exchange_utils.js")

module.exports = {
	run: function(args, next) {
		var leftPairsStr = ""
		for(var i = 0; i < vars.strategies.length; ++i) {
			var strategy = vars.strategies[i]
			var pairs = strategy.tradingPairs()

			var strategyStr = ""

			for(var j = 0; j < pairs.length; ++j) {
				var pair = pairs[j]
				if(!pair.amountToSell) continue

				var totalBought = strategy.buyTradedInfo(pair).amountMarketPrice
				var totalSold = strategy.sellTradedInfo(pair).amountMarketPrice
				var sellCurrentPrice = totalSold + (pair.functions.lastPrice() * pair.amountToSell)
				var currentProfit = (sellCurrentPrice - totalBought) / totalBought * 100

				var currentAccountProfit = 0
				if(!strategy.paperTrading()) {
					var fees = (sellCurrentPrice + totalBought) * vars.tradingFees
					currentAccountProfit = (sellCurrentPrice - totalBought - fees) / vars.startBTCAmount * 100
				}

				var sellTarget = ""
				if(pair.sellTarget > 0) {
					var sellTargetPercentage = (pair.functions.lastPrice() - pair.sellTarget) / pair.sellTarget * 100
					sellTarget = " -> " + exchUtils.fixPrice(pair.name, parseFloat(pair.sellTarget).toFixed(8)) + "[" + sellTargetPercentage.toFixed(2) + "%]"
				}

				var spacer = strategyStr.length ? "\n" : ""
				strategyStr += spacer + pair.chatName + " " + pair.functions.lastPrice() + "[" + currentProfit.toFixed(2) + "% | " +
                    currentAccountProfit.toFixed(2) + "%]" + sellTarget
			}

			if(strategyStr.length) {
				var paperTradingStr = strategy.paperTrading() ? "[PT] " : ""
				strategyStr = ":barber: " + paperTradingStr + strategy.name() + ":\n" + strategyStr
				leftPairsStr += strategyStr + "\n"
			}
		}
		if(!leftPairsStr.length) leftPairsStr = ":ok_hand: Nothing left to sell."
		next(null, leftPairsStr)
	}
}
