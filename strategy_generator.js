var vars = require(__dirname + '/vars.js')
var exchUtils = require(__dirname + '/exchange_utils.js')
const chatBot = require(__dirname + '/chat_bot.js')
var emoji = require('node-emoji')

module.exports = {
    create: function(strategyId, strategyName) {
        var _id = strategyId
        var _name = strategyName
        var _active = false
        var _buyAmountBTC = 0
        var _profitTarget = 0
        var _maxLoss = 0
        var _maxTradingPairs = 1
        var _source = require(__dirname + '/strategies/' + _id + '.js')

        var _pairsData = {}

        var _profit = 0
        var _accountProfit = 0

        this.id = function() {
            return _id
        }

        this.name = function() {
            return _name
        }

        this.active = function() {
            return _active
        }

        this.setActive = function(active) {
            _active = active
        }

        this.buyAmountBTC = function() {
            return _buyAmountBTC
        }

        this.setBuyAmountBTC = function(amount) {
            _buyAmountBTC = amount
        }

        this.profitTarget = function() {
            return _profitTarget
        }

        this.setProfitTarget = function(profitTarget) {
            _profitTarget = profitTarget * 0.01
        }

        this.maxLoss = function() {
            return _maxLoss
        }

        this.setMaxLoss = function(maxLoss) {
            _maxLoss = maxLoss * 0.01
        }

        this.maxTradingPairs = function() {
            return _maxTradingPairs
        }

        this.setMaxTradingPairs = function(maxTradingPairs) {
            _maxTradingPairs = maxTradingPairs
        }

        this.reloadSource = function() {
            _source = require(__dirname + '/strategy_' + _id + '.js')
        }

        this.pairs = function() {
            var pairsArray = []
            for(var pairName of Object.keys(_pairsData)) {
                var pairData = this.pairData(pairName)
                pairsArray.push(pairData)
            }
            return pairsArray
        }

        this.validPairs = function() {
            var validPairsArray = []
            for(var pairName of Object.keys(_pairsData)) {
                var pairData = this.pairData(pairName)
                if(pairData.status == -1) continue

                validPairsArray.push(pairData)
            }
            return validPairsArray
        }

        this.tradingPairs = function() {
            var tradingPairsArray = []
            for(var pairName of Object.keys(_pairsData)) {
                var pairData = this.pairData(pairName)
                if(pairData.status < 1 && !pairData.processing) continue

                tradingPairsArray.push(pairData)
            }
            return tradingPairsArray
        }

        this.process = function() {
            var currentTime = Date.now()

            for(var pair of Object.values(vars.pairs)) {
                var pairData = this.pairData(pair.name())
                var blackFlagTime = currentTime - pairData.blackFlagTime

                if(pairData.processing || (pairData.status <= 0 && (vars.paused || vars.btcAnalysis.dangerZone ||
                    this.tradingPairs().length >= _maxTradingPairs || blackFlagTime < 15 * 60 * 1000))) continue

                if(pairData.status <= 0) {
                    if(pairData.status == -1) _source.resetPairCustomData(pairData)

                    var needsCheck = currentTime - pairData.lastValidCheck >= 10 * 60 * 1000
                    if(needsCheck) {
                        _source.checkValidWorkingPair(this, pairData)
                        continue
                    }
                }

                if(pairData.status == -1) continue

                _source.process(this, pairData)
            }
        }

        this.manageStopLoss = function(pairData, lastClose, trailing = 1) {
            var diffPercentage = (lastClose - pairData.entryPrice) / pairData.entryPrice * 100

            if(lastClose < pairData.stopLoss.sellPrice && lastClose < pairData.stopLoss.stopPrice) {
                if(!pairData.dangerSilent) {
                    chatBot.sendMessage(pairData.name + "@" + lastClose + " crossed stop loss price of " + pairData.stopLoss.sellPrice + "!")
                    pairData.dangerSilent = true
                }
            }

            if(lastClose <= pairData.stopLoss.stopPrice && pairData.sellTarget != parseFloat(pairData.stopLoss.sellPrice).toFixed(8)) {
                pairData.sellTarget = parseFloat(pairData.stopLoss.sellPrice).toFixed(8)
                return true
            }

            if(trailing == 0) {
                if(lastClose / pairData.entryPrice >= 1.006 && pairData.stopLoss.sellPrice < pairData.entryPrice) {
                    pairData.stopLoss.stopPrice = pairData.entryPrice * 1.001
                    pairData.stopLoss.sellPrice = pairData.entryPrice
                    chatBot.sendMessage(pairData.name + " stop loss adjusted to 0.0%")
                }
            }
            else if(trailing == 1) {
                if(pairData.entryPrice < lastClose / 1.006 && pairData.stopLoss.stopPrice < lastClose / 1.006) {
                    pairData.stopLoss.stopPrice = lastClose / 1.006
                    pairData.stopLoss.sellPrice = lastClose / 1.009

                    var percentage = (pairData.stopLoss.stopPrice / pairData.entryPrice - 1) * 100
                    chatBot.sendMessage(pairData.name + " stop loss adjusted to " + percentage.toFixed(2) + "%")
                }
            }

            return false
        }

        this.tradeFinished = function(pairData) {
            var avgBoughtPrice = -1
            var avgSoldPrice = -1
            var boughtAmount = 0
            var soldAmount = 0

            for(var i = 0; i < pairData.orders.length; ++i)
            {
                var order = pairData.orders[i]
                if(order.side == "BUY") {
                    if(order.partFill) {
                        if(avgBoughtPrice == -1) {
                            avgBoughtPrice = order.price
                            boughtAmount = order.partFill * order.amount
                        }
                        else {
                            var amount = (order.partFill * order.amount)
                            avgBoughtPrice = parseFloat((boughtAmount * avgBoughtPrice + amount * order.price) / (boughtAmount + amount)).toFixed(8)
                            boughtAmount += order.partFill * order.amount
                        }
                    }
                }
                else {
                    if(order.partFill) {
                        if(avgSoldPrice == -1) {
                            avgSoldPrice = order.price
                            soldAmount = order.partFill * order.amount
                        }
                        else {
                            var amount = (order.partFill * order.amount)
                            avgSoldPrice = parseFloat((soldAmount * avgSoldPrice + amount * order.price) / (soldAmount + amount)).toFixed(8)
                            soldAmount += order.partFill * order.amount
                        }
                    }
                }
            }

            var finalProfit = (avgSoldPrice - avgBoughtPrice) / avgBoughtPrice * 100
            if(finalProfit <= 0) pairData.blackFlagTime = Date.now()
            var totalBoughtBTC = avgBoughtPrice * boughtAmount
            var totalSoldBTC = avgSoldPrice * soldAmount
            var fees = (totalSoldBTC + totalBoughtBTC) * vars.tradingFees
            var accountProfit = (totalSoldBTC - totalBoughtBTC - fees) / vars.startBTCAmount * 100
            pairData.profit += finalProfit
            pairData.accountProfit += accountProfit
            vars.pairs[pairData.name].addProfit(finalProfit)
            vars.pairs[pairData.name].addAccountProfit(accountProfit)
            this.addProfit(finalProfit)
            this.addAccountProfit(accountProfit)
            var emojiCode = finalProfit > 0 ? emoji.get("golf") + emoji.get("tada") : emoji.get("golf") + emoji.get("cold_sweat")

            chatBot.sendMessage(emojiCode + " " + _name + ": " + pairData.name + " trading finished!\nProfit: " + finalProfit.toFixed(2) + "%\nAccount profit: " +
                accountProfit.toFixed(2) + "%\nAvg Bought @" + avgBoughtPrice + " & Avg Sold @" + avgSoldPrice)

            this.resetPairData(pairData.name)
        }

        this.pairData = function(pairName) {
            if(!_pairsData[pairName]) {
                var data = {}
                data.name = pairName
                data.functions = vars.pairs[pairName]
                data.processing = false
                data.status = -1
                data.entryPrice = 0
                data.sellTarget = 0
                data.amountToSell = 0
                data.stopLoss = {}
                data.stopLoss.stopPrice = 0
                data.stopLoss.sellPrice = 0
                data.orders = []
                data.forceSell = false
                data.lastValidCheck = -1
                data.profit = 0
                data.accountProfit = 0
                _pairsData[pairName] = data
            }
            return _pairsData[pairName]
        }

        this.resetPairData = function(pairName) {
            var data = this.pairData(pairName)
            if(!data) return
            data.status = -1
            data.processing = false
            data.entryPrice = 0
            data.sellTarget = 0
            data.amountToSell = 0
            data.stopLoss.stopPrice = 0
            data.stopLoss.sellPrice = 0
            data.forceSell = false

            var orders = this.openOrders(pairName)

            for(var i = 0; i < orders.length; ++i) {
                var order = orders[i]
                exchUtils.cancelOrder(pairName, order.id, function(error) {
                    if(error) {
                        console.log("Error canceling order", error)
                        return
                    }
                })
            }

            data.orders = []
            _source.resetPairCustomData(this, data)
        }

        this.createOrder = function(pairName, orderId, side, price, amount, stopLoss = false) {
            var order = {}
            order.id = orderId
            order.side = side
            order.price = price
            order.amount = amount
            order.stopLoss = stopLoss
            order.timestamp = Date.now()
            order.partFill = 0
            order.waiting = true
            order.canceled = false

            this.pairData(pairName).orders.push(order)
            return order
        }

        this.removeOrder = function(pairName, orderId) {
            var orders = this.pairData(pairName).orders

            var orderIndex = -1
            for(var i = 0; i < orders.length; ++i)
            {
                var order = orders[i]
                if(order.id == orderId) {
                    orderIndex = i
                    break
                }
            }
            if(orderIndex >= 0) orders.splice(orders.indexOf(orderIndex), 1)
            return orderIndex >= 0
        }

        this.openOrders = function(pairName) {
            var orders = this.pairData(pairName).orders
            var openOrdersArray = []

            for(var i = 0; i < orders.length; ++i)
            {
                var order = orders[i]
                if(order.waiting && !order.canceled && order.partFill < 1) openOrdersArray.push(order)
            }
            return openOrdersArray
        }

        this.order = function(pairName, side, waiting = true) {
            var orders = this.pairData(pairName).orders

            for(var i = 0; i < orders.length; ++i)
            {
                var order = orders[i]
                if(order.side == side && order.waiting == waiting) {
                    return order
                }
            }
            return null
        }

        this.orderById = function(pairName, orderId) {
            var orders = this.pairData(pairName).orders

            for(var i = 0; i < orders.length; ++i) {
                var order = orders[i]
                if(order.id == orderId) {
                    return order
                }
            }
            return null
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

        this.sendMessage = function(pairData, message, emojiCode) {
            var emojiString = emojiCode ? emoji.get(emojiCode) + " " : ""
            chatBot.sendMessage(emojiString + _name + ": " + pairData.name + " " + message)
        }
    }
}
