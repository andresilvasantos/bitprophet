var vars = require(__dirname + "/../vars.js")

module.exports = {
	run: function(args, next) {
		var response = ":coffee: System paused"
		vars.paused = !vars.paused
		if(vars.paused) next(null, response)
		else next(null, ":thumbsup: System resumed.")
	}
}
