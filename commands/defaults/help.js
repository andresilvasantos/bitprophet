var commands = require(__dirname + '/../index.js')

module.exports = {
  run: function(args, next) {
    var message = ":bulb: Commands"
    Object.keys(commands).forEach(function(key) {
      var option = commands[key]
      message += "\n" + option.triggers.replace("|", " / ") + " - " + option.description
    })

    next(null, message)
  }

}
