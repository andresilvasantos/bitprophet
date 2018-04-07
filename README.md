[![NPM](https://nodei.co/npm/bitprophet.png?compact=true)](https://npmjs.org/package/bitprophet)

# BitProphet
BitProphet is a node crypto trading platform for Binance exchange that uses Telegram as the interface. Its main purpose is the automation of trading techniques, but it can also be used as a simple order notification tracker or as an alert system for the most used technical indicators.
Suggestions and pull requests are very welcome!

#### Features
* Analyse hundreds of tokens in multiple intervals EVERY second
* Technical Indicators (SMA, EMA, RSI, Stochastics, Bollinger Bands, Ichimoku and more)
* Stop loss and trailing profits
* Create your own strategies
* Be notified anywhere

![Telegram Interface](https://github.com/andresilvasantos/bitprophet/raw/master/pres/chat_example.png)

#### Installation
```
npm install bitprophet --save
```

#### Setting Up Telegram
First, you'll need to create a bot for Telegram. Just talk to [BotFather](https://telegram.me/botfather) and follow simple steps until it gives you a token for it.
You'll also need to create a Telegram group, the place where you and BitProphet will communicate. After creating it, add the bot as administrator (make sure to uncheck "All Members Are Admins").

#### Retrieving Telegram's Group ID
In order to find out the group id you've just created, run node with the following code and then just say something in the group. The bot will reply with the chat id.

```javascript
const bitprophet = require('bitprophet')
bitprophet.options({
    telegram: {
        token: "YOUR_TELEGRAM_BOT_TOKEN"
    }
})
bitprophet.listenToTelegramChatId()
```

![Chat ID](https://github.com/andresilvasantos/bitprophet/raw/master/pres/chat_id.png)

#### Getting Started
This is the code to start BitProphet. If the only thing you need is to be notified of trades, you're done.

```javascript
const bitprophet = require('bitprophet')
bitprophet.options({
    binance: {
        key: "YOUR_BINANCE_API_KEY",
        secret: "YOUR_BINANCE_API_SECRET"
    },
    telegram: {
        chatId: "YOUR_TELEGRAM_GROUP_ID",
        token: "YOUR_TELEGRAM_BOT_TOKEN"
    }
})

bitprophet.start()
```

#### Adding Strategies
Add the following option naming a new directory for your strategies.

```javascript
bitprophet.options({
    strategiesDir: "./path/my/strategies"
})
```

Create *index.js* inside that folder with the configuration for all your strategies
```javascript
module.exports = {
    strategies: {
        alertsbb: {
            name: "Alerts Bollinger Bands",
            targetMarket: "BTC"
        },
        quickdip: {
            name: "Quick Dip",
            //buyAmountBTC: 0.012,
            buyPercentageAccount: 0.01,
            profitTarget: 1.4,
            maxLoss: 0.8,
            maxTradingPairs: 4,
            targetMarket: "BTC"
        },
        //...
    }
}
```

Create your strategies based on the examples.

#### Telegram BitProphet Cheat Sheet

* __status__ / __st__ - Check BitProphet's version and status
* __account__ / __total__ / __ttl__ - Total balance in BTC and USDT, plus BNB amount
* __btc__ - BTC value
* __profits__ / __%__ - Profits
* __profits +__ / __% +__ - Profits detailed
* __left__ / __l__ - Trades left
* __pause__ - Pause system (ongoing trades won't be paused)
* __exit token__ / __sell token__ - Sells token, if it's currently trading
* __exit token price__ / __sell token price__ - Sells token@price, if it's currently trading
* __cancel token__ / __ignore token__ - Cancel currently trading token
* __start strategyId__ - Starts strategy
* __stop strategyId__ - Stops strategy
* __list__ - Lists all strategies
* __list strategyId__ - Lists all valid / trading pairs for the given strategy
* __restart__ - Kills the platform. Useful when using a keep alive process manager like [pm2](https://github.com/Unitech/pm2).
