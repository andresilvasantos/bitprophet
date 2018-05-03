var bp = require("../bitprophet.js")

var intervalsValidation = ["1h", "5m"]
var intervalsWatch = ["5m"]

module.exports = {
	resetPairCustomData: function(pair) {
		pair.alertSent = false
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

		var chart1h = pair.functions.chart(intervalsValidation[0]).ticks
		var chart5m = pair.functions.chart(intervalsValidation[1]).ticks

		if(chart1h.length < 500 || chart5m.length < 500) {
			setPairValid(false)
			return
		}

		var stoch5m = bp.indicators.stochastic(chart5m, 14, 24)
		var stoch5mAvg = bp.indicators.average(stoch5m)
		var maxDiff5m = bp.indicators.measureMaxDiff(chart5m, 120)
		var volume24h = bp.indicators.volume24h(chart1h, 60)

		setPairValid(volume24h >= 100 && stoch5mAvg >= 25 && maxDiff5m < 60)
	},
	process: function(strategy, pair) {
		if(!pair.functions.chartUpdatesActive(intervalsWatch)) {
			pair.functions.ensureChartUpdates(intervalsWatch)
			return
		}

		var chart5m = pair.functions.chart(intervalsWatch[0]).ticks

		if(chart5m.length < 500) return

		var lastClose = chart5m[chart5m.length - 1].close
		var rsi5m = bp.indicators.rsi(chart5m, 14, 100, 1)
		rsi5m = rsi5m[0].toFixed(2)
		var stoch5m = bp.indicators.stochastic(chart5m, 14, 3)
		stoch5m = bp.indicators.average(stoch5m).toFixed(2)

		if(!pair.alertSent && rsi5m < 30 && stoch5m < 20) {
			strategy.sendMessage(pair, "@" + lastClose + " | RSI 5m: " + rsi5m + " | Stochastics 5m: " + stoch5m, "information_source")
			pair.alertSent = true
		}
		else if(rsi5m > 35) {
			pair.alertSent = false
		}
	}
}
