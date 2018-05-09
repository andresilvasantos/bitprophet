var vars = require(__dirname + "/../vars.js")
var exchUtils = require(__dirname + "/../exchange_utils.js")

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
				if(!pair.amountToSell) continue

                if(args.length >= 3) {
                    var price = parseFloat(args[2])
                    pair.sellTarget = price
                    pair.forceSell = true
                    next(null, ":thumbsup: Force sell triggered for " + pair.chatName + "@" +
                        parseFloat(exchUtils.fixPrice(pair.name, pair.sellTarget)).toFixed(8))
                }
                else {
                    exchUtils.tokenPrice(pair.name, (error, price) => {
                        if(error) {
                            next('Error fetching prices for ' + pair.chatName);
                            console.log("Error fetching price for", pair.name, error)
                            return
                        }
                        pair.sellTarget = parseFloat(price)
                        pair.forceSell = true
                        next(null, ":thumbsup: Force sell triggered for " + pair.chatName + "@" + pair.sellTarget)
                    })
                }
				return
            }
        }

		next(null, ":grey_question: " + pairName + " - no trading pair found")
	}
}
