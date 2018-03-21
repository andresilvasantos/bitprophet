module.exports = {
    isObject: function(object) {
        return object !== undefined && object !== null && object.constructor == Object;
    },
    ema: function(ticks, length, momentum = 100, arraySize = 1) {
        var fromJsonObject = this.isObject(ticks[0])
        if(ticks.length < length + momentum + arraySize) return []

        var sma = 0
        var currentValue = 0

        for(var i = ticks.length - length - momentum - arraySize; i < ticks.length - momentum - arraySize; ++i) {
            var value
            if(fromJsonObject) value = parseFloat(ticks[i].close)
            else value = parseFloat(ticks[i])

            if(i == ticks.length - momentum - arraySize - 1) {
                currentValue = value
            }
            else {
                sma += value
            }
        }

        sma /= length

        var weightLastPrice = (2 / (length + 1))
        var ema = (currentValue - sma) * weightLastPrice + sma

        var emaArray = []

        for(var i = 0; i < momentum + arraySize; ++i) {
            var tickIndex = ticks.length - momentum - arraySize + i
            var value
            if(fromJsonObject) value = parseFloat(ticks[tickIndex].close)
            else value = parseFloat(ticks[tickIndex])

            ema = (value - ema) * weightLastPrice + ema

            if(i > momentum - 1) emaArray.push(ema)
        }

        return emaArray
    },
    sma: function(ticks, length, arraySize = 1) {
        var fromJsonObject = this.isObject(ticks[0])
        if(ticks.length < length + arraySize - 1) return []

        var averages = []

        for(var i = 0; i < arraySize; ++i) {
            var index = ticks.length - arraySize + i
            var price
            if(fromJsonObject) price = parseFloat(ticks[index].close)
            else price = parseFloat(ticks[index])

            for(var j = 1; j < length; ++j) {
                if(fromJsonObject) price += parseFloat(ticks[index - length + j].close)
                else price += parseFloat(ticks[index - length + j])
            }

            price = price / length
            averages.push(price)
        }

        return averages
    },
    rsi: function(ticks, length, momentum, arraySize = 1) {
        var fromJsonObject = this.isObject(ticks[0])
        if(ticks.length < (length + 1) + momentum + arraySize) return []

        var gains = [], losses = []
        var avgGain = 0, avgLoss = 0
        var currentGain = 0, currentLoss = 0

        for(var i = ticks.length - (length + 1) - momentum - arraySize; i < ticks.length - momentum - arraySize; ++i) {
            var value, change

            if(fromJsonObject) {
                value = ticks[i].close
                change = value - ticks[i - 1].close
            }
            else {
                value = ticks[i]
                change = value - ticks[i - 1]
            }

            if(i == ticks.length - momentum - 1) {
                if(change > 0) currentGain = change
                else if(change < 0) currentLoss = change * -1
            }
            else {
                if(change > 0) gains.push(change)
                else if(change < 0) losses.push(change * -1)
            }
        }

        for(var i = 0; i < gains.length; ++i) {
            avgGain += gains[i]
        }

        for(var i = 0; i < losses.length; ++i) {
            avgLoss += losses[i]
        }

        //To build the momentum, we need the first rsis to be calculated using smas
        var smaGains = avgGain / length
        var smaLosses = avgLoss / length

        var weightLastPrice = (2 / (length * 2 + 1))
        var emaGains = (currentGain - smaGains) * weightLastPrice + smaGains
        var emaLosses = (currentLoss - smaLosses) * weightLastPrice + smaLosses

        var rsiArray = []

        for(var i = 0; i < momentum + arraySize; ++i) {
            var tickIndex = ticks.length - momentum - arraySize + i
            var value, change

            if(fromJsonObject) {
                value = ticks[tickIndex].close
                change = value - ticks[tickIndex - 1].close
            }
            else {
                value = ticks[tickIndex]
                change = value - ticks[tickIndex - 1]
            }

            if(change > 0) {
                currentGain = change
                currentLoss = 0
            }
            else if(change < 0) {
                currentGain = 0
                currentLoss = change * -1
            }
            else {
                currentGain = 0
                currentLoss = 0
            }

            emaGains = (currentGain - emaGains) * weightLastPrice + emaGains
            emaLosses = (currentLoss - emaLosses) * weightLastPrice + emaLosses

            if(i > momentum - 1) rsiArray.push(100 - 100 / (1 + emaGains / emaLosses))
        }

        return rsiArray
    },
    stochastic: function(ticks, length, arraySize = 1, smooth = 3) {
        var fromJsonObject = this.isObject(ticks[0])
        if(ticks.length < length + arraySize + (smooth - 1)) return []

        var stochasticsSharp = []

        for(var i = 0; i < arraySize + (smooth - 1); ++i) {
            var currentIndex = ticks.length - (arraySize + (smooth - 1)) + i
            var currentClose, lowestLow, highestHigh

            if(fromJsonObject) {
                currentClose = ticks[currentIndex].close
                lowestLow = ticks[currentIndex].low
                highestHigh = ticks[currentIndex].high
            }
            else {
                currentClose = ticks[currentIndex]
                lowestLow = ticks[currentIndex]
                highestHigh = ticks[currentIndex]
            }

            for(var j = 0; j < length; ++j) {
                var lowest, highest
                if(fromJsonObject) {
                    lowest = ticks[currentIndex - j - 1].low
                    highest = ticks[currentIndex - j - 1].high
                }
                else {
                    lowest = ticks[currentIndex - j - 1]
                    highest = ticks[currentIndex - j - 1]
                }
                if(lowest < lowestLow) lowestLow = lowest
                if(highest > highestHigh) highestHigh = highest
            }

            stochasticsSharp.push((currentClose - lowestLow) / (highestHigh - lowestLow))
        }

        var stochastics = []

        for(var i = smooth - 1; i < stochasticsSharp.length; ++i) {
            var stoch = stochasticsSharp[i]
            for(var j = 1; j < smooth; ++j) {
                stoch += stochasticsSharp[i - j]
            }

            stoch /= smooth

            stochastics.push(parseFloat(stoch * 100).toFixed(2))
        }

        return stochastics
    },
    bollingerBands: function(ticks, length, deviation = 2, arraySize = 1) {
        var fromJsonObject = this.isObject(ticks[0])
        var bands = []
        var movingAverages = this.sma(ticks, length, arraySize)

        for(var i = 0; i < movingAverages.length; ++i) {
            var movingAverage = movingAverages[i]

            var sum = 0
            for(var j = ticks.length - length; j < ticks.length; ++j) {
                var close
                if(fromJsonObject) close = parseFloat(ticks[j - movingAverages.length + i + 1].close)
                else close = parseFloat(ticks[j - movingAverages.length + i + 1])

                sum += Math.pow((close - movingAverage), 2)
            }

            var deviation = Math.sqrt(sum / (length - 1)) * 2
            bands.push([movingAverage - deviation, movingAverage, movingAverage + deviation])
        }

        return bands
    },
    ichimoku: function(ticks, conversionPeriods = 10, basePeriods = 30, laggingSpan2Periods = 60, displacement = 30, arraySize = 1) {
        function donchian(startIndex, length) {
            var lowest = 0, highest = 0
            for(var i = 0; i < length; ++i) {
                var index = startIndex - length + i + 1
                if(i == 0) {
                    lowest = parseFloat(ticks[index].low)
                    highest = parseFloat(ticks[index].high)
                }
                else {
                    var low = parseFloat(ticks[index].low)
                    if(low < lowest) lowest = low
                    var high = parseFloat(ticks[index].high)
                    if(high > highest) highest = high
                }
            }

            return (lowest + highest) / 2.
        }

        var ichimokuArray = []
        for(var i = 0; i < arraySize; ++i) {
            var index = ticks.length - arraySize - 1 + i
            //console.log(index, ticks.length, arraySize)
            var conversionLine = donchian(index, conversionPeriods)
            var baseLine = donchian(index, basePeriods)
            var leadLine1 = (conversionLine + baseLine) / 2.
            var leadLine2 = donchian(index, laggingSpan2Periods)
            ichimokuArray.push([conversionLine, baseLine, leadLine1, leadLine2])
        }

        return ichimokuArray
    },
    waveTrend: function(ticks, channelLength, avgLength, arraySize = 1) {
        var momentum = 100
        var hlc3 = []
        for(var i = 0; i < ticks.length; ++i) {
            hlc3.push((parseFloat(ticks[i].high) + parseFloat(ticks[i].low) + parseFloat(ticks[i].close)) / 3.)
        }

        var esa = this.ema(hlc3, channelLength, momentum, hlc3.length - momentum - channelLength)

        var esaDiff = []

        for(var i = 0; i < esa.length; ++i) {
            esaDiff.push(Math.abs(hlc3[hlc3.length - esa.length + i] - esa[i]))
        }

        var d = this.ema(esaDiff, channelLength, momentum, esaDiff.length - momentum - channelLength)

        var ci = []

        for(var i = 0; i < d.length; ++i) {
            ci.push((hlc3[hlc3.length - d.length + i] - esa[esa.length - d.length + i]) / (0.015 * d[i]))
        }

        var waveTrendArray = this.ema(ci, avgLength, momentum, arraySize)

        return waveTrendArray
    },
    nextSupportBase: function(ticks, length, startBackRead = 1, confirmationsNeeded = 2) {
        var nextBase = this.lowestValue(ticks, startBackRead, 0)

        var confirmations = -1
        for(var i = startBackRead; i < length; ++i) {
            var tickLow = ticks[ticks.length - 1 - i].low
            /*var tickOpen = ticks[ticks.length - 1 - i].open
            var tickClose = ticks[ticks.length - 1 - i].close
            var tickLow = tickOpen < tickClose ? tickOpen : tickClose*/

            if(tickLow <= nextBase) {
                nextBase = tickLow
                confirmations = 0
                continue
            }
            else if(confirmations >= 0 && tickLow > nextBase) {
                confirmations++

                if(confirmations >= confirmationsNeeded) {
                    break
                }
            }
        }

        return nextBase
    },
    measureMaxDiff: function(ticks, length, measureWicks = false) {
        var highValue = ticks[ticks.length - 1].close
        var lowValue = highValue

        for(var i = 0; i < length; ++i) {
            var high, low
            if(measureWicks) {
                high = ticks[ticks.length - 1 - i].high
                low = ticks[ticks.length - 1 - i].low
            }
            else {
                var open = ticks[ticks.length - 1 - i].open
                var close = ticks[ticks.length - 1 - i].close
                if(open > close) {
                    high = open
                    low = close
                }
                else {
                    high = close
                    low = open
                }
            }
            if(high > highValue) highValue = high
            else if(low < lowValue) lowValue = low
        }

        return (highValue - lowValue) / lowValue * 100
    },
    highestValue: function(ticks, length, startBackRead = 1) {
        var highValue = ticks[ticks.length - 1 - startBackRead].high
        for(var i = startBackRead; i < length; ++i) {
            var high = ticks[ticks.length - 1 - i].high
            if(high > highValue) highValue = high
        }

        return highValue
    },
    lowestValue: function(ticks, length, startBackRead = 1) {
        var lowValue = ticks[ticks.length - 1 - startBackRead].low
        for(var i = startBackRead; i < length; ++i) {
            var low = ticks[ticks.length - 1 - i].low
            if(low < lowValue) lowValue = low
        }

        return lowValue
    },
    average: function(values) {
        var avgValues = 0
        for(var i = 0; i < values.length; ++i) {
            avgValues += parseFloat(values[i])
        }
        return avgValues /= values.length
    },
    volume24h: function(ticks, intervalMin) {
        var volume24h = 0
        for(var i = ticks.length - (24 * 60 / intervalMin); i < ticks.length; ++i) {
            var high = parseFloat(ticks[i].high)
            var low = parseFloat(ticks[i].low)
            var avgPrice = (high - low) / 2. + low
            volume24h += parseFloat(ticks[i].volume) * avgPrice
        }
        return volume24h
    }
}
