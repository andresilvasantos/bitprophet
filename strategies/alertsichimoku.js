var bp = require("../bitprophet.js")

var intervalsValidation = ["1h"]
var intervalsWatch = ["1h", "15m"]

module.exports = {
	resetPairCustomData: function(pair) {
		pair.alertSent1h = false
		pair.alertSent15m = false
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

		if(chart1h.length < 500) {
			setPairValid(false)
			return
		}

		var volume24h = bp.indicators.volume24h(chart1h, 60)

		setPairValid(volume24h >= 100)
	},
	process: function(strategy, pair) {
		if(!pair.functions.chartUpdatesActive(intervalsWatch)) {
			pair.functions.ensureChartUpdates(intervalsWatch)
			return
		}

		var chart1h = pair.functions.chart(intervalsWatch[0]).ticks
		var chart15m = pair.functions.chart(intervalsWatch[1]).ticks

		if(chart1h.length < 500 || chart15m.length < 500) return

		var lastClose = parseFloat(chart1h[chart1h.length - 1].close)

		var prevClose_1h = parseFloat(chart1h[chart1h.length - 2].close)
		var ichimoku1h = bp.indicators.ichimoku(chart1h, 10, 30, 60, 30)
		ichimoku1h = ichimoku1h[0]
		var ichiLead1_1h = ichimoku1h[2]
		var ichiLead2_1h = ichimoku1h[3]

		var prevClose_15m = parseFloat(chart15m[chart15m.length - 2].close)
		var ichimoku15m = bp.indicators.ichimoku(chart15m, 10, 30, 60, 30)
		ichimoku15m = ichimoku15m[0]
		var ichiLead1_15m = ichimoku15m[2]
		var ichiLead2_15m = ichimoku15m[3]

		if(!pair.alertSent1h && lastClose > ichiLead1_1h && lastClose > ichiLead2_1h && (prevClose_1h < ichiLead1_1h || prevClose_1h < ichiLead2_1h)) {
			strategy.sendMessage(pair, "@" + lastClose + " crossed 1h cloud", "information_source")
			pair.alertSent1h = true
		}
		else if(pair.alertSent1h && ((lastClose < ichiLead1_1h || lastClose < ichiLead2_1h) || (prevClose_1h > ichiLead1_1h && prevClose_1h > ichiLead2_1h))) {
			pair.alertSent1h = false
		}

		if(!pair.alertSent15m && lastClose > ichiLead1_15m && lastClose > ichiLead2_15m && (prevClose_15m < ichiLead1_15m || prevClose_15m < ichiLead2_15m)) {
			strategy.sendMessage(pair, "@" + lastClose + " crossed 15m cloud", "information_source")
			pair.alertSent15m = true
		}
		else if(pair.alertSent15m && ((lastClose < ichiLead1_15m || lastClose < ichiLead2_15m) || (prevClose_15m > ichiLead1_15m && prevClose_15m > ichiLead2_15m))) {
			pair.alertSent15m = false
		}
	}
}
