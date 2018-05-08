const path = require("path")

module.exports = {
	create: function(commandId, commandDir) {
		var _id = commandId
		var _triggers = []
		var _description = ""
		var _showBalloon = false
		var _source = require(path.resolve(commandDir, _id + ".js"))

		this.id = function() {
			return _id
		}

		this.triggers = function() {
			return _triggers
		}

		this.setTriggers = function(triggers) {
			_triggers = triggers
		}

		this.description = function() {
			return _description
		}

		this.setDescription = function(description) {
			_description = description
		}

		this.showBalloon = function() {
			return _showBalloon
		}

		this.setShowBalloon = function(showBalloon) {
			_showBalloon = showBalloon
		}

		this.run = function(args, next) {
			try {
				_source.run(args, next)
			}
			catch(error) {
				next(":warning: This command is crashing. Check the console logs for more info.")
				console.log(error)
			}
		}
	}
}
