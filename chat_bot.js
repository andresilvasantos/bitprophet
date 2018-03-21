var config = require(__dirname + '/config.js')
var vars = require(__dirname + '/vars.js')
var utils = require(__dirname + '/utils.js')
var exchUtils = require(__dirname + '/exchange_utils.js')
var indicators = require(__dirname + '/indicators.js')
const TelegramBot = require('node-telegram-bot-api');
const chatBot = new TelegramBot(config.telegram.token, {polling: config.telegram.polling});
const binance = require('node-binance-api');

module.exports = {
    init: function() {
        chatBot.on('polling_error', function(error) {
            console.log("Telegram error:", error)
        });

        chatBot.on('message', (msg) => {
            var message = msg.text.toLowerCase()
            if(message == "status" || message == "st") {
                //TODO estimated profit last 24h
                var text = 'BitProphet v' + vars.version + ' | Running since ' + utils.formatDate(vars.startTime)
                if(vars.redAlert) text+= " | System paused due to BTC"
                else if(vars.paused) text+= " | System paused"
                this.sendMessage(text);
            }
            else if(message == "account" || message == "total" || message == "ttl") {
                this.sendMessage('Please wait...');

                var tokens = {}
                binance.prices((error, ticker) => {
                    if(error) {
                        this.sendMessage('Error reading prices.');
                        console.log("Error reading prices: " + error)
                        return
                    }
                	for ( var symbol in ticker ) {
                		tokens[symbol] = parseFloat(ticker[symbol]);
                	}

                	binance.balance((error, balances) => {
                        if(error) {
                            this.sendMessage('Error reading balances.');
                            console.log("Error reading balances: " + error)
                            return
                        }
                        var bnbAmount = 0
                        var btcTotal = 0
                        var btcAvailable = 0
                        var usdtTotal = 0

                		var balance = {};
                		for ( var asset in balances ) {
                            var obj = balances[asset];
                			var available = isNaN(obj.available) ? 0 : parseFloat(obj.available);
                			var inOrder = isNaN(obj.onOrder) ? 0 : parseFloat(obj.onOrder);

                            if(asset == "BNB") bnbAmount = available

                            if(asset == "BTC") {
                                btcTotal += available + inOrder
                                btcAvailable = available
                            }
                            else if(asset == "USDT") btcTotal += (available + inOrder) / tokens.BTCUSDT;
                            else {
                                var btcValue = (available + inOrder) * tokens[asset+'BTC'];
                                if(!isNaN(btcValue)) btcTotal += btcValue
                            }
                		}

                        usdtTotal = btcTotal * tokens.BTCUSDT

                        this.sendMessage("Total: " + btcTotal.toFixed(8) + "BTC | " + usdtTotal.toFixed(2) + "$\nBTC available: " + btcAvailable.toFixed(8) + "\nBNB available: " + bnbAmount.toFixed(2));
                	});
                });
            }
            else if(message == "btc") {
                var ticks = vars.btcUSDTPair.chart("15m").ticks
                var lastClose = parseFloat(ticks[ticks.length - 1].close)
                var rsi15m = indicators.rsi(ticks, 14, 100, 1)
                rsi15m = parseFloat(rsi15m[rsi15m.length - 1]).toFixed(2)

                this.sendMessage("BTC / USDT: " + lastClose + "$ | RSI 15m: " + rsi15m);
            }
            else if(message == "profits" || message == "profit" || message == "%") {
                var totalProfit = 0
                var totalBTC = 0
                var profitString = ""

                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    if(strategy.profit() != 0) {
                        profitString += strategy.name() + ": " + parseFloat(strategy.profit()).toFixed(2) + "%\n"
                        totalProfit += strategy.profit()
                        totalBTC += (strategy.profit() / 100.) * strategy.buyAmountBTC()
                    }
                }

                profitString += "Total: " + totalProfit.toFixed(2) + "% - " + totalBTC.toFixed(8)
                this.sendMessage(profitString);
            }
            else if(message == "left") {
                this.sendMessage('Please wait...');

                var leftPairsStr = ""

                var tokens = {}
                binance.prices((error, ticker) => {
                    if(error) {
                        this.sendMessage('Error reading prices.');
                        console.log("Error reading prices: " + error)
                        return
                    }
                	for ( var symbol in ticker ) {
                		tokens[symbol] = parseFloat(ticker[symbol]);
                	}

                    for(var i = 0; i < vars.strategies.length; ++i) {
                        var strategy = vars.strategies[i]
                        var pairs = strategy.tradingPairs()

                        var strategyStr = ""
                        var pairsStr = ""

                        for(var j = 0; j < pairs.length; ++j) {
                            var pair = pairs[j]
                            if(!pair.amountToSell) continue

                            var spacer = strategyStr.length ? " | " : ""
                            var percentage = ((tokens[pair.name] - pair.entryPrice) / pair.entryPrice) * 100
                            var sellTarget = pair.sellTarget > 0 ? " -> " + exchUtils.fixPrice(pair.name, parseFloat(pair.sellTarget).toFixed(8)) : ""
                            strategyStr += spacer + pair.name + " " + tokens[pair.name] + "[" + percentage.toFixed(2) + "%]" + sellTarget
                        }

                        if(strategyStr.length) {
                            strategyStr = strategy.name() + ":\n" + strategyStr
                            leftPairsStr += strategyStr + "\n"
                        }
                    }
                    if(!leftPairsStr.length) leftPairsStr = "Nothing left to sell."
                    this.sendMessage(leftPairsStr);
                })
            }
            else if(message == "pause") {
                vars.paused = !vars.paused

                if(vars.paused) this.sendMessage("System paused.");
                else this.sendMessage("System resumed.");
            }
            else if(message.startsWith("exit ") || message.startsWith("sell ")) {
                var split = message.split(" ")
                if(split.length < 2) {
                    this.sendMessage("Name a token");
                    return
                }
                var pairName = split[1]
                pairName = String(pairName + "BTC").toUpperCase()

                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    var pairs = strategy.tradingPairs()

                    for(var j = 0; j < pairs.length; ++j) {
                        var pair = pairs[j]
                        if(pair.name != pairName) continue
                        if(!pair.amountToSell) continue

                        if(split.length == 3) {
                            var price = parseFloat(split[2]).toFixed(8)
                            pair.sellTarget = exchUtils.fixPrice(pairName, price)
                            pair.forceSell = true
                            this.sendMessage("Force sell triggered for " + pairName + "@" + pair.sellTarget);
                        }
                        else {
                            binance.prices(pairName, (error, ticker) => {
                                if(error) {
                                    this.sendMessage('Error fetching prices for ' + pairName);
                                    console.log("Error fetching price for", pairName, error)
                                    return
                                }
                                pair.sellTarget = ticker[pairName]
                                pair.forceSell = true
                                this.sendMessage("Force sell triggered for " + pairName + "@" + pair.sellTarget);
                            });
                        }

                        return
                    }
                }

                this.sendMessage(pairName + " - no trading pair found");
            }
            else if(message.startsWith("cancel ") || message.startsWith("ignore ")) {
                var split = message.split(" ")
                if(split.length < 2) {
                    this.sendMessage("Name a token");
                    return
                }
                var pairName = split[1]
                pairName = String(pairName + "BTC").toUpperCase()

                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    var pairs = strategy.tradingPairs()

                    for(var j = 0; j < pairs.length; ++j) {
                        var pair = pairs[j]
                        if(pair.name != pairName) continue
                        this.sendMessage("Trade canceled for " + pairName);
                        strategy.resetPairData(pairName)
                        return
                    }
                }

                this.sendMessage(pairName + " - no trading pair found");
            }
            else if(message.startsWith("start ") || message.startsWith("stop ") || message.startsWith("reload ")) {
                var split = message.split(" ")
                if(split.length < 2) {
                    this.sendMessage("Name a strategy");
                    return
                }
                var action = split[0]
                var strategyId = split[1]

                var strategy = null

                for(var i = 0; i < vars.strategies.length; ++i) {
                    if(vars.strategies[i].id() == strategyId) {
                        strategy = vars.strategies[i]
                        break
                    }
                }

                if(!strategy) {
                    this.sendMessage('No strategy found with id ' + strategyId);
                    return
                }

                if(action == "start") {
                    if(strategy.active()) {
                        this.sendMessage(strategy.name() + ' already started');
                        return
                    }
                    strategy.setActive(true)
                    this.sendMessage(strategy.name() + ' started');
                }
                else if(action == "stop") {
                    if(!strategy.active()) {
                        this.sendMessage(strategy.name() + ' already stopped');
                        return
                    }
                    strategy.setActive(false)
                    this.sendMessage(strategy.name() + ' stopped');
                }
                else if(action == "reload") {
                    if(strategy.active()) {
                        this.sendMessage('You need to stop the strategy first');
                        return
                    }
                    strategy.reloadSource()
                    this.sendMessage(strategy.name() + ' reloaded');
                }
            }
            else if(message == "list" || message == "strat") {
                var messageStarted = ""
                var messageStopped = ""

                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    var strategyMsg = strategy.name() + " (" + strategy.id() + ")" + " " + strategy.validPairs().length + ", " + strategy.tradingPairs().length + " " + parseFloat(strategy.profit()).toFixed(2) + "%"
                    if(strategy.active()) {
                        if(messageStarted.length) messageStarted += "\n"
                        messageStarted += strategyMsg
                    }
                    else {
                        if(messageStopped.length) messageStopped += "\n"
                        messageStopped += strategyMsg
                    }
                }

                this.sendMessage("Started:\n" + messageStarted + "\n" + "Stopped:\n" + messageStopped);
            }
            else {
                var messages = ["Sorry, I can't understand you. <3", "Sorry, no can do.", "Chinese now?", "That's what she said!"]
                this.sendMessage(messages[Math.floor(Math.random() * messages.length)]);
            }
        });
    },
    sendMessage: function(message) {
        chatBot.sendMessage(config.telegram.channelId, message);
    },
}
