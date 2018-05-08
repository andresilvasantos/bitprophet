var vars = require(__dirname + "/vars.js")
const binance = require("node-binance-api")

module.exports = {
	initExchangeInfo: function(next) {
		binance.exchangeInfo(function(error, data) {
			if(data.symbols) {
				for(var obj of data.symbols ) {
					var filters = {status: obj.status}
					for (var filter of obj.filters) {
						if ( filter.filterType == "MIN_NOTIONAL" ) {
							filters.minNotional = filter.minNotional
						}
						else if ( filter.filterType == "PRICE_FILTER" ) {
							filters.minPrice = filter.minPrice
							filters.maxPrice = filter.maxPrice
							filters.tickSize = filter.tickSize
						}
						else if ( filter.filterType == "LOT_SIZE" ) {
							filters.stepSize = filter.stepSize
							filters.minQty = filter.minQty
							filters.maxQty = filter.maxQty
						}
					}
					filters.orderTypes = obj.orderTypes
					filters.icebergAllowed = obj.icebergAllowed

					vars.pairsInfo[obj.symbol] = {}
					vars.pairsInfo[obj.symbol].tokenName = obj.baseAsset
					vars.pairsInfo[obj.symbol].marketName = obj.quoteAsset
					vars.pairsInfo[obj.symbol].filters = filters
				}
			}

			next(error)
		})
	},
	normalizeAmount: function(pair, amount, price) {
		// Set minimum order amount with minQty
		if ( amount < vars.pairsInfo[pair].filters.minQty ) amount = vars.pairsInfo[pair].filters.minQty
		// Set minimum order amount with minNotional
		if (price && price * amount < vars.pairsInfo[pair].filters.minNotional ) {
			amount = vars.pairsInfo[pair].filters.minNotional / price
		}
		// Round to stepSize
		return binance.roundStep(amount, vars.pairsInfo[pair].filters.stepSize)
	},
	fixPrice: function(pair, price) {
		var index = String(vars.pairsInfo[pair].filters.tickSize).indexOf("1")
		var count = index - 1
		return parseFloat(price).toFixed(count)
	},
	accountBalance: function(token, next) {
		binance.balance((error, balances) => {
			next(error, balances[token])
		})
	},
	accountTotalBalance: function(next) {
		var tokens = {}
		binance.prices((error, ticker) => {
			if(error) {
				next("Error reading prices: " + error)
				return
			}

			for(var symbol in ticker) {
				tokens[symbol] = parseFloat(ticker[symbol])
			}

			binance.balance((error, balances) => {
				if(error) {
					next("Error reading balances: " + error)
					return
				}

				var accountBalance = {}
				accountBalance.btcTotal = 0
				accountBalance.btcAvailable = 0
				accountBalance.usdtTotal = 0
				accountBalance.bnbAmount = 0

				for(var asset in balances) {
					var obj = balances[asset]
					var available = isNaN(obj.available) ? 0 : parseFloat(obj.available)
					var inOrder = isNaN(obj.onOrder) ? 0 : parseFloat(obj.onOrder)

					if(asset == "BNB") accountBalance.bnbAmount = available

					if(asset == "BTC") {
						accountBalance.btcTotal += available + inOrder
						accountBalance.btcAvailable = available
					}
					else if(asset == "USDT") accountBalance.btcTotal += (available + inOrder) / tokens.BTCUSDT
					else {
						var btcValue = (available + inOrder) * tokens[asset+"BTC"]
						if(!isNaN(btcValue)) accountBalance.btcTotal += btcValue
					}
				}

				accountBalance.usdtTotal = accountBalance.btcTotal * tokens.BTCUSDT

				next(null, accountBalance)
			})
		})
	},
	accountOpenOrders: function(pairName, next) {
		binance.openOrders(pairName ? pairName : false, (error, response) => {
			if (error) {
				next("Error reading open orders: " + error)
				return
			}

			var orders = []
			for (var i = 0; i < response.length; ++i) {
				var order = response[i]
				orders.push({id: order["orderId"], pairName: order["symbol"], side: order["side"], amount: order["origQty"], price: order["price"]})
			}

			next(null, orders)
		})
	},
	tokenPrice: function(pairName, next) {
		binance.prices(pairName, (error, ticker) => {
			next(error, ticker[pairName])
		})
	},
	createLimitOrder: function(pairName, sideBuy, price, quantity, next) {
		quantity = this.normalizeAmount(pairName, quantity, price)
		price = this.fixPrice(pairName, price)

		//BUY
		if(sideBuy) {
			binance.buy(pairName, quantity, price, {type:"LIMIT"}, function(error, response) {
				next(error, response.orderId, quantity, response.status == "FILLED")
			})
		}
		//SELL
		else {
			binance.sell(pairName, quantity, price, {type:"LIMIT"}, function(error, response) {
				next(error, response.orderId, quantity, response.status == "FILLED")
			})
		}
	},
	createStopLimitOrder: function(pairName, sideBuy, price, stopPrice, quantity, next) {
		quantity = this.normalizeAmount(pairName, quantity, price)
		price = this.fixPrice(pairName, price)
		stopPrice = this.fixPrice(pairName, stopPrice)

		//BUY
		if(sideBuy) {
			binance.buy(pairName, quantity, price, {stopPrice: stopPrice, type: "STOP_LOSS_LIMIT"}, function(error, response) {
				next(error, response.orderId, quantity)
			})
		}
		//SELL
		else {
			binance.sell(pairName, quantity, price, {stopPrice: stopPrice, type: "STOP_LOSS_LIMIT"}, function(error, response) {
				next(error, response.orderId, quantity)
			})
		}
	},
	cancelOrder: function(pairName, orderId, next) {
		binance.cancel(pairName, orderId, function(error) {
			next(error)
		})
	},
	chartUpdate: function(pairName, interval, next) {
		binance.candlesticks(pairName, interval, function(error, ticks, pairName) {
			next(error, pairName, ticks)
		})
	},
	startChartUpdate: function(pairName, interval, next) {
		binance.websockets.chart(pairName, interval, (pairName, interval, chart) => {
			next(pairName, interval, chart)
		})
	},
	websocketActive: function(websocketName) {
		var endpoints = Object.keys(binance.websockets.subscriptions())
		return endpoints.indexOf(websocketName) != -1 ? true : false
	},
	terminateWebsocket: function(websocketName) {
		var endpoints = Object.keys(binance.websockets.subscriptions())
		if(endpoints.indexOf(websocketName) != -1) {
			binance.websockets.terminate(websocketName)
		}
	}
}
