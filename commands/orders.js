var exchUtils = require(__dirname + "/../exchange_utils.js")
var vars = require(__dirname + "/../vars.js")

module.exports = {
	run: function(args, next) {
		var pairName = null

		if(args.length == 2) pairName = args[1].toUpperCase()

		exchUtils.accountOpenOrders(false, (error, orders) => {
			if(error) {
				next("Error reading open orders")
				return
			}

			var ordersStr = ""
			for(var i = 0; i < orders.length; ++i) {
				var order = orders[i]
				var quantityFixed = order.amount < 1 ? order.amount : parseFloat(order.amount).toFixed(2)
				var pair = vars.pairs[order.pairName]

				if(pairName && pair.tokenName() != pairName && pair.name() != pairName) continue
				ordersStr += "[" + order.id + "] " + pair.chatName() + " " + order.side + " " + quantityFixed + "@" + order.price + "\n"
			}

			if(!ordersStr.length) {
				next(null, ":information_source: No open orders")
			}
			else {
				ordersStr = ":book: Orders\n" + ordersStr
				next(null, ordersStr)
			}
		})
	}
}
