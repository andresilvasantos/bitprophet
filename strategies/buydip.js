/*
Buy Dip

Valid pairs:
- Volume 24h > 100BTC
- Average of stochastics for the last 11 periods of 1h interval > 30
- Average of stochastics for the last 24 periods of 5m interval >= 20
- Max percentual difference for the last 120 periods of 5m interval (10 hours) < 100% - to avoid pump&dumps

Strategy:

    Buy if:
    - Stochastics 5m interval < 20
        - RSI 5m interval < 26
        - Stochastics 15m interval < 15
        or
        - RSI 5m interval < 21
        - Stochastics 15m interval < 30

    Sell if:
    - Profit target reached
    - Stop loss triggered

    Trailing profits are active, stop loss will be adjusted with a distance to the price of 0.6%

*/


var bp = require("../bitprophet.js")

var intervalsValidation = ["1h", "5m"]
var intervalsWatch = ["15m", "5m"]

module.exports = {
	resetPairCustomData: function(pair) {
		pair.tryBuyTimestamp = null
		pair.trySellTimestamp = null
		pair.warningSilent = false
	},
	checkValidWorkingPair: function(strategy, pair) {
		function setPairValid(valid) {
			if(valid) {
				if(pair.status == -1) pair.functions.addWatcherChartUpdates(intervalsWatch)
				pair.status = 0
			}
			else {
				if(pair.status == 0) pair.functions.removeWatcherChartUpdates(intervalsWatch)
				pair.status = -1
			}
		}

		if(pair.functions.chartsNeedUpdate(intervalsValidation, 60, true)) return

		pair.lastValidCheck = Date.now()

		var chart1h = pair.functions.chart("1h").ticks
		var chart5m = pair.functions.chart("5m").ticks

		if(chart1h.length < 500 || chart5m.length < 500) {
			setPairValid(false)
			return
		}

		var stoch1h = bp.indicators.stochastic(chart1h, 14, 11)
		var stoch1hAvg = bp.indicators.average(stoch1h)
		var stoch5m = bp.indicators.stochastic(chart5m, 14, 24)
		var stoch5mAvg = bp.indicators.average(stoch5m)
		var maxDiff5m = bp.indicators.measureMaxDiff(chart5m, 120)
		var volume24h = bp.indicators.volume24h(chart1h, 60)

		setPairValid(volume24h >= 100 && stoch1hAvg > 30 && stoch5mAvg >= 20 && maxDiff5m < 100)
	},
	process: function(strategy, pair) {
		if(!pair.functions.chartUpdatesActive(intervalsWatch)) {
			pair.functions.ensureChartUpdates(intervalsWatch)
			return
		}

		var order = strategy.order(pair.name, "BUY")
		if(order && order.partFill == 1) {
			if(pair.status == 1) pair.status = 2
			order.waiting = false
		}

		order = strategy.order(pair.name, "SELL")
		if(order && order.partFill == 1) {
			pair.status = 4
			order.waiting = false
		}

		switch(pair.status) {
		case 0:
			this.initialAnalysis(strategy, pair)
			break
		case 1:
			this.waitForBuyOrder(strategy, pair)
			break
		case 2:
			this.setupSellOrder(strategy, pair)
			break
		case 3:
			this.manageSellOrder(strategy, pair)
			break
		case 4:
		default:
			strategy.tradeFinished(pair)
			break
		}
	},
	initialAnalysis: function(strategy, pair) {
		function placeOrder(price) {
			if(pair.tryBuyTimestamp && Date.now() - pair.tryBuyTimestamp < 10 * 1000) return
			pair.tryBuyTimestamp = Date.now()

			strategy.buy(pair, parseFloat(price).toFixed(8), strategy.buyAmountMarket(), function(error, order) {
				if(error) {
					console.log("Error placing buy order", pair.name, error)
					return
				}

				strategy.sendMessage(pair, "trading started", "beginner")

				pair.entryPrice = order.price
				pair.sellTarget = pair.entryPrice * (1 + strategy.profitTarget())

				if(order.partFill >= 1) {
					pair.status = 2
				}
				else {
					pair.warningSilent = false
					pair.status++
				}
			})
		}

		var chart15m = pair.functions.chart(intervalsWatch[0]).ticks
		var chart5m = pair.functions.chart(intervalsWatch[1]).ticks

		if(chart15m.length < 500 || chart5m.length < 500) return

		var lastClose = parseFloat(chart5m[chart5m.length - 1].close)
		var rsi5m = bp.indicators.rsi(chart5m, 14, 100, 1)

		var stoch15m = bp.indicators.stochastic(chart15m, 14, 3)
		var stoch5m = bp.indicators.stochastic(chart5m, 14, 3)
		rsi5m = rsi5m[0]
		stoch15m = bp.indicators.average(stoch15m)
		stoch5m = bp.indicators.average(stoch5m)

		if(stoch5m < 20 && ((rsi5m < 26 && stoch15m < 15) || (rsi5m < 21 && stoch15m < 30))) {
			placeOrder(lastClose)
		}
	},
	waitForBuyOrder: function(strategy, pair) {
		var order = strategy.order(pair.name, "BUY")
		if(!order) {
			pair.status--
			return
		}

		//Wait 3min for order to be traded
		var diffTime = Date.now() - order.timestamp

		if(diffTime > 3 * 60 * 1000 || bp.vars.btcAnalysis.dangerZone) {
			//var filledAmount = order.amount * pair.partFill
			var boughtPart = order.partFill > 0
			var enoughForNewOrder = order.partFill * strategy.buyAmountMarket() >= bp.vars.minTradeAmount

			if(boughtPart && !enoughForNewOrder) {
				if(!pair.warningSilent) {
					pair.warningSilent = true
					strategy.sendMessage(pair, "can't cancel order, amount bought not enough to be sold", "warning")
				}
				return
			}

			strategy.cancelOrder(pair, order.id, function(error) {
				if(error) {
					console.log("Error canceling buy order", error)
					return
				}

				if(boughtPart) {
					pair.status++
				}
				else {
					pair.tryBuyTimestamp = Date.now()
					pair.status--
				}
			})
		}
	},
	setupSellOrder: function(strategy, pair) {
		strategy.sell(pair, pair.sellTarget, pair.amountToSell, function(error, order) {
			if(error) {
				console.log("Error placing sell order", pair.name, error)
				return
			}

			if(order.partFill >= 1) {
				pair.status = 4
			}
			else {
				pair.stopLoss.stopPrice = pair.entryPrice * (1 - strategy.maxLoss() * 0.9)
				pair.stopLoss.sellPrice = pair.entryPrice * (1 - strategy.maxLoss())
				pair.warningSilent = false
				pair.status++
			}
		})
	},
	manageSellOrder: function(strategy, pair) {
		var order = strategy.order(pair.name, "SELL")
		if(!order && !pair.forceSell) {
			pair.status--
			return
		}

		function recreateSellOrder() {
			strategy.cancelOrder(pair, order ? order.id : null, function(error) {
				if(error) {
					console.log("Error canceling sell order", pair.name, error)
				}

				strategy.sell(pair, pair.sellTarget, pair.amountToSell, function(error, order) {
					if(error) {
						console.log("Error creating sell order", pair.name, error)
						return
					}

					if(order.partFill >= 1) {
						pair.status = 4
					}
				})
			})
		}

		if(pair.forceSell) {
			recreateSellOrder()
			pair.forceSell = false
			return
		}

        var chart5m = pair.functions.chart(intervalsWatch[1]).ticks
        var lastClose = parseFloat(chart5m[chart5m.length - 1].close)

        var activateStopLoss = strategy.manageStopLoss(pair, lastClose, 2, 0.006)
        if(activateStopLoss) recreateSellOrder()
	}
}
