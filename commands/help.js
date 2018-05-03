var vars = require(__dirname + "/../vars.js")

module.exports = {
	run: function(args, next) {
		var message = ":bulb: Commands\n"
		for(var i = 0; i < vars.commands.length; ++i) {
			var command = vars.commands[i]
			message += command.triggers().join(" | ") + " - " + command.description() + "\n"
		}

		next(null, message)
	}
}
