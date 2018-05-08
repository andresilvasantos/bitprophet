var vars = require(__dirname + "/vars.js")
const TelegramBot = require("node-telegram-bot-api")
var chatBot = null

const EventEmitter = require("events")

class Bot extends EventEmitter {
	constructor() {
		super()
	}

	init(listenChatIdOnly = false) {
		var token = vars.options.telegram.token
		if(!token) return

		chatBot = new TelegramBot(token, {polling: true})

		if(listenChatIdOnly) {
			chatBot.on("message", (message) => {
				const chatId = message.chat.id
				console.log("TELEGRAM CHAT ID:", chatId)
				chatBot.sendMessage(chatId, "CHAT ID: " + chatId)
			})
			return
		}

		chatBot.on("polling_error", function(error) {
			console.log("Telegram error:", error)
		})

		chatBot.on("message", (message) => {
			message = message.text.toLowerCase()
			this.emit("messageReceived", message)
		})
	}

	sendMessage(message) {
		var chatId = vars.options.telegram.chatId
		if(!chatBot || !chatId) return

		chatBot.sendMessage(chatId, message)
	}
}

module.exports = Bot
