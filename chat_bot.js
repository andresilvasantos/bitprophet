var pjson = require(__dirname + '/package.json');
var vars = require(__dirname + '/vars.js')
var commands = require('./commands')
var emoji = require('node-emoji')
var fs = require('fs')

const TelegramBot = require(__dirname + '/telegram_bot.js')
const DiscordBot = require(__dirname + '/discord_bot.js')
const telegramBot = new TelegramBot()
const discordBot = new DiscordBot()
const path = require('path')

var lastMessageTimestamp = 0
var messageQueue = []
var minIntervalSendMessage = 1200

module.exports = {
    init: function(listenChatIdOnly = false) {
        telegramBot.init(listenChatIdOnly)
        telegramBot.on('messageReceived', (message) => {
            this.receiveMessage(message)
        })

        discordBot.init(listenChatIdOnly)
        discordBot.on('messageReceived', (message) => {
            this.receiveMessage(message)
        })
    },
    receiveMessage: function(message) {
	var message   = message.toLowerCase()
	var command   = false
	var args      = message.split(' ')
	var that      = this
        var opts      = false
  
	Object.keys(commands).forEach(function(key) {

	  var c = commands[key]
          
          c.triggers.forEach(function (trigger) {

	    if (trigger == args[0]) {

              opts = commands[key]
              if (fs.existsSync(__dirname + '/commands/defaults/' + key + '.js')) {
		command = require(__dirname + '/commands/defaults/' + key + '.js')
              } else if (fs.existsSync(path.resolve(vars.options.customCommandsDir, key + ".js"))) {
		command = require(path.resolve(vars.options.customCommandsDir, key + ".js"))
              }
            }
          })
       })

       if (typeof command === 'object') {

         if ((opts.show_ballon !== 'undefined') && (opts.show_ballon)) {
            this.sendMessage(":speech_balloon:")
         }
          
         command.run(args, (error, response) => {
              if (error) {
                this.sendMessage(error)
              } else {
                this.sendMessage(response)
              }
          })

        } else {

          command = require(__dirname + '/commands/defaults/prices.js')
          command.run(args, (error, message) => {
            if (error) {
              this.sendMessage(error)
            } else {
              this.sendMessage(message)
            }
          })
        }
    },
    sendMessage: function(message) {
        message = emoji.emojify(message)
        if(Date.now() - lastMessageTimestamp < minIntervalSendMessage || messageQueue.length) {
            //If this is the first message to be added to the queue, start the timer
            if(!messageQueue.length) {
                var interval = setInterval(function() {
                    var message = messageQueue[0]

                    telegramBot.sendMessage(message);
                    discordBot.sendMessage(message);

                    lastMessageTimestamp = Date.now()
                    messageQueue.shift();
                    if(!messageQueue.length) clearInterval(interval)
                }, minIntervalSendMessage)
            }

            //Add the message to the queue anyway
            messageQueue.push(message)
        }
        else {
            telegramBot.sendMessage(message);
            discordBot.sendMessage(message);

            lastMessageTimestamp = Date.now()
        }
    },
}
