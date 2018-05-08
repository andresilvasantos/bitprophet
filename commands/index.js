module.exports = {
	commands: {
		status: {
			triggers: ["status", "st"],
			description: "Check BitProphet's version and status"
		},
		account: {
			triggers: ["account","total","ttl"],
			description: "Total balance in BTC and USDT, plus BNB amount",
			showBalloon: true
		},
		profits: {
			triggers: ["profits","%"],
			description: "Show account profits (per day)",
		},
		left: {
			triggers: ["left", "l"],
			description: "Trades left"
		},
		pause: {
			triggers: ["pause"],
			description: "Pause system (ongoing trades won't be paused)"
		},
		sell: {
			triggers: ["sell", "exit"],
			description: "Sells token, if it's currently trading",
			showBalloon: true
		},
		cancel: {
			triggers: ["cancel"],
			description: "Cancel currently trading token"
		},
		orders: {
			triggers: ["orders", "o"],
			description: "List open orders. Specifying a token, will list open orders for the given token",
			showBalloon: true
		},
		strategy: {
			triggers: ["start", "stop"],
			description: "Starts or stops a strategy",
		},
		list: {
			triggers: ["list"],
			description: "Lists all strategies. Specifying a strategy id, will list all valid / trading pairs for the given strategy"
		},
		restart: {
			triggers: ["restart"],
			description: "Kills the platform. Useful when using a keep alive process manager like pm2"
		},
		help: {
			triggers: ["help", "h"],
			description: "Show available commands"
		}
	}
}
