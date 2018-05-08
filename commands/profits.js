var vars = require(__dirname + "/../vars.js")

module.exports = {
	run: function(args, next) {
		var verbose = false
		if (args.length > 1) {
			if(args.length == 2 && (args[1] == "pairs" || args[1] == "+")) verbose = true
		}

		var totalProfit = 0
		var totalAccountProfit = 0
		var profitString = ":bar_chart: Profits\n"

		for(var i = 0; i < vars.strategies.length; ++i) {
			var strategy = vars.strategies[i]
			if(!strategy.profit() && !strategy.accountProfit()) continue

			profitString += strategy.name() + ": " + parseFloat(strategy.profit()).toFixed(2) + "% | " + parseFloat(strategy.accountProfit()).toFixed(2) + "%\n"
			totalProfit += strategy.profit()
			totalAccountProfit += strategy.accountProfit()

			if(verbose) {
				var pairs = strategy.pairs()
				for(var j = 0; j < pairs.length; ++j) {
					var pair = pairs[j]
					if(!pair.profit && !pair.accountProfit) continue
					profitString += pair.chatName + ": " + parseFloat(pair.profit).toFixed(2) + "% | " + parseFloat(pair.accountProfit).toFixed(2) + "%\n"
				}
			}
		}

		var totalBTC = vars.startBTCAmount * (totalAccountProfit / 100.)
		profitString += "Total: " + totalProfit.toFixed(2) + "% | " + totalAccountProfit.toFixed(2) + "% - " + totalBTC.toFixed(8) + "BTC"
		next(null, profitString)
	}
}
