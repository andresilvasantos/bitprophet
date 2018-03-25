var vars = require(__dirname + '/vars.js')
const utils = require(__dirname + '/utils.js')
const binance = require('node-binance-api');

module.exports = {
    initExchangeInfo: function(next) {
        binance.exchangeInfo(function(error, data) {
            if(data.symbols) {
                for(var obj of data.symbols ) {
            		var filters = {status: obj.status};
            		for (var filter of obj.filters) {
            			if ( filter.filterType == "MIN_NOTIONAL" ) {
            				filters.minNotional = filter.minNotional;
            			}
                        else if ( filter.filterType == "PRICE_FILTER" ) {
            				filters.minPrice = filter.minPrice;
            				filters.maxPrice = filter.maxPrice;
            				filters.tickSize = filter.tickSize;
            			}
                        else if ( filter.filterType == "LOT_SIZE" ) {
            				filters.stepSize = filter.stepSize;
            				filters.minQty = filter.minQty;
            				filters.maxQty = filter.maxQty;
            			}
            		}
            		filters.orderTypes = obj.orderTypes;
            		filters.icebergAllowed = obj.icebergAllowed;
            		vars.pairsInfo[obj.symbol] = filters;
            	}
            }

            next(error)
        });
    },
    accountTotalBalance: function(next) {
        var tokens = {}
        binance.prices((error, ticker) => {
            if(error) {
                next("Error reading prices: " + error)
                return
            }

            for ( var symbol in ticker ) {
                tokens[symbol] = parseFloat(ticker[symbol]);
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

                var balance = {};
                for ( var asset in balances ) {
                    var obj = balances[asset];
                    var available = isNaN(obj.available) ? 0 : parseFloat(obj.available);
                    var inOrder = isNaN(obj.onOrder) ? 0 : parseFloat(obj.onOrder);

                    if(asset == "BNB") accountBalance.bnbAmount = available

                    if(asset == "BTC") {
                        accountBalance.btcTotal += available + inOrder
                        accountBalance.btcAvailable = available
                    }
                    else if(asset == "USDT") accountBalance.btcTotal += (available + inOrder) / tokens.BTCUSDT;
                    else {
                        var btcValue = (available + inOrder) * tokens[asset+'BTC'];
                        if(!isNaN(btcValue)) accountBalance.btcTotal += btcValue
                    }
                }

                accountBalance.usdtTotal = accountBalance.btcTotal * tokens.BTCUSDT

                next(null, accountBalance)
            });
        });
    },
    normalizeAmount: function(pair, amount, price) {
        // Set minimum order amount with minQty
        if ( amount < vars.pairsInfo[pair].minQty ) amount = vars.pairsInfo[pair].minQty;
        // Set minimum order amount with minNotional
        if (price && price * amount < vars.pairsInfo[pair].minNotional ) {
            amount = vars.pairsInfo[pair].minNotional / price;
        }
        // Round to stepSize
        return binance.roundStep(amount, vars.pairsInfo[pair].stepSize);
    },
    fixPrice: function(pair, price) {
        var index = String(vars.pairsInfo[pair].tickSize).indexOf("1")
        var count = index - 1
        return parseFloat(price).toFixed(count)
    },
    createBuyOrder: function(pairName, price, amountBTC, next) {
        binance.balance((error, balances) => {
            if(error) {
                next("Error reading balances: " + error)
                return
            }
            if(balances.BTC.available > amountBTC) {
                var quantity = this.normalizeAmount(pairName, parseFloat(amountBTC / price), price)
                price = this.fixPrice(pairName, price)
                binance.buy(pairName, quantity, price, {type:'LIMIT'}, function(error, response) {
                    next(error, response.orderId, quantity, response.status == "FILLED")

                    /*if(!error) {
                        chatBot.sendMessage('New buy order: ' + pairName + " @ " + price);
                    }*/
                });
            }
            else {
                next("Not enough BTC available: " + balances.BTC.available)
            }
        });
    },
    createSellOrder: function(pairName, price, quantity, next) {
        quantity = this.normalizeAmount(pairName, quantity, price)
        price = this.fixPrice(pairName, price)
        binance.sell(pairName, quantity, price, {type:'LIMIT'}, function(error, response) {
            next(error, response.orderId, response.status == "FILLED")
            /*if(!error) {
                chatBot.sendMessage('New sell order: ' + pairName + " @ " + price);
            }*/
        });
    },
    createStopLoss: function(pairName, price, stopPrice, quantity, next) {
        quantity = this.normalizeAmount(pairName, quantity, price)
        stopPrice = this.fixPrice(pairName, stopPrice)
        price = this.fixPrice(pairName, price)
        binance.sell(pairName, quantity, price, {stopPrice: stopPrice, type: "STOP_LOSS_LIMIT"}, function(error, response) {
            next(error, response.orderId)
            /*if(!error) {
                chatBot.sendMessage('New stop loss order: ' + pairName + " @ " + price + " & stop @ " + stopPrice);
            }*/
        });
    },
    cancelOrder: function(pairName, orderId, next) {
        var targetOrder = null
        for(var i = 0; i < vars.strategies.length; ++i) {
            var strategy = vars.strategies[i]
            targetOrder = strategy.orderById(pairName, orderId)
            if(!targetOrder) continue
            break
        }

        if(!targetOrder) {
            return(next("Error: order with id " + orderId + " not found for " + pairName))
        }

        if(targetOrder.canceled) {
            return(next(null))
        }
        targetOrder.automatedCancel = true

        binance.cancel(pairName, orderId, function(error, response, symbol) {
            if(error) targetOrder.automatedCancel = false
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
        });
    },
    websocketActive: function(websocketName) {
        var endpoints = Object.keys(binance.websockets.subscriptions())
        return endpoints.indexOf(websocketName) != -1 ? true : false
    },
    terminateWebsocket: function(websocketName) {
        var endpoints = Object.keys(binance.websockets.subscriptions())
        if(endpoints.indexOf(websocketName) != -1) {
             binance.websockets.terminate(websocketName);
        }
    }
}
