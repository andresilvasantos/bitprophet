var vars = require(__dirname + "/../vars.js")
var pjson = require(__dirname + "/../package.json")
var utils = require(__dirname + "/../utils.js")

module.exports = {
	run: function(args, next) {
		var text = ":sunglasses: BitProphet v" + pjson.version + "\nRunning since " + utils.formatDate(vars.startTime)

		if(vars.btcAnalysis.dangerZone && vars.options.pauseDangerBTC) text+= "\n" + ":triangular_flag_on_post: System paused due to BTC"
		else if(vars.paused) text+= "\n" + ":coffee: System paused"
		next(null, text)
	}
}
