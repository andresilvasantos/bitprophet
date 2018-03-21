var vars = require(__dirname + '/vars.js')
var indicators = require(__dirname + '/indicators.js')
var exchUtils = require(__dirname + '/exchange_utils.js')
var chatBot = require(__dirname + '/chat_bot.js')

var pairsValidation = ["1h", "5m"]
var pairsWatch = ["1h", "15m", "5m"]

module.exports = {
    resetPairCustomData: function(pair) {
        pair.tryBuyTimestamp = null
        pair.trySellTimestamp = null
        pair.warningSilent = false
    },
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

        var chart1h = pair.functions.chart("1h").ticks
        var chart5m = pair.functions.chart("5m").ticks

        if(chart1h.length < 500 || chart5m.length < 500) {
            setPairValid(false)
            return
        }

        var close1h = parseFloat(chart1h[chart1h.length - 1].close)
        var stoch1h = indicators.stochastic(chart1h, 14, 11)
        var stoch1hAvg = indicators.average(stoch1h)
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

        setPairValid(volume24h >= 100 && stoch1hAvg > 30 && stoch5mAvg >= 20 && maxDiff5m < 100)
    },
    process: function(strategy, pair) {
        if(!pair.functions.chartUpdatesActive(pairsWatch)) {
            pair.functions.ensureChartUpdates(pairsWatch)
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

            pair.processing = true
            exchUtils.createBuyOrder(pair.name, parseFloat(price).toFixed(8), strategy.buyAmountBTC(), function(error, orderId, quantity, filled) {
                pair.processing = false

                if(error) {
                    console.log("Error placing buy order", pair.name, error)
                    pair.lastBase = null
                    return
                }

                chatBot.sendMessage(strategy.name() + ": trading " + pair.name)

                pair.entryPrice = parseFloat(price).toFixed(8)
                pair.sellTarget = pair.entryPrice * (1 + strategy.profitTarget())

                var order = strategy.createOrder(pair.name, orderId, "BUY", parseFloat(price).toFixed(8), parseFloat(quantity))

                if(filled) {
                    pair.amountToSell = order.amount
                    order.partFill = 1
                    order.waiting = false
                    pair.status = 2
                }
                else {
                    pair.warningSilent = false
                    pair.status++
                }
            })
        }

        var chart1h = pair.functions.chart(pairsWatch[0]).ticks
        var chart15m = pair.functions.chart(pairsWatch[1]).ticks
        var chart5m = pair.functions.chart(pairsWatch[2]).ticks

        if(chart1h.length < 500 || chart15m.length < 500 || chart5m.length < 500) return

        var lastClose = parseFloat(chart5m[chart5m.length - 1].close)
        var rsi5m = indicators.rsi(chart5m, 14, 100, 1)
        var stoch1h = indicators.stochastic(chart1h, 14, 3)
        var stoch15m = indicators.stochastic(chart15m, 14, 3)
        var stoch5m = indicators.stochastic(chart5m, 14, 3)
        rsi5m = rsi5m[0]
        stoch1h = indicators.average(stoch1h)
        stoch15m = indicators.average(stoch15m)
        stoch5m = indicators.average(stoch5m)

        if(stoch1h < 45 && stoch5m < 20 && ((rsi5m < 26 && stoch15m < 15) || (rsi5m < 21 && stoch15m < 30))) {
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

        if(diffTime > 3 * 60 * 1000 || vars.redAlert) {
            var filledAmount = order.amount * pair.partFill
            var boughtPart = order.partFill > 0
            var enoughForNewOrder = order.partFill * strategy.buyAmountBTC() >= 0.002

            if(boughtPart && !enoughForNewOrder) {
                if(!pair.warningSilent) {
                    pair.warningSilent = true
                    chatBot.sendMessage("Part bought for " + pair.name + " not enough to be sold. Buy order cancellation will be delayed.")
                }
                return
            }

            pair.processing = true
            exchUtils.cancelOrder(pair.name, order.id, function(error) {
                pair.processing = false
                if(error) {
                    console.log("Error canceling buy order", error)
                    return
                }

                order.canceled = true
                order.waiting = false

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
        var sellPrice = parseFloat(pair.sellTarget).toFixed(8)
        pair.processing = true
        exchUtils.createSellOrder(pair.name, sellPrice, pair.amountToSell, function(error, orderId, filled) {
            pair.processing = false

            if(error) {
                console.log("Error placing sell order", pair.name, error)
                return
            }

            var order = strategy.createOrder(pair.name, orderId, "SELL", sellPrice, pair.amountToSell)

            if(filled) {
                pair.amountToSell -= order.amount
                order.partFill = 1
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
            pair.processing = true
            exchUtils.cancelOrder(pair.name, order ? order.id : null, function(error) {
                if(error) {
                    console.log("Error canceling sell order", pair.name, error)
                }

                if(order) {
                    order.canceled = true
                    order.waiting = false
                }

                exchUtils.createSellOrder(pair.name, pair.sellTarget, pair.amountToSell, function(error, orderId, filled) {
                    pair.processing = false
                    if(error) {
                        console.log("Error creating sell order", pair.name, error)
                        return
                    }

                    var order = strategy.createOrder(pair.name, orderId, "SELL", parseFloat(pair.sellTarget).toFixed(8), pair.amountToSell)

                    if(filled) {
                        pair.amountToSell -= order.amount
                        order.partFill = 1
                        order.waiting = false
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

        var sellOrderAmount = exchUtils.normalizeAmount(pair.name, order.amount * (1 - order.partFill))
        var amountToSell = exchUtils.normalizeAmount(pair.name, pair.amountToSell)
        if(sellOrderAmount != amountToSell) {
            if(pair.trySellTimestamp && Date.now() - pair.trySellTimestamp < 5 * 1000) return
            pair.trySellTimestamp = Date.now()
            recreateSellOrder()
        }
        else {
            var chart5m = pair.functions.chart(pairsWatch[2]).ticks
            var lastClose = parseFloat(chart5m[chart5m.length - 1].close)

            var activateStopLoss = strategy.manageStopLoss(pair, lastClose)
            if(activateStopLoss) recreateSellOrder()
        }
    }
}
