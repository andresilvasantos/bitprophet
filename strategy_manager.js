var vars = require(__dirname + '/vars.js')
const strategyGenerator = require(__dirname + '/strategy_generator.js')

module.exports = {
    init: function() {
        var strategiesArray = []
        for(var strategyId of Object.keys(vars.strategies)) {
            var strategy = new strategyGenerator.create(strategyId, vars.strategies[strategyId].name)
            strategy.setBuyAmountBTC(vars.strategies[strategyId].buyAmountBTC)
            strategy.setMaxLoss(vars.strategies[strategyId].maxLoss)
            strategy.setProfitTarget(vars.strategies[strategyId].profitTarget)
            strategy.setMaxTradingPairs(vars.strategies[strategyId].maxTradingPairs)
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
