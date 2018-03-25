const exchUtils = require('./exchange_utils.js')

module.exports = {
    create: function(pairName) {
        var _name = pairName

        var _charts = {}

        var _profit = 0
        var _accountProfit = 0

        this.name = function() {
            return _name
        }

        this.chart = function(interval) {
            return _charts[interval]
        }

        this.initChartInterval = function(interval) {
            if(!_charts[interval]) {
                _charts[interval] = {}
                _charts[interval].watchers = 0
                _charts[interval].ticks = []
                _charts[interval].timestamp = 0
                _charts[interval].loading = false
            }
        }

        this.chartsNeedUpdate = function(intervals, maxTimeElapsedSec, updateIfNeed) {
            if(typeof intervals == "string") intervals = [intervals]

            var needUpdateAll = false
            for(var i = 0; i < intervals.length; ++i) {
                var interval = intervals[i]
                this.initChartInterval(interval)

                if(this.chartUpdatesActive(interval)) continue
                var currentTime = Date.now()
                if(currentTime - _charts[interval].timestamp < maxTimeElapsedSec * 1000) continue

                needUpdateAll = true

                if(updateIfNeed && !_charts[interval].loading) this.singleChartUpdate(interval)
            }

            return needUpdateAll
        }

        this.singleChartUpdate = function(interval, next) {
            this.initChartInterval(interval)

            if(_charts[interval].watchers && this.chartUpdatesActive(interval)) {
                if(next) next(null, _charts[interval].ticks)
                return
            }

            if(_charts[interval].loading) {
                if(next) next(null, [])
                return
            }

            _charts[interval].loading = true
            exchUtils.chartUpdate(_name, interval, function(error, pairName, ticks) {
                if(error) {
                    console.log("Error fetching candlesticks", pairName, error)
                    _charts[interval].loading = false
                    if(next) next(error, [])
                    return
                }

                var ticksArray = []
                for(var i = 0; i < ticks.length; ++i) {
                    var tickJson = {}
                    tickJson.timestamp = ticks[i][0]
                    tickJson.open = ticks[i][1]
                    tickJson.high = ticks[i][2]
                    tickJson.low = ticks[i][3]
                    tickJson.close = ticks[i][4]
                    tickJson.volume = ticks[i][5]
                    ticksArray.push(tickJson)
                }
                _charts[interval].ticks = ticksArray
                _charts[interval].timestamp = Date.now()
                _charts[interval].loading = false

                if(next) next(error, _charts[interval].ticks)
            })
        }

        this.startChartUpdates = function(interval) {
            this.initChartInterval(interval)

            if(_charts[interval].loading) {
                return
            }

            _charts[interval].loading = true
            exchUtils.startChartUpdate(_name, interval, function(pairName, interval, chart) {
                var timestamps = Object.keys(chart)
                timestamps.sort()

                var newTicks = []
                for(var i = 0; i < timestamps.length; ++i) {
                    var tick = chart[timestamps[i]]
                    tick.timestamp = timestamps[i]
                    newTicks.push(tick)
                }

                _charts[interval].ticks = newTicks
                _charts[interval].timestamp = Date.now()
                _charts[interval].loading = false
            })
        }

        this.stopChartUpdates = function(interval) {
            var websocketName = _name.toLowerCase() + "@" + "kline_" + interval
            exchUtils.terminateWebsocket(websocketName)
        }

        this.addWatcherChartUpdates = function(intervals) {
            if(typeof intervals == "string") intervals = [intervals]

            for(var i = 0; i < intervals.length; ++i) {
                var interval = intervals[i]

                this.initChartInterval(interval)

                _charts[interval].watchers++

                if(_charts[interval].watchers == 1) {
                    this.startChartUpdates(interval)
                }
            }
        }

        this.removeWatcherChartUpdates = function(intervals) {
            if(typeof intervals == "string") intervals = [intervals]

            for(var i = 0; i < intervals.length; ++i) {
                var interval = intervals[i]

                this.initChartInterval(interval)

                _charts[interval].watchers--

                if(!_charts[interval].watchers) {
                    this.stopChartUpdates(interval)
                }
            }
        }

        this.chartUpdatesActive = function(intervals) {
            if(typeof intervals == "string") intervals = [intervals]

            var allActive = true
            for(var i = 0; i < intervals.length; ++i) {
                var interval = intervals[i]
                var websocketName = _name.toLowerCase() + "@" + "kline_" + interval
                if(!exchUtils.websocketActive(websocketName) || _charts[interval].loading) {
                    allActive = false
                    break
                }
            }
            return allActive
        }

        this.ensureChartUpdates = function(intervals) {
            if(typeof intervals == "string") intervals = [intervals]

            for(var i = 0; i < intervals.length; ++i) {
                if(!this.chartUpdatesActive(intervals[i])) {
                    this.startChartUpdates(intervals[i])
                }
            }
        }

        this.profit = function() {
            return _profit
        }

        this.addProfit = function(profit) {
            _profit += profit
        }

        this.accountProfit = function() {
            return _accountProfit
        }

        this.addAccountProfit = function(profit) {
            _accountProfit += profit
        }

        this.resetProfits = function() {
            _profit = 0
            _accountProfit = 0
        }
    }
}
