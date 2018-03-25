var config = require(__dirname + '/config.js')
var vars = require(__dirname + '/vars.js')
const exchUtils = require(__dirname + '/exchange_utils.js')
const chatBot = require(__dirname + '/chat_bot.js')
const utils = require(__dirname + '/utils.js')
const pairGenerator = require(__dirname + '/pair_generator.js')
var indicators = require(__dirname + '/indicators.js')
var strategyManager = require(__dirname + '/strategy_manager.js')
const binance = require('node-binance-api');
var emoji = require('node-emoji')

binance.options({
  'APIKEY': config.binance.key,
  'APISECRET': config.binance.secret,
  useServerTime: true,
  reconnect: false
});

var btcIntervalsWatch = ["15m", "5m"]

function initPairs() {
    var exchangePairs = Object.keys(vars.pairsInfo)
    for(var i = 0; i < exchangePairs.length; ++i) {
        var pairName = exchangePairs[i]
        if(pairName == "BTCUSDT") {
            vars.btcUSDTPair = new pairGenerator.create(pairName)
            vars.btcUSDTPair.addWatcherChartUpdates(btcIntervalsWatch)
        }
        if(pairName.indexOf("BTC") != pairName.length - 3) continue

        var pair = new pairGenerator.create(pairName)
        vars.pairs[pairName] = pair
    }
}

function balance_update(data) {
	for ( let obj of data.B ) {
		let { a:asset, f:available, l:onOrder } = obj;
        if(asset == "BNB" && parseFloat(available) < 0.05) {
            chatBot.sendMessage(emoji.get("warning") + emoji.get("fuelpump") + " Low BNB | " + available)
            break
        }
	}
}
function execution_update(data) {
	let { x:executionType, s:symbol, p:price, q:quantity, S:side, o:orderType, i:orderId, X:orderStatus, z:filledQuantity } = data;

    var automatedOrder = false
    var traded = executionType == "TRADE"
    var isNew = executionType == "NEW"
    var canceled = executionType == "CANCELED"
    var filled = parseFloat(filledQuantity) / parseFloat(quantity)

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
        automatedOrder = true

        if(orderStatus == "FILLED") {
            if(side == "BUY") {
                pair.amountToSell += (1 - order.partFill) * parseFloat(quantity)
            }
            else {
                pair.amountToSell -= (1 - order.partFill) * parseFloat(quantity)
            }

            order.partFill = 1
        }
        else if(traded && filled < 1) {
            if(side == "BUY") {
                pair.amountToSell += (filled - order.partFill) * parseFloat(quantity)
            }
            else {
                pair.amountToSell -= (filled - order.partFill) * parseFloat(quantity)
            }

            order.partFill = filled
        }
        else if(canceled) {
            order.canceled = true
            order.waiting = false

            if(!order.automatedCancel) {
                chatBot.sendMessage(emoji.get("raised_hand") + " Trading stopped for pair " + symbol + " due to human intervention");
                strategy.resetPairData(pair.name)
            }
        }
    }

    //if(traded || automatedOrder) {
        var quantityFixed = quantity < 1 ? quantity : parseFloat(quantity).toFixed(2)
        //var nature = automatedOrder ? "[A]" : "[M]"
        var type, emojiStr
        if(traded) {
            type = "Traded"
            emojiStr = orderStatus == "FILLED" ? "high_brightness" : "low_brightness"
        }
        else if(isNew) {
            type = "Created"
            emojiStr = "package"
        }
        else {
            type = "Canceled"
            emojiStr = "wastebasket"
        }

        var oType = orderType == "STOP_LOSS_LIMIT" ? "SL " : ""
        var fill = traded ? " | " + parseFloat(filled * 100).toFixed(2) + "%" : ""

        chatBot.sendMessage(emoji.get(emojiStr) + " " + oType + type + " - " + symbol + "\t" + side + " "+ quantityFixed + "@" + exchUtils.fixPrice(symbol, price) + fill);
    //}
}

function controlBitcoinRSI() {
    vars.btcUSDTPair.ensureChartUpdates(btcIntervalsWatch)
    var chart15m = vars.btcUSDTPair.chart(btcIntervalsWatch[0]).ticks
    var chart5m = vars.btcUSDTPair.chart(btcIntervalsWatch[1]).ticks

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
            chatBot.sendMessage(emoji.get("triangular_flag_on_post") + " Danger: BTC is going up | " + lastClose + "$ | RSI 15m: " + rsi15m)
            vars.btcAnalysis.dangerZone = true
        }
        else if(rsi15m < 30 && !vars.btcAnalysis.dangerZone) {
            chatBot.sendMessage(emoji.get("triangular_flag_on_post") + " Danger: BTC is going down | " + lastClose + "$ | RSI 15m: " + rsi15m)
            vars.btcAnalysis.dangerZone = true
        }
        else if(vars.btcAnalysis.dangerZone && rsi15m <= 65 && rsi15m >= 35) {
            chatBot.sendMessage(emoji.get("waving_white_flag") + " Back to normal: BTC is stabilizing | " + lastClose + "$ | RSI 15m: " + rsi15m)
            vars.btcAnalysis.dangerZone = false
        }
    }
    setTimeout(controlBitcoinRSI, 1500)
}

function processStrategies() {
    var consoleMsg = "Processing: " + utils.formatDate(new Date(), true, true)
    var activeStrategies = strategyManager.listStrategies(true)

    if(!activeStrategies.length) {
        consoleMsg += " | No active strategies"
    }
    else {
        for(var i = 0; i < activeStrategies.length; ++i) {
            var strategy = activeStrategies[i]
            consoleMsg += " | " + strategy.name() + " - " + strategy.validPairs().length + " " + strategy.tradingPairs().length + " " + strategy.profit().toFixed(2) + "%"
        }
    }

    console.log(consoleMsg)

    strategyManager.process()

    setTimeout(processStrategies, 1500)
}

exchUtils.initExchangeInfo(function(error) {
    if(error) {
        console.log("Error initializing exchange info.", error)
        process.exit(1)
    }

    exchUtils.accountTotalBalance(function(error, balance) {
        if(error) {
            console.log("Error reading total account balance: " + error)
            process.exit(1)
        }

        vars.startBTCAmount = balance.btcTotal.toFixed(8)

        chatBot.init()
        binance.websockets.userData(balance_update, execution_update);
        initPairs()
        strategyManager.init()

        chatBot.sendMessage(emoji.get("traffic_light") + " BitProphet started: " + utils.formatDate(new Date(), true, true) + "\nTotal: " +
            vars.startBTCAmount + "BTC | " + balance.usdtTotal.toFixed(2) + "$")
        console.log("Initialization complete.")

        controlBitcoinRSI()
        processStrategies()
    })
})
