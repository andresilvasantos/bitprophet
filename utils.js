module.exports = {
	formatDate: function(date, onlyTime = false, showSeconds = false) {
		date = new Date(date.valueOf() + date.getTimezoneOffset() * 60000)
		var hours = date.getHours()
		var minutes = date.getMinutes()
		var seconds = date.getSeconds()
		hours = hours < 10 ? "0" + hours : hours
		minutes = minutes < 10 ? "0" + minutes : minutes
		seconds = seconds < 10 ? "0" + seconds : seconds
		var strTime = hours + ":" + minutes
		if(showSeconds) strTime += ":" + seconds
		if(onlyTime) return strTime
		return date.getMonth()+1 + "/" + date.getDate() + "/" + date.getFullYear() + "  " + strTime
	}
}
