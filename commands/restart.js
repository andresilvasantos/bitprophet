module.exports = {
	run: function(args, next) {
		setTimeout(function() {
			process.exit(0)
		}, 3000)
		next(null, "I'll be back")
	}
}
