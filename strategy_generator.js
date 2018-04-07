var vars = require(__dirname + '/vars.js')
var exchUtils = require(__dirname + '/exchange_utils.js')
const chatBot = require(__dirname + '/chat_bot.js')
const path = require('path')

module.exports = {
    create: function(strategyId, strategyName, strategiesDir) {
        var _id = strategyId
        var _name = strategyName
        var _active = false
        var _targetMarket = ""
        var _targetTokens = []
        var _buyAmountBTC = 0
        var _buyPercentageAccount = 0
        var _profitTarget = 0
        var _maxLoss = 0
        var _maxTradingPairs = 1
        var _source = require(path.resolve(vars.options.strategiesDir, _id + '.js'))

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

        this.setTargetMarket = function(targetMarket) {
            if(!targetMarket) _targetMarket = ""
            else _targetMarket = targetMarket
        }

        this.setTargetTokens = function(targetTokens) {
            if(!targetTokens) _targetTokens = []
            else _targetTokens = targetTokens
        }

        this.buyAmountBTC = function() {
            if(_buyPercentageAccount > 0) return vars.startBTCAmount * _buyPercentageAccount
            else return _buyAmountBTC
        }

        this.setBuyAmountBTC = function(amount) {
            _buyAmountBTC = amount
        }

        this.setBuyPercentageAccount = function(percentageAccount) {
            _buyPercentageAccount = percentageAccount
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
                if(_targetMarket.length && pair.marketName().toLowerCase() != _targetMarket.toLowerCase()) continue
                if(_targetTokens.length && _targetTokens.indexOf(pair.tokenName()) == -1) continue

                var pairData = this.pairData(pair.name())
                var blackFlagTime = currentTime - pairData.blackFlagTime

                if(pairData.processing || (pairData.status <= 0 && (vars.paused || /*vars.btcAnalysis.dangerZone ||*/
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
                    this.sendMessage(pairData, "@" + lastClose + " crossed stop loss price of " + pairData.stopLoss.sellPrice + "!", "warning")
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
                    this.sendMessage(pairData, "stop loss adjusted to 0.0%", "point_up")
                }
            }
            else if(trailing == 1) {
                if(pairData.entryPrice < lastClose / 1.006 && pairData.stopLoss.stopPrice < lastClose / 1.006) {
                    pairData.stopLoss.stopPrice = lastClose / 1.006
                    pairData.stopLoss.sellPrice = lastClose / 1.009

                    var percentage = (pairData.stopLoss.stopPrice / pairData.entryPrice - 1) * 100
                    this.sendMessage(pairData, "stop loss adjusted to " + percentage.toFixed(2) + "%", "point_up")
                }
            }

            return false
        }

        this.tradeFinished = function(pairData) {
            var buyInfo = this.buyTradedInfo(pairData)
            var sellInfo = this.sellTradedInfo(pairData)

            var totalBought = buyInfo.amountMarketPrice
            var totalSold = sellInfo.amountMarketPrice

            var finalProfit = (totalSold - totalBought) / totalBought * 100
            if(finalProfit <= 0) pairData.blackFlagTime = Date.now()
            var fees = (totalSold + totalBought) * vars.tradingFees
            var accountProfit = (totalSold - totalBought - fees) / vars.startBTCAmount * 100
            pairData.profit += finalProfit
            pairData.accountProfit += accountProfit
            vars.pairs[pairData.name].addProfit(finalProfit)
            vars.pairs[pairData.name].addAccountProfit(accountProfit)
            this.addProfit(finalProfit)
            this.addAccountProfit(accountProfit)
            var emojiCode = finalProfit > 0 ? "golf::tada" : "golf::cold_sweat"

            this.sendMessage(pairData, "trading #finished!\nProfit: " + finalProfit.toFixed(2) + "%\nAccount profit: " +
                accountProfit.toFixed(2) + "%\nAvg Bought @" + buyInfo.avgPrice.toFixed(8) + " & Avg Sold @" + sellInfo.avgPrice.toFixed(8), emojiCode)

            this.resetPairData(pairData.name)
        }

        this.pairData = function(pairName) {
            if(!_pairsData[pairName]) {
                var data = {}
                data.name = pairName
                data.token = vars.pairs[pairName].tokenName()
                data.market = vars.pairs[pairName].marketName()
                data.chatName = vars.pairs[pairName].chatName()
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

        this.buyTradedInfo = function(pairData) {
            var avgBoughtPrice = -1
            var boughtAmount = 0

            for(var i = 0; i < pairData.orders.length; ++i)
            {
                var order = pairData.orders[i]
                if(order.side != "BUY") continue

                if(order.partFill) {
                    if(avgBoughtPrice == -1) {
                        avgBoughtPrice = order.price
                        boughtAmount = order.partFill * order.amount
                    }
                    else {
                        var amount = (order.partFill * order.amount)
                        avgBoughtPrice = (boughtAmount * avgBoughtPrice + amount * order.price) / (boughtAmount + amount)
                        boughtAmount += order.partFill * order.amount
                    }
                }
            }

            return {avgPrice: avgBoughtPrice,  amount: boughtAmount, amountMarketPrice: avgBoughtPrice * boughtAmount}
        }

        this.sellTradedInfo = function(pairData) {
            var avgSoldPrice = -1
            var soldAmount = 0

            for(var i = 0; i < pairData.orders.length; ++i)
            {
                var order = pairData.orders[i]
                if(order.side != "SELL") continue

                if(order.partFill) {
                    if(avgSoldPrice == -1) {
                        avgSoldPrice = order.price
                        soldAmount = order.partFill * order.amount
                    }
                    else {
                        var amount = (order.partFill * order.amount)
                        avgSoldPrice = (soldAmount * avgSoldPrice + amount * order.price) / (soldAmount + amount)
                        soldAmount += order.partFill * order.amount
                    }
                }
            }

            return {avgPrice: avgSoldPrice,  amount: soldAmount, amountMarketPrice: avgSoldPrice * soldAmount}
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

            for(var pairName of Object.keys(_pairsData)) {
                var pairData = this.pairData(pairName)
                pairData.profit = 0
                pairData.accountProfit = 0
            }
        }

        this.sendMessage = function(pairData, message, emojiCode) {
            var emojiString = emojiCode ? ":" + emojiCode + ": " : ""
            chatBot.sendMessage(emojiString + _name + ": " + pairData.chatName + " " + message)
        }
    }
}
