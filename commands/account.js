var exchUtils = require(__dirname + "/../exchange_utils.js")

module.exports = {
	run: function(args, next) {
		exchUtils.accountTotalBalance((error, balance) => {
			if(error) {
				next("Error reading total account balance")
				console.log("Error reading total account balance: " + error)
				return
			}
			next(null, ":moneybag: Total: " + balance.btcTotal.toFixed(8) + "BTC | " + balance.usdtTotal.toFixed(2) + "$\nBTC available: " +
                balance.btcAvailable.toFixed(8) + "\nBNB available: " + balance.bnbAmount.toFixed(2))
		})
	}
}
