var vars = require(__dirname + "/../vars.js")

module.exports = {
	run: function(args, next) {
		if(args.length < 2) {
			next(null, "Name a token")
			return
		}
		var pairName = args[1]
		pairName = pairName.toUpperCase()

		for(var i = 0; i < vars.strategies.length; ++i) {
			var strategy = vars.strategies[i]
			var pairs = strategy.tradingPairs()

			for(var j = 0; j < pairs.length; ++j) {
				var pair = pairs[j]
				if(pair.token != pairName && pair.name != pairName) continue
				next(":thumbsup: Trade canceled for " + pair.chatName)
				strategy.resetPairData(pair.name)
				return
			}
		}

		next(null, ":grey_question: " + pairName + " - no trading pair found")
	}
}
