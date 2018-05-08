var vars = require(__dirname + "/../vars.js")

module.exports = {
	run: function(args, next) {
		var strategyId = null
		if(args.length == 2) strategyId = args[1]

		if(strategyId) {
			for(var i = 0; i < vars.strategies.length; ++i) {
				let strategy = vars.strategies[i]
				if(strategy.id() == strategyId) {
					var messageTrading = ""
					var messageValid = ""

					var tradingPairs = strategy.tradingPairs()
					var tradingPairNames = []
					for(let i = 0; i < tradingPairs.length; ++i) {
						var tradingPair = tradingPairs[i]
						tradingPairNames.push(tradingPair.chatName)
					}

					var validPairs = strategy.validPairs()
					var validPairNames = []
					for(let i = 0; i < validPairs.length; ++i) {
						var validPair = validPairs[i]
						validPairNames.push(validPair.chatName)
					}

					tradingPairNames.sort()
					validPairNames.sort()

					for(let i = 0; i < tradingPairNames.length; ++i) {
						if(messageTrading.length) messageTrading += "\n"
						messageTrading += tradingPairNames[i]
					}

					for(let i = 0; i < validPairNames.length; ++i) {
						if(messageValid.length) messageValid += "\n"
						messageValid += validPairNames[i]
					}

					if(messageTrading.length) messageTrading = "Trading Pairs [" + tradingPairNames.length + "]:\n" + messageTrading + "\n"
					if(messageValid.length) messageValid = "Valid Pairs [" + validPairNames.length + "]:\n" + messageValid

					next(null, ":page_with_curl: " + strategy.name() + "\n" + messageTrading + messageValid)
					return
				}
			}

			next(null, ":grey_question: No strategy found with id " + strategyId)
			return
		}
		else {
			var messageStarted = ""
			var messageStopped = ""

			for(let i = 0; i < vars.strategies.length; ++i) {
				let strategy = vars.strategies[i]
				var paperTradingStr = strategy.paperTrading() ? "[PT] " : ""
				var strategyMsg = "." + paperTradingStr + strategy.name() + " (" + strategy.id() + ")" + " " + strategy.validPairs().length + ", " + strategy.tradingPairs().length
				if(strategy.active()) {
					if(messageStarted.length) messageStarted += "\n"
					messageStarted += strategyMsg
				}
				else {
					if(messageStopped.length) messageStopped += "\n"
					messageStopped += strategyMsg
				}
			}

			if(messageStarted.length) messageStarted = "Started:\n" + messageStarted + "\n"
			if(messageStopped.length) messageStopped = "Stopped:\n" + messageStopped

			next(null, ":page_with_curl: Strategies\n" + messageStarted + messageStopped)
			return
		}

	}
}
