var vars = require(__dirname + "/vars.js")
const DiscordBot = require("discord.js")
var chatBot = null
var ready = false
var messageQueue = []

const EventEmitter = require("events")

class Bot extends EventEmitter {
	constructor() {
		super()
	}

	init(listenChatIdOnly = false) {
		var token = vars.options.discord.token
		if(!token) return

		chatBot = new DiscordBot.Client()
		chatBot.login(token)

		if(listenChatIdOnly) {
			chatBot.on("message", (message) => {
				if(message.author.bot) return
				const chatId = message.channel.id
				console.log("DISCORD CHAT ID:", chatId)
				message.channel.send("CHAT ID: " + chatId)
			})
			return
		}

		chatBot.on("ready", () => {
			ready = true

			for(var i = 0; i < messageQueue.length; ++i) {
				this.sendMessage(messageQueue[i])
			}
			messageQueue = []
		})

		chatBot.on("message", (message) => {
			if(message.author.bot) return

			message = message.content.toLowerCase()
			this.emit("messageReceived", message)
		})
	}

	sendMessage(message) {
		var chatId = vars.options.discord.chatId
		if(!chatBot || !chatId) return

		if(!ready) {
			messageQueue.push(message)
		}
		else {
			var channel = chatBot.channels.get(chatId)
			if(channel) channel.send(message)
		}
	}
}

module.exports = Bot
