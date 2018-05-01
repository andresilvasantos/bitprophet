module.exports = {
  ping: {
    triggers: ["ping"],
    description: 'Ping pong game'
  },
  status: {
    triggers: ["status", "st"],
    description: 'Check BitProphet\'s version and status'
  },
  account: {
    triggers: ["account","total","ttl"],
    description: 'Total balance in BTC and USDT, plus BNB amount',
    show_ballon: true
  },
  profits: {
    triggers: ["profits","%"],
    description: 'Show account profits (per day)',
  },
  left: {
    triggers: ["left", "l"],
    description: 'Trades left'
  },
  pause: {
    triggers: ["pause"],
    description: 'Pause system (ongoing trades won\'t be paused)'
  },
  sell: {
    triggers: ["exit", "sell"],
    description: 'Sells token, if it\'s currently trading',
    show_ballon: true
  },
  cancel: {
    triggers: ["cancel", "ignore"],
    decription: 'Cancel currently trading token'
  },
  orders: {
    triggers: ["orders", "o"],
    description: 'List open <token> orders',
    show_ballon: true
  },
  strategy: {
    triggers: ["start", "stop"],
    description: 'Starts strategy',
  },
  list: {
    triggers: ["list"],
    description: 'Lists all strategies. Specifying a strategyId, will list all valid / trading pairs for the given strategy'
  },
  restart: {
    triggers: ["restart"],
    description: 'Kills the platform. Useful when using a keep alive process manager like pm2'
  },
  help: {
    triggers: ["help", "h"],
    description: 'Show available commands'
  }
}
