module.exports = function() {
	"use strict"

	var vars = require(__dirname + "/vars.js")
	const exchUtils = require(__dirname + "/exchange_utils.js")
	const chatBot = require(__dirname + "/chat_bot.js")
	const utils = require(__dirname + "/utils.js")
	const pairGenerator = require(__dirname + "/pair_generator.js")
	var indicators = require(__dirname + "/indicators.js")
	var strategyManager = require(__dirname + "/strategy_manager.js")
	const binance = require("node-binance-api")
	const default_options = {
		pauseDangerBTC: true,
		mainLoopTimer: 1500,
		strategiesDir: __dirname + "/strategies",
		verbose: true
	}
	var options = default_options

	var btcIntervalsWatch = ["15m", "5m"]
	var userDataWebsocket = {
		listenKey: "",
		connectionTimestamp: 0,
		connecting: false
	}

	function initPairs() {
		for(var pairInfo of Object.values(vars.pairsInfo)) {
			var pair = new pairGenerator.create(pairInfo.tokenName, pairInfo.marketName)
			vars.pairs[pair.name()] = pair
		}
	}

	function initUserDataUpdates() {
		if(userDataWebsocket.connecting) return

		userDataWebsocket.connectionTimestamp = Date.now()
		userDataWebsocket.connecting = true
		binance.websockets.userData(balance_update, execution_update, function(listenKey) {
			userDataWebsocket.listenKey = listenKey
			userDataWebsocket.connecting = false
		})
	}

	function balance_update(data) {
		for ( let obj of data.B ) {
			let { a:asset, f:available } = obj
			if(asset == "BNB" && parseFloat(available) < 0.05) {
				chatBot.sendMessage(":warning::fuelpump: Low BNB | " + available)
				break
			}
		}
	}
	function execution_update(data) {
		let { x:executionType, s:symbol, p:price, L:priceTraded, q:quantity, S:side, o:orderType, i:orderId, X:orderStatus, z:filledQuantity } = data

		var traded = executionType == "TRADE"
		var isNew = executionType == "NEW"
		var canceled = executionType == "CANCELED"
		var filled = parseFloat(filledQuantity) / parseFloat(quantity)
		if(traded) price = priceTraded

		var strategy = null
		var pair = null
		var order = null
		var strategiesList = strategyManager.listStrategies()
		for(var i = 0; i < strategiesList.length; ++i) {
			strategy = strategiesList[i]
			order = strategy.orderById(symbol, orderId)
			if(!order) continue
			pair = strategy.pairData(symbol)
			break
		}

		if(pair && order) {

			if(orderStatus == "FILLED") {
				if(side == "BUY") {
					pair.amountToSell += (1 - order.partFill) * parseFloat(quantity)
				}
				else {
					pair.amountToSell -= (1 - order.partFill) * parseFloat(quantity)
				}

				order.priceTraded = order.partFill * order.priceTraded + (1 - order.partFill) * parseFloat(price)
				order.partFill = 1
			}
			else if(traded && filled < 1) {
				if(side == "BUY") {
					pair.amountToSell += (filled - order.partFill) * parseFloat(quantity)
				}
				else {
					pair.amountToSell -= (filled - order.partFill) * parseFloat(quantity)
				}

				order.priceTraded = (order.partFill * order.priceTraded + (filled - order.partFill) * parseFloat(price)) / filled
				order.partFill = filled
			}
			else if(canceled) {
				order.canceled = true
				order.waiting = false

				if(!order.automatedCancel) {
					chatBot.sendMessage(":raised_hand: Trading stopped for pair " + pair.chatName + " due to human intervention")
					strategy.resetPairData(pair.name)
				}
			}
		}

		var quantityFixed = quantity < 1 ? quantity : parseFloat(quantity).toFixed(2)
		var type, emojiStr
		if(traded) {
			type = "Traded"
			emojiStr = orderStatus == "FILLED" ? ":high_brightness:" : ":low_brightness:"
		}
		else if(isNew) {
			type = "Created"
			emojiStr = ":package:"
		}
		else {
			type = "Canceled"
			emojiStr = ":wastebasket:"
		}

		var oType = orderType == "STOP_LOSS_LIMIT" ? "SL " : ""
		var fill = traded ? " | " + parseFloat(filled * 100).toFixed(2) + "%" : ""

		chatBot.sendMessage(emojiStr + " " + oType + type + " - " + vars.pairs[symbol].chatName() + "\t" + side + " "+
            quantityFixed + "@" + exchUtils.fixPrice(symbol, price) + fill)
	}

	function controlBitcoinRSI() {
		var btcPair = vars.pairs["BTCUSDT"]
		btcPair.ensureChartUpdates(btcIntervalsWatch)
		var chart15m = btcPair.chart(btcIntervalsWatch[0]).ticks
		var chart5m = btcPair.chart(btcIntervalsWatch[1]).ticks

		if(chart15m.length >= 500 && chart5m.length >= 500) {
			var lastClose = parseFloat(chart5m[chart5m.length - 1].close)

			var rsi15m = indicators.rsi(chart15m, 14, 100, 1)
			rsi15m = parseFloat(rsi15m[rsi15m.length - 1]).toFixed(2)
			var rsi5m = indicators.rsi(chart5m, 14, 100, 1)
			rsi5m = parseFloat(rsi5m[rsi5m.length - 1]).toFixed(2)

			vars.btcAnalysis.price = lastClose
			vars.btcAnalysis.rsi15m = rsi15m
			vars.btcAnalysis.rsi5m = rsi5m

			if(rsi15m > 70 && !vars.btcAnalysis.dangerZone) {
				chatBot.sendMessage(":triangular_flag_on_post: Danger: BTC is going up | " + lastClose + "$ | RSI 15m: " + rsi15m)
				vars.btcAnalysis.dangerZone = true
			}
			else if(rsi15m < 30 && !vars.btcAnalysis.dangerZone) {
				chatBot.sendMessage(":triangular_flag_on_post: Danger: BTC is going down | " + lastClose + "$ | RSI 15m: " + rsi15m)
				vars.btcAnalysis.dangerZone = true
			}
			else if(vars.btcAnalysis.dangerZone && rsi15m <= 65 && rsi15m >= 35) {
				chatBot.sendMessage(":waving_white_flag: Back to normal: BTC is stabilizing | " + lastClose + "$ | RSI 15m: " + rsi15m)
				vars.btcAnalysis.dangerZone = false
			}
		}
		setTimeout(controlBitcoinRSI, options.mainLoopTimer)
	}

	function processStrategies() {
		var dateStr = utils.formatDate(new Date(), true, true)

		if(!exchUtils.websocketActive(userDataWebsocket.listenKey)) {
			if(!userDataWebsocket.connecting && Date.now() - userDataWebsocket.connectionTimestamp > 10 * 1000) {
				console.log("Loading connection for user data updates: " + dateStr)
				initUserDataUpdates()
			}
			else {
				console.log("Waiting connection for user data updates: " + dateStr)
			}
		}
		else {
			var consoleMsg = "Processing: " + dateStr
			var activeStrategies = strategyManager.listStrategies(true)

			if(!activeStrategies.length) {
				consoleMsg += " | No active strategies"
			}
			else {
				for(var i = 0; i < activeStrategies.length; ++i) {
					var strategy = activeStrategies[i]
					var paperTradingStr = strategy.paperTrading() ? "[PT] " : ""
					consoleMsg += " | " + paperTradingStr + strategy.name() + " - " + strategy.validPairs().length + " " + strategy.tradingPairs().length + " " + strategy.profit().toFixed(2) + "%"
				}
			}

			console.log(consoleMsg)

			strategyManager.process()
		}

		setTimeout(processStrategies, options.mainLoopTimer)
	}

	function checkNextDay() {
		var currentDate = new Date()
		currentDate = currentDate.getTime()
		var currentSecond = currentDate / 1000
		var currentDay = Math.floor(currentSecond / 86400)

		if(vars.currentDay == -1) {
			vars.currentDay = currentDay
		}
		else if(currentDay > vars.currentDay) {
			exchUtils.accountTotalBalance(function(error, balance) {
				if(error) {
					console.log("Error reading total account balance: " + error)
					return
				}

				vars.startBTCAmount = balance.btcTotal.toFixed(8)

				var strategiesList = strategyManager.listStrategies()
				var totalProfit = 0
				var totalAccountProfit = 0
				for(var i = 0; i < strategiesList.length; ++i) {
					var strategy = strategiesList[i]
					totalProfit += strategy.profit()
					totalAccountProfit += strategy.accountProfit()
					strategy.resetProfits()
				}

				vars.currentDay = currentDay

				chatBot.sendMessage(":clock12: New day: " + utils.formatDate(new Date(), true, true) + "\n" +
                    "Profit from previous day: " + totalProfit.toFixed(2) + "% | " + totalAccountProfit.toFixed(2) + "%\n" +
                    "Total: " + vars.startBTCAmount + "BTC | " + balance.usdtTotal.toFixed(2) + "$")
			})
		}

		setTimeout(checkNextDay, 1000 * 60)
	}

	return {
		vars: vars,
		exchUtils: exchUtils,
		indicators: indicators,
		options: function(opt) {
			if(typeof opt.strategiesDir === "string") options.strategiesDir = opt.strategiesDir
			if(typeof opt.commandsCustomDir === "string") options.commandsCustomDir = opt.commandsCustomDir
			if(typeof opt.mainLoopTimer === "number") options.mainLoopTimer = opt.mainLoopTimer
			if(typeof opt.pauseDangerBTC === "boolean") options.pauseDangerBTC = opt.pauseDangerBTC
			if(typeof opt.verbose === "boolean") options.verbose = opt.verbose
			options.binance = opt.binance
			options.telegram = opt.telegram || {}
			options.discord = opt.discord || {}
			vars.options = options
		},
		listenToChatId: function() {
			console.log("WTF")
			chatBot.init(true)
		},
		start: function(next) {
			binance.options({
				"APIKEY": vars.options.binance.key,
				"APISECRET": vars.options.binance.secret,
				useServerTime: true,
				reconnect: false
			})

			var oldLog = console.log
			console.log = function() {
				if(vars.options.verbose) oldLog.apply(console, arguments)
			}

			exchUtils.initExchangeInfo(function(error) {
				if(error) {
					console.log("Error initializing exchange info.", error)
					if(next) next("Error initializing exchange info.")
					return
				}

				exchUtils.accountTotalBalance(function(error, balance) {
					if(error) {
						console.log("Error reading total account balance: " + error)
						if(next) next("Error reading total account balance.")
						return
					}

					vars.startBTCAmount = balance.btcTotal.toFixed(8)

					chatBot.init()
					initUserDataUpdates()
					initPairs()
					strategyManager.init()

					vars.pairs["BTCUSDT"].addWatcherChartUpdates(btcIntervalsWatch)

					chatBot.sendMessage(":traffic_light: BitProphet started: " + utils.formatDate(new Date(), true, true) + "\nTotal: " +
                        vars.startBTCAmount + "BTC | " + balance.usdtTotal.toFixed(2) + "$")

					console.log("Initialization complete.")
					vars.initialized = true

					controlBitcoinRSI()
					processStrategies()
					checkNextDay()
				})
			})
		}
	}
}()
