[![Latest Version](https://img.shields.io/github/release/andresilvasantos/bitprophet.svg?style=flat-square)](https://github.com/andresilvasantos/bitprophet/releases) 
[![GitHub last commit](https://img.shields.io/github/last-commit/andresilvasantos/bitprophet.svg?maxAge=2400)](#)
[![npm downloads](https://img.shields.io/npm/dt/bitprophet.svg?maxAge=7200)](https://www.npmjs.com/package/bitprophet)

[![NPM](https://nodei.co/npm/bitprophet.png?compact=true)](https://npmjs.org/package/bitprophet)

# BitProphet
BitProphet is a node crypto trading platform for Binance exchange that uses chat bots as its interface. Its main purpose is the automation of trading techniques, but it can also be used as a simple order notification tracker or as an alert system for the most used technical indicators.
Suggestions and pull requests are very welcome!

#### Features
* Analyse hundreds of tokens in multiple intervals EVERY second
* Technical Indicators (SMA, EMA, RSI, Stochastics, Bollinger Bands, Ichimoku and more)
* Stop loss and trailing profits
* Paper trading
* Create your own strategies
* Be notified anywhere with Telegram or Discord

![Telegram Interface](https://github.com/andresilvasantos/bitprophet/raw/master/pres/chat_example.png)

#### Installation
```
npm install bitprophet --save
```

#### Setting Up Telegram Bot
First, you'll need to create a bot for Telegram. Just talk to [BotFather](https://telegram.me/botfather) and follow simple steps until it gives you a token for it.
You'll also need to create a Telegram group, the place where you and BitProphet will communicate. After creating it, add the bot as administrator (make sure to uncheck "All Members Are Admins").

#### Setting Up Discord Bot (optional)
Create a server and follow [these simple steps](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token) until you have a token and added the bot to the server you've just created.

#### Retrieving Chat IDs
In order to find out the chat id where your bot was added to, run node with the following code and then just say something in the group/server. The bot will reply with the chat id.

```javascript
const bitprophet = require('bitprophet')
bitprophet.options({
    telegram: {
        token: "YOUR_TELEGRAM_BOT_TOKEN"
    },
    discord: {
        token: "YOUR_DISCORD_BOT_TOKEN"
    }
})
bitprophet.listenToChatId()
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
    },
    discord: {
        chatId: "YOUR_DISCORD_CHANNEL_ID",
        token: "YOUR_DISCORD_BOT_TOKEN"
    }
})

bitprophet.start()
```

You should now see a message in Telegram/Discord telling you BitProphet has started.

In Telegram/Discord type __list__ and you'll see all the available strategies listed with the respective ids.
If a strategy listed has the [PT] prefix, it means it has Paper Trading active.
To start a strategy, just type __start strategy_id__. For example, __start buydip__.

![Getting Started](https://github.com/andresilvasantos/bitprophet/raw/master/pres/getting_started.png)

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
            //buyAmountMarket: 0.012,
            buyPercentageAccount: 0.01,
            profitTarget: 1.4,
            maxLoss: 0.8,
            maxTradingPairs: 4,
            targetMarket: "BTC"
        },
        ichitest: {
            name: "Ichimoku Test",
            paperTrading: true,
            buyAmountMarket: 0.012,
            profitTarget: 1.4,
            maxTradingPairs: 8,
            targetMarket: "BTC",
            excludeTokens: ["NEO", "TRX"]
        },
        //...
    }
}
```

Create your strategies based on the examples.

#### Chat Bots Commands

* __help__ | __h__ - Show all available commands
* __status__ | __st__ - Show version and status
* __account__ | __total__ | __ttl__ - Show total balance in BTC and USDT, plus BNB amount
* __profits__ | __%__ - Show profits
* __profits +__ | __% +__ - Show profits per pair
* __left__ | __l__ - Show trades left
* __sell token__ | __exit token__  - Sell token, if it's currently trading
* __sell token price__ | __exit token price__ - Sell token@price, if it's currently trading
* __cancel token__ - Cancel currently trading token
* __orders__ | __o__ - Show open orders
* __orders token__ | __o token__ - Show open orders for the given token
* __start strategyId__ - Start strategy
* __stop strategyId__ - Stop strategy
* __list__ - Show available strategies
* __list strategyId__ - Show valid / trading pairs for the given strategy
* __token__ | __tokenmarket__ - Show price for the specified token, BTC market default. (e.g. ada, adaeth)
* __pause__ - Pause system (ongoing trades won't be paused)
* __restart__ - Kill BitProphet's process. Useful when using a keep alive process manager like [pm2](https://github.com/Unitech/pm2).

![Profits Discord](https://github.com/andresilvasantos/bitprophet/raw/master/pres/chat_profits.png)

#### Adding Custom Commands
Add the following option naming a new directory for your commands.

```javascript
bitprophet.options({
    commandsCustomDir: "./path/my/commands"
})
```

Create *index.js* inside that folder with the configuration for all your commands
```javascript
module.exports = {
    commands: {
        test: {
            triggers: ["test", "t"]
            description: "Just a test command"
        },
        //...
    }
}
```

Create in the same directory *test.js* and code it based on the examples.

---

Thank you to all contributors: [supershwa](https://github.com/supershwa), [ionutgalita](https://github.com/ionutgalita)
