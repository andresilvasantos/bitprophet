var vars = require(__dirname + "/vars.js")
var exchUtils = require(__dirname + "/exchange_utils.js")
const chatBot = require(__dirname + "/chat_bot.js")
const path = require("path")
const shortid = require("shortid")

module.exports = {
	create: function(strategyId, strategyName) {
		var _id = strategyId
		var _name = strategyName
		var _active = false
		var _warningSilent = false
		var _targetMarket = ""
		var _targetTokens = []
		var _excludeTokens = []
		var _paperTrading = false
		var _buyAmountMarket = 0
		var _buyPercentageAccount = 0
		var _profitTarget = 0
		var _maxLoss = 0
		var _maxTradingPairs = 1
		var _source = require(path.resolve(vars.options.strategiesDir, _id + ".js"))

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

		this.setExcludeTokens = function(excludeTokens) {
			if(!excludeTokens) _excludeTokens = []
			else _excludeTokens = excludeTokens
		}

		this.paperTrading = function() {
			return _paperTrading
		}

		this.setPaperTrading = function(paperTrading) {
			_paperTrading = paperTrading
		}

		this.buyAmountMarket = function() {
			if(_buyPercentageAccount > 0) return vars.startBTCAmount * _buyPercentageAccount
			else return _buyAmountMarket
		}

		this.setBuyAmountMarket = function(amount) {
			_buyAmountMarket = amount
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
				if((_targetTokens.length && _targetTokens.indexOf(pair.tokenName()) == -1) ||
                    _excludeTokens.indexOf(pair.tokenName()) != -1) continue

				var pairData = this.pairData(pair.name())
				var blackFlagTime = currentTime - pairData.blackFlagTime

				if(pairData.processing || (pairData.status <= 0 && (vars.paused || (vars.btcAnalysis.dangerZone && vars.options.pauseDangerBTC) ||
                    this.tradingPairs().length >= _maxTradingPairs || blackFlagTime < 15 * 60 * 1000))) continue

				if(pairData.status <= 0) {
					if(pairData.status == -1) {
						try {
							_source.resetPairCustomData(pairData)
						}
						catch(error) {
							if(!_warningSilent) {
								chatBot.sendMessage(":warning: " + _name + " is crashing. Check the console logs for more info.")
								_warningSilent = true
							}
							console.log(error)
							continue
						}
					}

					var needsCheck = currentTime - pairData.lastValidCheck >= 10 * 60 * 1000
					if(needsCheck) {
						try {
							_source.checkValidWorkingPair(this, pairData)
						}
						catch(error) {
							if(!_warningSilent) {
								chatBot.sendMessage(":warning: " + _name + " is crashing. Check the console logs for more info.")
								_warningSilent = true
							}
							console.log(error)
						}
					}
				}

				if(pairData.status == -1) continue

				if(_paperTrading && pairData.status > 0) {
					var orders = this.openOrders(pairData.name)
					var lastPrice = parseFloat(pairData.functions.lastPrice())
					for(var i = 0; i < orders.length; ++i) {
						var order = orders[i]
						var side = order.side
						var price = order.price

						if(side == "BUY") {
							if(lastPrice < price) {
								order.partFill = 1
								order.priceTraded = parseFloat(price)
								pairData.amountToSell += order.amount

								let quantity = order.amount
								let quantityFixed = quantity < 1 ? quantity : parseFloat(quantity).toFixed(2)
								chatBot.sendMessage(":high_brightness: [PT] Traded - " + pairData.chatName + " BUY " +
									quantityFixed + "@" + exchUtils.fixPrice(pairData.name, order.price) + " | 100.00%")
							}
						}
						else {
							if(lastPrice > price) {
								order.partFill = 1
								order.priceTraded = parseFloat(price)
								pairData.amountToSell -= order.amount

								let quantity = order.amount
								let quantityFixed = quantity < 1 ? quantity : parseFloat(quantity).toFixed(2)
								chatBot.sendMessage(":high_brightness: [PT] Traded - " + pairData.chatName + " SELL " +
									quantityFixed + "@" + exchUtils.fixPrice(pairData.name, order.price) + " | 100.00%")
							}
						}
					}
				}

				try {
					_source.process(this, pairData)
				}
				catch(error) {
					if(!_warningSilent) {
						chatBot.sendMessage(":warning: " + _name + " is crashing. Check the console logs for more info.")
						_warningSilent = true
					}
					console.log(error)
				}
			}
		}

		this.manageStopLoss = function(pairData, lastClose, trailingType = 2, trailingPercentage = 0.006, sellPriceDistance = 0.001) {
			if(lastClose < pairData.stopLoss.sellPrice && lastClose < pairData.stopLoss.stopPrice) {
				if(!pairData.dangerSilent) {
					this.sendMessage(pairData, "@" + lastClose + " crossed stop loss price of " + pairData.stopLoss.sellPrice + "!", "warning")
					pairData.dangerSilent = true
				}
			}

			if(lastClose <= pairData.stopLoss.stopPrice && pairData.sellTarget > pairData.stopLoss.sellPrice) {
				pairData.sellTarget = pairData.stopLoss.sellPrice
				return true
			}

			switch(trailingType) {
			case 0:
			default:
				break
			case 1:
				if(lastClose / pairData.entryPrice >= (1 + trailingPercentage) && pairData.stopLoss.sellPrice < pairData.entryPrice) {
					pairData.stopLoss.stopPrice = pairData.entryPrice * (1 + sellPriceDistance)
					pairData.stopLoss.sellPrice = pairData.entryPrice
					this.sendMessage(pairData, "stop loss adjusted to 0.0%", "point_up")
				}
				break
			case 2:
				if(pairData.entryPrice < lastClose / (1 + trailingPercentage) && pairData.stopLoss.stopPrice < lastClose / (1 + trailingPercentage)) {
					pairData.stopLoss.stopPrice = lastClose / (1 + trailingPercentage)
					pairData.stopLoss.sellPrice = lastClose / (1 + trailingPercentage + sellPriceDistance)

					var percentage = (pairData.stopLoss.stopPrice / pairData.entryPrice - 1) * 100
					this.sendMessage(pairData, "stop loss adjusted to " + percentage.toFixed(2) + "%", "point_up")
				}
				break
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
			pairData.profit += finalProfit
			vars.pairs[pairData.name].addProfit(finalProfit)
			this.addProfit(finalProfit)

			var accountProfit = 0

			if(!_paperTrading) {
				var fees = (totalSold + totalBought) * vars.tradingFees
				accountProfit = (totalSold - totalBought - fees) / vars.startBTCAmount * 100
				pairData.accountProfit += accountProfit
				vars.pairs[pairData.name].addAccountProfit(accountProfit)
				this.addAccountProfit(accountProfit)
			}

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
				this.cancelOrder(data, order.id, function(error) {
					if(error) {
						console.log("Error canceling order", error)
					}
				})
			}

			data.orders = []

			try {
				_source.resetPairCustomData(data)
			}
			catch(error) {
				if(!_warningSilent) {
					chatBot.sendMessage(":warning: " + _name + " is crashing. Check the console logs for more info.")
					_warningSilent = true
				}
				console.log(error)
			}
		}

		this.buy = function(pair, price, amountMarket, next) {
			if(_paperTrading) {
				amountMarket = parseFloat(amountMarket)
				price = parseFloat(price)
				var quantity = parseFloat(exchUtils.normalizeAmount(pair.name, amountMarket / price, price))
				var order = this.createOrder(pair.name, shortid.generate(), "BUY", price, quantity)

				setTimeout(function() {
					var quantityFixed = quantity < 1 ? quantity : quantity.toFixed(2)
					chatBot.sendMessage(":package: [PT] Created - " + pair.chatName + " BUY " + quantityFixed + "@" + exchUtils.fixPrice(pair.name, price))
				}, 1000)

				next(null, order)
				return
			}

			var that = this
			pair.processing = true
			exchUtils.accountBalance(pair.market, function(error, balance) {
				if(error) {
					pair.processing = false
					if(next) next("Error reading " + pair.market + " balance: " + error)
					return
				}

				if(balance.available > amountMarket) {
					exchUtils.createLimitOrder(pair.name, true, price, parseFloat(amountMarket / price), function(error, orderId, quantity, filled) {
						pair.processing = false

						var order = null
						if(!error) {
							order = that.createOrder(pair.name, orderId, "BUY", parseFloat(price), parseFloat(quantity))
							if(filled) {
								order.partFill = 1
								order.priceTraded = parseFloat(price)
								order.waiting = false
								pair.amountToSell += order.amount
							}
						}

						if(next) next(error, order)
					})
				}
				else {
					pair.processing = false
					if(next) next("Not enough " + pair.market + " available: " + balance.available)
				}
			})
		}

		this.sell = function(pair, price, quantity, next) {
			if(_paperTrading) {
				price = parseFloat(price)
				quantity = parseFloat(exchUtils.normalizeAmount(pair.name, quantity, price))
				var order = this.createOrder(pair.name, shortid.generate(), "SELL", price, quantity)

				setTimeout(function() {
					var quantityFixed = quantity < 1 ? quantity : quantity.toFixed(2)
					chatBot.sendMessage(":package: [PT] Created - " + pair.chatName + " SELL " + quantityFixed + "@" + exchUtils.fixPrice(pair.name, price))
				}, 1000)

				next(null, order)
				return
			}

			var that = this
			pair.processing = true
			exchUtils.createLimitOrder(pair.name, false, price, quantity, function(error, orderId, quantity, filled) {
				pair.processing = false
				var order = null
				if(!error) {
					order = that.createOrder(pair.name, orderId, "SELL", parseFloat(price), parseFloat(quantity))
					if(filled) {
						order.partFill = 1
						order.priceTraded = parseFloat(price)
						order.waiting = false
						pair.amountToSell -= order.amount
					}
				}
				if(next) next(error, order)
			})
		}

		/*this.stopLoss = function(pair, price, stopPrice, quantity, next) {
            //TODO paper trading
            pair.processing = true
            exchUtils.createStopLimitOrder(pair.name, false, price, stopPrice, quantity, function(error, orderId, quantity) {
                pair.processing = false
                if(next) next(error, orderId, quantity)
            })
        }*/

		this.cancelOrder = function(pair, orderId, next) {
			var targetOrder = this.orderById(pair.name, orderId)
			if(!targetOrder) {
				if(next) next("Error canceling order. Order with id " + orderId + " not found for " + pair.name)
				return
			}

			if(targetOrder.canceled) {
				if(next) next(null)
				return
			}

			if(_paperTrading) {
				targetOrder.canceled = true
				targetOrder.waiting = false

				var quantity = parseFloat(exchUtils.normalizeAmount(pair.name, targetOrder.amount, targetOrder.price))
				var quantityFixed = quantity < 1 ? quantity : parseFloat(quantity).toFixed(2)

				setTimeout(function() {
					chatBot.sendMessage(":wastebasket: [PT] Canceled - " + pair.chatName + " " + targetOrder.side + " " + quantityFixed + "@" + exchUtils.fixPrice(pair.name, targetOrder.price))
				}, 1000)

				next(null)
				return
			}

			targetOrder.automatedCancel = true
			pair.processing = true
			exchUtils.cancelOrder(pair.name, orderId, function(error) {
				pair.processing = false
				if(error) targetOrder.automatedCancel = false
				else {
					targetOrder.canceled = true
					targetOrder.waiting = false
				}
				next(error)
			})
		}

		this.createOrder = function(pairName, orderId, side, price, amount, stopLoss = false) {
			var order = {}
			order.id = orderId
			order.side = side
			order.price = price
			order.priceTraded = price
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
						avgBoughtPrice = order.priceTraded
						boughtAmount = order.partFill * order.amount
					}
					else {
						var amount = (order.partFill * order.amount)
						avgBoughtPrice = (boughtAmount * avgBoughtPrice + amount * order.priceTraded) / (boughtAmount + amount)
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
						avgSoldPrice = order.priceTraded
						soldAmount = order.partFill * order.amount
					}
					else {
						var amount = (order.partFill * order.amount)
						avgSoldPrice = (soldAmount * avgSoldPrice + amount * order.priceTraded) / (soldAmount + amount)
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
			var paperTradingStr = _paperTrading ? "[PT] " : ""
			var emojiString = emojiCode ? ":" + emojiCode + ": " : ""
			chatBot.sendMessage(emojiString + paperTradingStr + _name + ": " + pairData.chatName + " " + message)
		}
	}
}
