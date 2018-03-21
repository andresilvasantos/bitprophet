var vars = require(__dirname + '/vars.js')
var indicators = require(__dirname + '/indicators.js')
var chatBot = require(__dirname + '/chat_bot.js')

var pairsValidation = ["1h", "5m"]
var pairsWatch = ["5m"]

module.exports = {
    checkValidWorkingPair: function(strategy, pair) {
        function setPairValid(valid) {
            if(valid) {
                if(pair.status == -1) pair.functions.addWatcherChartUpdates(pairsWatch)
                pair.status = 0
            }
            else {
                if(pair.status == 0) pair.functions.removeWatcherChartUpdates(pairsWatch)
                pair.status = -1
            }
        }

        if(pair.functions.chartsNeedUpdate(pairsValidation, 60, true)) return

        pair.lastValidCheck = Date.now()

        var chart1h = pair.functions.chart(pairsValidation[0]).ticks
        var chart5m = pair.functions.chart(pairsValidation[1]).ticks

        if(chart1h.length < 500 || chart5m.length < 500) {
            setPairValid(false)
            return
        }

        var stoch5m = indicators.stochastic(chart5m, 14, 24)
        var stoch5mAvg = indicators.average(stoch5m)
        var maxDiff5m = indicators.measureMaxDiff(chart5m, 120)

        var volume24h = 0
        for(var i = chart1h.length - 24; i < chart1h.length; ++i) {
            var high = parseFloat(chart1h[i].high)
            var low = parseFloat(chart1h[i].low)
            var avgPrice = (high - low) / 2. + low
            volume24h += parseFloat(chart1h[i].volume) * avgPrice
        }

        setPairValid(volume24h >= 100 && stoch5mAvg >= 25 && maxDiff5m < 60)
    },
    process: function(strategy, pair) {
        if(!pair.functions.chartUpdatesActive(pairsWatch)) {
            pair.functions.ensureChartUpdates(pairsWatch)
            return
        }

        var chart5m = pair.functions.chart(pairsWatch[0]).ticks

        if(chart5m.length < 500) return

        var lastClose = chart5m[chart5m.length - 1].close
        var rsi5m = indicators.rsi(chart5m, 14, 100, 1)
        rsi5m = rsi5m[0].toFixed(2)
        var stoch5m = indicators.stochastic(chart5m, 14, 3)
        stoch5m = indicators.average(stoch5m).toFixed(2)

        if(!pair.alertSent && rsi5m < 30 && stoch5m < 20) {
            chatBot.sendMessage(strategy.name() + " - " + pair.name + "@" + lastClose + " | RSI 5m: " + rsi5m + " | Stochastics 5m: " + stoch5m)
            pair.alertSent = true
        }
        else if(rsi5m > 35) {
            pair.alertSent = false
        }
    }
}
