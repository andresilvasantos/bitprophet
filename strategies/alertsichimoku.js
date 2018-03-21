var vars = require('../vars.js')
var indicators = require('../indicators.js')
var chatBot = require('../chat_bot.js')

var pairsValidation = ["1h"]
var pairsWatch = ["1h", "15m", "5m"]

module.exports = {
    checkValidWorkingPair: function(strategy, pair) {
        function setPairValid(valid) {
            if(valid) {
                if(pair.status == -1) pair.functions.addWatcherChartUpdates(["1h", "15m", "5m"])
                pair.status = 0
            }
            else {
                if(pair.status == 0) pair.functions.removeWatcherChartUpdates(["1h", "15m", "5m"])
                pair.status = -1
            }
        }

        if(pair.functions.chartsNeedUpdate(pairsValidation, 60, true)) return

        pair.lastValidCheck = Date.now()

        var chart1h = pair.functions.chart(pairsValidation[0]).ticks

        if(chart1h.length < 500) {
            setPairValid(false)
            return
        }

        var volume24h = 0
        for(var i = chart1h.length - 24; i < chart1h.length; ++i) {
            var high = parseFloat(chart1h[i].high)
            var low = parseFloat(chart1h[i].low)
            var avgPrice = (high - low) / 2. + low
            volume24h += parseFloat(chart1h[i].volume) * avgPrice
        }

        setPairValid(volume24h >= 100)
    },
    process: function(strategy, pair) {
        if(!pair.functions.chartUpdatesActive(pairsWatch)) {
            pair.functions.ensureChartUpdates(pairsWatch)
            return
        }

        var chart1h = pair.functions.chart(pairsWatch[0]).ticks
        var chart15m = pair.functions.chart(pairsWatch[1]).ticks
        var chart5m = pair.functions.chart(pairsWatch[2]).ticks

        if(chart1h.length < 500 || chart15m.length < 500 || chart5m.length < 500) return

        var lastClose = parseFloat(chart1h[chart1h.length - 1].close)

        var prevClose_1h = parseFloat(chart1h[chart1h.length - 2].close)
        var ichimoku1h = indicators.ichimoku(chart1h, 10, 30, 60, 30, 30)
        ichimoku1h = ichimoku1h[0]
        var ichiLead1_1h = ichimoku1h[2]
        var ichiLead2_1h = ichimoku1h[3]

        var prevClose_15m = parseFloat(chart15m[chart15m.length - 2].close)
        var ichimoku15m = indicators.ichimoku(chart15m, 10, 30, 60, 30, 30)
        ichimoku15m = ichimoku15m[0]
        var ichiLead1_15m = ichimoku15m[2]
        var ichiLead2_15m = ichimoku15m[3]

        var prevClose_5m = parseFloat(chart5m[chart5m.length - 2].close)
        var ichimoku5m = indicators.ichimoku(chart5m, 10, 30, 60, 30, 30)
        ichimoku5m = ichimoku5m[0]
        var ichiLead1_5m = ichimoku5m[2]
        var ichiLead2_5m = ichimoku5m[3]

        if(!pair.alertSent1h && lastClose > ichiLead1_1h && lastClose > ichiLead2_1h && (prevClose_1h < ichiLead1_1h || prevClose_1h < ichiLead2_1h)) {
            chatBot.sendMessage(strategy.name() + " - " + pair.name + "@" + lastClose + " crossed 1h cloud")
            pair.alertSent1h = true
        }
        else if(pair.alertSent1h && ((lastClose < ichiLead1_1h || lastClose < ichiLead2_1h) || (prevClose_1h > ichiLead1_1h && prevClose_1h > ichiLead2_1h))) {
            pair.alertSent1h = false
        }

        if(!pair.alertSent15m && lastClose > ichiLead1_15m && lastClose > ichiLead2_15m && (prevClose_15m < ichiLead1_15m || prevClose_15m < ichiLead2_15m)) {
            chatBot.sendMessage(strategy.name() + " - " + pair.name + "@" + lastClose + " crossed 15m cloud")
            pair.alertSent15m = true
        }
        else if(pair.alertSent15m && ((lastClose < ichiLead1_15m || lastClose < ichiLead2_15m) || (prevClose_15m > ichiLead1_15m && prevClose_15m > ichiLead2_15m))) {
            pair.alertSent15m = false
        }

        if(!pair.alertSent5m && lastClose > ichiLead1_5m && lastClose > ichiLead2_5m && (prevClose_5m < ichiLead1_5m || prevClose_5m < ichiLead2_5m)) {
            chatBot.sendMessage(strategy.name() + " - " + pair.name + "@" + lastClose + " crossed 5m cloud")
            pair.alertSent5m = true
        }
        else if(pair.alertSent5m && ((lastClose < ichiLead1_5m || lastClose < ichiLead2_5m) || (prevClose_5m > ichiLead1_5m && prevClose_5m > ichiLead2_5m))) {
            pair.alertSent5m = false
        }
    }
}
