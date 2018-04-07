var pjson = require(__dirname + '/package.json');
var vars = require(__dirname + '/vars.js')
var utils = require(__dirname + '/utils.js')
var exchUtils = require(__dirname + '/exchange_utils.js')
var indicators = require(__dirname + '/indicators.js')
const TelegramBot = require('node-telegram-bot-api');
const binance = require('node-binance-api');
var emoji = require('node-emoji')
var chatBot

module.exports = {
    init: function(listenChatIdOnly = false) {
        chatBot = new TelegramBot(vars.options.telegram.token, {polling: true});

        if(listenChatIdOnly) {
            chatBot.on('message', (msg) => {
                const chatId = msg.chat.id;
                console.log("CHAT ID:", chatId)
                chatBot.sendMessage(chatId, 'CHAT ID: ' + chatId);
            });
            return
        }

        chatBot.on('polling_error', function(error) {
            console.log("Telegram error:", error)
        });

        chatBot.on('message', (msg) => {
            var message = msg.text.toLowerCase()
            if(message == "status" || message == "st") {
                var text = ':sunglasses: BitProphet v' + pjson.version + '\nRunning since ' + utils.formatDate(vars.startTime)
                if(vars.btcAnalysis.dangerZone && vars.options.pauseDangerBTC) text+= "\n" + ":triangular_flag_on_post: System paused due to BTC"
                else if(vars.paused) text+= "\n" + ":coffee: System paused"
                this.sendMessage(text);
            }
            else if(message == "account" || message == "total" || message == "ttl") {
                this.sendMessage(":speech_balloon:");

                exchUtils.accountTotalBalance((error, balance) => {
                    if(error) {
                        this.sendMessage('Error reading total account balance');
                        console.log("Error reading total account balance: " + error)
                        return
                    }
                    this.sendMessage(":moneybag: Total: " + balance.btcTotal.toFixed(8) + "BTC | " + balance.usdtTotal.toFixed(2) + "$\nBTC available: " +
                        balance.btcAvailable.toFixed(8) + "\nBNB available: " + balance.bnbAmount.toFixed(2));
                })
            }
            else if(message == "btc") {
                this.sendMessage(":dollar: " + vars.pairs["BTCUSDT"].chatName() + ": " + vars.btcAnalysis.price.toFixed(2) +
                    "$\nRSI - 5m: " + vars.btcAnalysis.rsi5m + " | 15m: " + vars.btcAnalysis.rsi15m)
            }
            else if(message.startsWith("profits") || message.startsWith("%")) {
                var verbose = false
                if(message.indexOf(" ") > 0) {
                    var split = message.split(" ")
                    if(split.length == 2 && (split[1] == "pairs" || split[1] == "+")) verbose = true
                }

                var totalProfit = 0
                var totalAccountProfit = 0
                var profitString = ":bar_chart: Profits\n"

                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    if(!strategy.profit() && !strategy.accountProfit()) continue

                    profitString += strategy.name() + ": " + parseFloat(strategy.profit()).toFixed(2) + "% | " + parseFloat(strategy.accountProfit()).toFixed(2) + "%\n"
                    totalProfit += strategy.profit()
                    totalAccountProfit += strategy.accountProfit()

                    if(verbose) {
                        var pairs = strategy.pairs()
                        for(var j = 0; j < pairs.length; ++j) {
                            var pair = pairs[j]
                            if(!pair.profit && !pair.accountProfit) continue
                            profitString += pair.chatName + ": " + parseFloat(pair.profit).toFixed(2) + "% | " + parseFloat(pair.accountProfit).toFixed(2) + "%\n"
                        }
                    }
                }

                var totalBTC = vars.startBTCAmount * (totalAccountProfit / 100.)
                profitString += "Total: " + totalProfit.toFixed(2) + "% | " + totalAccountProfit.toFixed(2) + "% - " + totalBTC.toFixed(8) + "BTC"
                this.sendMessage(profitString);
            }
            else if(message == "left" || message == "l") {
                this.sendMessage(":speech_balloon:");

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

                            var totalBought = strategy.buyTradedInfo(pair).amountMarketPrice
                            var totalSold = strategy.sellTradedInfo(pair).amountMarketPrice
                            var sellCurrentPrice = totalSold + (tokens[pair.name] * pair.amountToSell)
                            var currentProfit = (sellCurrentPrice - totalBought) / totalBought * 100
                            var fees = (sellCurrentPrice + totalBought) * vars.tradingFees
                            var currentAccountProfit = (sellCurrentPrice - totalBought - fees) / vars.startBTCAmount * 100

                            var sellTarget = ""
                            if(pair.sellTarget > 0) {
                                var sellTargetPercentage = (tokens[pair.name] - pair.sellTarget) / pair.sellTarget * 100
                                sellTarget = " -> " + exchUtils.fixPrice(pair.name, parseFloat(pair.sellTarget).toFixed(8)) + "[" + sellTargetPercentage.toFixed(2) + "%]"
                            }

                            var spacer = strategyStr.length ? "\n" : ""
                            strategyStr += spacer + pair.chatName + " " + tokens[pair.name] + "[" + currentProfit.toFixed(2) + "% | " +
                                currentAccountProfit.toFixed(2) + "%]" + sellTarget
                        }

                        if(strategyStr.length) {
                            strategyStr = ":barber: " + strategy.name() + ":\n" + strategyStr
                            leftPairsStr += strategyStr + "\n"
                        }
                    }
                    if(!leftPairsStr.length) leftPairsStr = ":ok_hand: Nothing left to sell."
                    this.sendMessage(leftPairsStr);
                })
            }
            else if(message == "pause") {
                vars.paused = !vars.paused

                if(vars.paused) this.sendMessage(":coffee: System paused.");
                else this.sendMessage(":thumbsup: System resumed.");
            }
            else if(message.startsWith("exit ") || message.startsWith("sell ")) {
                var split = message.split(" ")
                if(split.length < 2) {
                    this.sendMessage("Name a token");
                    return
                }
                var pairName = split[1]
                pairName = pairName.toUpperCase()

                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    var pairs = strategy.tradingPairs()

                    for(var j = 0; j < pairs.length; ++j) {
                        var pair = pairs[j]
                        if(pair.token != pairName && pair.name != pairName) continue
                        if(!pair.amountToSell) continue

                        if(split.length == 3) {
                            var price = parseFloat(split[2])
                            pair.sellTarget = price
                            pair.forceSell = true
                            this.sendMessage(":thumbsup: Force sell triggered for " + pair.chatName + "@" +
                                parseFloat(exchUtils.fixPrice(pair.name, pair.sellTarget)).toFixed(8));
                        }
                        else {
                            binance.prices(pair.name, (error, ticker) => {
                                if(error) {
                                    this.sendMessage('Error fetching prices for ' + pair.chatName);
                                    console.log("Error fetching price for", pair.name, error)
                                    return
                                }
                                pair.sellTarget = parseFloat(ticker[pair.name])
                                pair.forceSell = true
                                this.sendMessage(":thumbsup: Force sell triggered for " + pair.chatName + "@" + pair.sellTarget);
                            });
                        }

                        return
                    }
                }

                this.sendMessage(":grey_question: " + pairName + " - no trading pair found");
            }
            else if(message.startsWith("cancel ") || message.startsWith("ignore ")) {
                var split = message.split(" ")
                if(split.length < 2) {
                    this.sendMessage("Name a token");
                    return
                }
                var pairName = split[1]
                pairName = pairName.toUpperCase()

                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    var pairs = strategy.tradingPairs()

                    for(var j = 0; j < pairs.length; ++j) {
                        var pair = pairs[j]
                        if(pair.token != pairName && pair.name != pairName) continue
                        this.sendMessage(":thumbsup: Trade canceled for " + pair.chatName);
                        strategy.resetPairData(pair.name)
                        return
                    }
                }

                this.sendMessage(":grey_question: " + pairName + " - no trading pair found");
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
                    this.sendMessage(':grey_question: No strategy found with id ' + strategyId);
                    return
                }

                if(action == "start") {
                    if(strategy.active()) {
                        this.sendMessage(strategy.name() + ' already started');
                        return
                    }
                    strategy.setActive(true)
                    this.sendMessage(":large_orange_diamond: " + strategy.name() + ' started');
                }
                else if(action == "stop") {
                    if(!strategy.active()) {
                        this.sendMessage(strategy.name() + ' already stopped');
                        return
                    }
                    strategy.setActive(false)
                    this.sendMessage(":ghost: " + strategy.name() + ' stopped');
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
            else if(message.startsWith("list")) {
                var strategyId = null
                if(message.indexOf(" ") > 0) {
                    var split = message.split(" ")
                    if(split.length == 2) strategyId = split[1]
                }

                if(strategyId) {
                    for(var i = 0; i < vars.strategies.length; ++i) {
                        var strategy = vars.strategies[i]
                        if(strategy.id() == strategyId) {
                            var messageTrading = ""
                            var messageValid = ""

                            var tradingPairs = strategy.tradingPairs()
                            var tradingPairNames = []
                            for(var i = 0; i < tradingPairs.length; ++i) {
                                var tradingPair = tradingPairs[i]
                                tradingPairNames.push(tradingPair.chatName)
                            }

                            var validPairs = strategy.validPairs()
                            var validPairNames = []
                            for(var i = 0; i < validPairs.length; ++i) {
                                var validPair = validPairs[i]
                                validPairNames.push(validPair.chatName)
                            }

                            tradingPairNames.sort()
                            validPairNames.sort()

                            for(var i = 0; i < tradingPairNames.length; ++i) {
                                if(messageTrading.length) messageTrading += "\n"
                                messageTrading += tradingPairNames[i]
                            }

                            for(var i = 0; i < validPairNames.length; ++i) {
                                if(messageValid.length) messageValid += "\n"
                                messageValid += validPairNames[i]
                            }

                            if(messageTrading.length) messageTrading = "Trading Pairs [" + tradingPairNames.length + "]:\n" + messageTrading + "\n"
                            if(messageValid.length) messageValid = "Valid Pairs [" + validPairNames.length + "]:\n" + messageValid

                            this.sendMessage(":page_with_curl: " + strategy.name() + "\n" + messageTrading + messageValid);
                            return
                        }
                    }

                    this.sendMessage(':grey_question: No strategy found with id ' + strategyId);
                }
                else {
                    var messageStarted = ""
                    var messageStopped = ""

                    for(var i = 0; i < vars.strategies.length; ++i) {
                        var strategy = vars.strategies[i]
                        var strategyMsg = "." + strategy.name() + " (" + strategy.id() + ")" + " " + strategy.validPairs().length + ", " + strategy.tradingPairs().length
                        if(strategy.active()) {
                            if(messageStarted.length) messageStarted += "\n"
                            messageStarted += strategyMsg
                        }
                        else {
                            if(messageStopped.length) messageStopped += "\n"
                            messageStopped += strategyMsg
                        }
                    }

                    if(messageStarted.length) messageStarted = "Started:\n" + messageStarted + "\n"
                    if(messageStopped.length) messageStopped = "Stopped:\n" + messageStopped

                    this.sendMessage(":page_with_curl: Strategies\n" + messageStarted + messageStopped);
                }
            }
            else if(message == "restart") {
                this.sendMessage("I'll be back");

                setTimeout(function(){
                    process.exit(0)
                }, 3000);
            }
            else if(message == "congrats" || message == "nice work" || message == "nice job" || message == "well done" || message == "congratulations") {
                var totalAccountProfit = 0
                for(var i = 0; i < vars.strategies.length; ++i) {
                    var strategy = vars.strategies[i]
                    totalAccountProfit += strategy.accountProfit()
                }

                if(totalAccountProfit > 0) {
                    var messages = ["Thank you, sir", "Just doing what I know best, sir", "To you too sir", "Enjoy your money sir",
                        ":relaxed::v::moneybag::tada::champagne:"]
                    this.sendMessage(messages[Math.floor(Math.random() * messages.length)]);
                }
                else if(totalAccountProfit == 0) {
                    var messages = ["Are you sure, sir?", "Okay sir", "You love fugazzi, don't you sir?"]
                    this.sendMessage(messages[Math.floor(Math.random() * messages.length)]);
                }
                else {
                    var messages = [":cry:", ":sweat_smile:", "Not my fault sir", "You know that hurts, don't you sir?"]
                    this.sendMessage(messages[Math.floor(Math.random() * messages.length)]);
                }
            }
            else if(message == "bedtime") {
                var messages = ["I can handle it by myself sir", "Dream with money and I'll take care of the rest, sir", "Sleep well sir",
                    "Random mode activated sir"]
                this.sendMessage(messages[Math.floor(Math.random() * messages.length)]);
            }
            else if(message == "jarvis") {
                var messages = ["Who?", "Do you want me to clean your suit and activate the flight mode, sir?"]
                this.sendMessage(messages[Math.floor(Math.random() * messages.length)]);
            }
            else {
                var messages = ["Sorry, I can't understand you sir. :heart:", "Sorry, no can do sir.", "Chinese now sir?"]
                this.sendMessage(messages[Math.floor(Math.random() * messages.length)]);
            }
        });
    },
    sendMessage: function(message) {
        chatBot.sendMessage(vars.options.telegram.chatId, emoji.emojify(message));
    },
}
