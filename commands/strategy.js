var vars = require(__dirname + "/../vars.js")

module.exports = {
	run: function(args, next) {
		if(args.length < 2) {
			next(null, "Name a strategy")
			return
		}

		var action = args[0]
		var strategyId = args[1]
		var strategy = null

		for(var i = 0; i < vars.strategies.length; ++i) {
			if(vars.strategies[i].id() == strategyId) {
				strategy = vars.strategies[i]
				break
			}
		}

		if(!strategy) {
			next(null, ":grey_question: No strategy found with id " + strategyId)
			return
		}

		var paperTradingStr = strategy.paperTrading() ? "[PT] " : ""

		if(action == "start") {
			if(strategy.active()) {
				next(null, paperTradingStr + strategy.name() + " already started")
				return
			}
			strategy.setActive(true)
			next(null, ":large_orange_diamond: " + paperTradingStr + strategy.name() + " started")
		}
		else if(action == "stop") {
			if(!strategy.active()) {
				next(null, paperTradingStr + strategy.name() + " already stopped")
				return
			}
			strategy.setActive(false)
			next(null, ":ghost: " + paperTradingStr + strategy.name() + " stopped")
		}
	}
}
