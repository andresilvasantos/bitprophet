process.env.NTBA_FIX_319 = 1;

var vars = require(__dirname + "/vars.js")
var exchUtils = require(__dirname + "/exchange_utils.js")
var emoji = require("node-emoji")

const TelegramBot = require(__dirname + "/telegram_bot.js")
const DiscordBot = require(__dirname + "/discord_bot.js")
const telegramBot = new TelegramBot()
const discordBot = new DiscordBot()
const commandGenerator = require(__dirname + "/command_generator.js")
const path = require("path")

var lastMessageTimestamp = 0
var messageQueue = []
var minIntervalSendMessage = 1200

module.exports = {
	init: function(listenChatIdOnly = false) {
		telegramBot.init(listenChatIdOnly)
		telegramBot.on("messageReceived", (message) => {
			this.receiveMessage(message)
		})

		discordBot.init(listenChatIdOnly)
		discordBot.on("messageReceived", (message) => {
			this.receiveMessage(message)
		})

		this.loadCommands(__dirname + "/commands")
		var customDir = vars.options.commandsCustomDir
		if(typeof customDir == "string") this.loadCommands(customDir)
	},
	loadCommands: function(commandsDir) {
		var commandsSettings = require(path.resolve(commandsDir, "index.js"))
		var commands = commandsSettings.commands
		var commandsArray = []
		for(var commandId of Object.keys(commands)) {
			var command = new commandGenerator.create(commandId, commandsDir)
			command.setTriggers(commands[commandId].triggers)
			command.setDescription(commands[commandId].description)
			command.setShowBalloon(commands[commandId].showBalloon)
			commandsArray.push(command)
		}
		vars.commands = vars.commands.concat(commandsArray)
	},
	receiveMessage: function(message) {
		var args = message.toLowerCase().split(" ")

		//Known command
		for(var i = 0; i < vars.commands.length; ++i) {
			var command = vars.commands[i]
			if(command.triggers().indexOf(args[0]) > -1) {
				if(command.showBalloon()) this.sendMessage(":speech_balloon:")
				command.run(args, (error, response) => {
					if(error) this.sendMessage(error)
					else this.sendMessage(response)
				})
				return
			}
		}

		//BTC Price + RSI
		if(args[0] == "btc" || args[0] == "btcusdt") {
			this.sendMessage(":dollar: " + vars.pairs["BTCUSDT"].chatName() + ": " + vars.btcAnalysis.price.toFixed(2) +
              "$\nRSI - 5m: " + vars.btcAnalysis.rsi5m + " | 15m: " + vars.btcAnalysis.rsi15m)
			return
		}

		//Token Price
		for(var pair of Object.values(vars.pairs)) {
			if((args[0] == pair.tokenName().toLowerCase() && pair.marketName() == "BTC") ||
                args[0] == pair.name().toLowerCase()) {
				this.sendMessage(":speech_balloon:")
				exchUtils.tokenPrice(pair.name(), (error, price) => {
					if (error) {
						this.sendMessage("Error fetching prices for " + pair.chatName())
						return
					}
					this.sendMessage(":dollar: " + pair.chatName() + ": " + price)
				})
				return
			}
		}

		//Unknown Message
		var messages = ["Sorry, I can't understand you sir. :heart:", "Sorry, no can do sir.", "Chinese now sir?"]
		this.sendMessage(messages[Math.floor(Math.random() * messages.length)])
	},
	sendMessage: function(message) {
		message = emoji.emojify(message)
		if(Date.now() - lastMessageTimestamp < minIntervalSendMessage || messageQueue.length) {
			//If this is the first message to be added to the queue, start the timer
			if(!messageQueue.length) {
				var interval = setInterval(function() {
					var message = messageQueue[0]

					telegramBot.sendMessage(message)
					discordBot.sendMessage(message)

					lastMessageTimestamp = Date.now()
					messageQueue.shift()
					if(!messageQueue.length) clearInterval(interval)
				}, minIntervalSendMessage)
			}

			//Add the message to the queue anyway
			messageQueue.push(message)
		}
		else {
			telegramBot.sendMessage(message)
			discordBot.sendMessage(message)

			lastMessageTimestamp = Date.now()
		}
	},
}
