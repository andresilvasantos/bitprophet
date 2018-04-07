var vars = require(__dirname + '/vars.js')
const path = require('path')
const strategyGenerator = require(__dirname + '/strategy_generator.js')

module.exports = {
    init: function() {
        var strategySettings = require(path.resolve(vars.options.strategiesDir, "index.js"))
        var strategies = strategySettings.strategies
        var strategiesArray = []
        for(var strategyId of Object.keys(strategies)) {
            var strategy = new strategyGenerator.create(strategyId, strategies[strategyId].name)
            strategy.setTargetMarket(strategies[strategyId].targetMarket)
            strategy.setTargetTokens(strategies[strategyId].targetTokens)
            strategy.setBuyAmountBTC(strategies[strategyId].buyAmountBTC)
            strategy.setBuyPercentageAccount(strategies[strategyId].buyPercentageAccount)
            strategy.setMaxLoss(strategies[strategyId].maxLoss)
            strategy.setProfitTarget(strategies[strategyId].profitTarget)
            strategy.setMaxTradingPairs(strategies[strategyId].maxTradingPairs)
            strategiesArray.push(strategy)
        }
        vars.strategies = strategiesArray
    },
    strategy: function(strategyId) {
        for(var i = 0; i < vars.strategies.length; ++i) {
            var strategy = vars.strategies[i]
            if(strategy.id() == strategyId) return strategy
        }
        return null
    },
    listStrategies: function(onlyActive = false) {
        if(onlyActive) {
            var strategiesArray = []
            for(var i = 0; i < vars.strategies.length; ++i) {
                var strategy = vars.strategies[i]
                if(strategy.active()) strategiesArray.push(strategy)
            }
            return strategiesArray
        }
        return vars.strategies
    },
    process: function() {
        for(var i = 0; i < vars.strategies.length; ++i) {
            var strategy = vars.strategies[i]
            if(strategy.active()) strategy.process()
        }
    }
}
