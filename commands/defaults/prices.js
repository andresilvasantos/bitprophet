var vars = require(__dirname + '/../../vars.js')
var exchUtils = require(__dirname + '/../../exchange_utils.js')

module.exports = {
    run: function(args, next) {
      var _dummy = ["Sorry, I can't understand you sir. :heart:", "Sorry, no can do sir.", "Chinese now sir?"]
      var pair = args[0].toUpperCase()
      var token = false
      var chatName = false

      if (pair == "BTC" || pair == "BTCUSDT") {
        next(null, ":dollar: " + vars.pairs["BTCUSDT"].chatName() + ": " + vars.btcAnalysis.price.toFixed(2) +
          "$\nRSI - 5m: " + vars.btcAnalysis.rsi5m + " | 15m: " + vars.btcAnalysis.rsi15m)
      } else {
        for(var pairName of Object.keys(vars.pairs)) {
          var current_pair = vars.pairs[pairName]
          if (current_pair.tokenName() == pair) {
            token = pair + "BTC"
            chatName = current_pair.chatName()
            break
          } else {
            if (current_pair.name() == pair) {
              token = pair
              chatName = current_pair.chatName()
              break
            }
          }
        }

        if (token) {
          exchUtils.tokenPrice(token, (error, response) => {
              if (error) {
                  next(_dummy[Math.floor(Math.random() * _dummy.length)])
                  return
              }

              next(null, ":dollar: " + chatName + ": " + response)
              return  
          })
        } else {
          next(_dummy[Math.floor(Math.random() * _dummy.length)])
          return
        }
      }
    }
}
