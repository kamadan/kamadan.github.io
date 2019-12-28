var resultsPerPage = 25,
	maxPages = 100,
	baseReconnectDelayMs = 100,
	maxReconnectDelayMs = 3E4,
	enableSuggest = !1,
	enableInstantSearch = 1,
	page = document.getElementById("page"),
	current = document.getElementById("current"),
	searchInfo = document.getElementById("search-info"),
	pagination = document.getElementById("pagination"),
	scrollIndicator = document.getElementById("scroll-indicator"),
	incomingCount = document.getElementById("incoming-count"),
	searchForm = document.getElementById("search-form"),
	searchInput = document.getElementById("search-input"),
	homeLink = document.getElementById("home-link"),
	connectionIndicator = document.getElementById("connection-indicator"),
	notificationButton = document.getElementById("notification-button"),
	translateButton = document.getElementById("translate-button"),
	audioContext,
	notificationSoundBuffer,
	socket,
	reconnectDelayMs = baseReconnectDelayMs,
	reconnectTimer,
	isFirstReflow = !0,
	scrolledDown = !1,
	scrolling = !1,
	pendingRequest = null,
	xhr = null,
	results = [],
	incomingResults = [],
	incomingResultCount = 0,
	追踪项 = [],
	近期广告 = [],
	静音时间 = 5,
	网址 = new RegExp("^https\:\/\/kamadan\.github\.io\/" + encodeURIComponent("ad") + "(\\?{0,1}.*?)$", "i")

var animationEnd = 0,
	animationLengthMs = 500,
	animationRunning = !1,
	animationFrameRequest

var scrollAnimationEnd = 0,
	scrollAnimationLengthMs, scrollStartY, scrollEndY

function humanReadableDurationEn(a, b) {
	for (var c = Math.abs(b - a), d = [{
			unit: "minute",
			article: "a",
			ms: 6E4
		}, {
			unit: "hour",
			article: "an",
			ms: 36E5
		}, {
			unit: "day",
			article: "a",
			ms: 864E5
		}, {
			unit: "week",
			article: "a",
			ms: 6048E5
		}, {
			unit: "month",
			article: "a",
			ms: 2629746E3
		}, {
			unit: "year",
			article: "a",
			ms: 31556952E3
		}], e = null, f = 0; f < d.length && !(c < d[f].ms); ++f)
		e = d[f];
	return e ? (c = Math.floor(c / e.ms),
		1 < c ? c + " " + e.unit + "s" : e.article + " " + e.unit) : "a few seconds"
}

function humanReadableDuration(a, b) {
	for (var c = Math.abs(b - a), d = [{
			unit: "分 钟 ",
			article: "1 ",
			ms: 6E4
		}, {
			unit: "小 时 ",
			article: "1 ",
			ms: 36E5
		}, {
			unit: "天 ",
			article: "1 ",
			ms: 864E5
		}, {
			unit: "周 ",
			article: "1 ",
			ms: 6048E5
		}, {
			unit: "个 月 ",
			article: "1 ",
			ms: 2629746E3
		}, {
			unit: "年 ",
			article: "1 ",
			ms: 31556952E3
		}], e = null, f = 0; f < d.length && !(c < d[f].ms); ++f)
		e = d[f]
	return e ? (c = Math.floor(c / e.ms),
		1 < c ? c + " " + e.unit + "" : e.article + " " + e.unit) : "几 秒 "
}

function humanReadableAge(a, b) {
	"undefined" === typeof b && (b = (new Date).valueOf())
	if (translateButton.classList.contains("字母版")) {
		return humanReadableDurationEn(a > b ? b : a, b) + " ago"
	} else {
		return humanReadableDuration(a > b ? b : a, b) + "前"
	}
}

function clearResults() {
	results = []
	for (clearIncomingResults(); current.hasChildNodes();)
		current.removeChild(current.lastChild)
	current.classList.remove("animate-fade-out")
}

function addResult(a) {
	current.insertAdjacentHTML("afterbegin", formatResult(a))
	a.domNode = current.firstChild
	a.ageDomNode = a.domNode.getElementsByClassName("age")[0]
	a.deleted = !1
	results.push(a)
}

function populateResultsFromDom() {
	for (var a = current.childNodes, b = a.length - 1; 0 <= b; --b) {
		var c = a[b],
			c = {
				domNode: c,
				deleted: !1,
				ageDomNode: c.getElementsByClassName("age")[0],
				y: 0,
				timestamp: parseInt(c.getAttribute("data-timestamp"), 10),
				id: parseInt(c.getAttribute("data-id"), 10),
				name: c.getElementsByClassName("name")[0].innerText,
				message: c.getElementsByClassName("message")[0].innerText
			}
		results.push(c)
	}
}

function htmlEscape(a) {
	return document.createElement("div").appendChild(document.createTextNode(a)).parentNode.innerHTML.replace(/"/g, "&quot;")
}

function formatResult(a) {
	var b = htmlEscape(a.name),
		c = humanReadableAge(1E3 * a.timestamp)
	a = htmlEscape(a.message)
	a = parseTranslate(a) //New: Need to make sure translation do not break syntax	
	return "<tr class=\"row\"><td class=\"info\"><div class=\"name\">" + b + "</div><div class=\"age\">" + c + "</div></td><td class=\"message\">" + a + "</td><td class=\"delete\"></td></tr>"
}

function shouldAnimate() {
	return !0 !== document.hidden
}

function placeNewResults() {
	var a = 0,
		b
	for (b = results.length - 1; 0 <= b; --b) {
		var c = results[b]
		if ("undefined" !== typeof c.height) {
			a = c.y
			break
		}
	}
	for (b += 1; b < results.length; ++b)
		c = results[b],
		c.height = c.domNode.getBoundingClientRect().height,
		c.y = a - c.height,
		a = c.y
}

function computeTargetLayout() {
	for (var a = 0, b = results.length - 1; 0 <= b; --b) {
		var c = results[b]
		c.deleted && (c.domNode.style.zIndex = -1)
		c.oldY = c.y
		c.targetY = a
		c.deleted && (c.targetY -= c.height)
		a += c.deleted ? 0 : c.height
	}
	return a
}

function measureResults() {
	for (var a = 0; a < results.length; ++a) {
		var b = results[a]
		b.height = b.domNode.getBoundingClientRect().height
	}
}

function deleteOldResults() {
	for (var a = 0, b = results.length - 1; 0 <= b; --b) {
		var c = results[b]
		a > resultsPerPage ? c.deleted = !0 : c.deleted || ++a
	}
}

function reflowResults(a) {
	deleteOldResults()
	var b = computeTargetLayout()
	current.parentNode.style.height = b + "px"
	startAnimateResults(a ? animationLengthMs : 0)
}

function startAnimateResults(a) {
	animationEnd = (new Date).getTime() + a
	0 == a ? (animationRunning && window.cancelAnimationFrame(animationFrameRequest),
		animateResults()) : animationRunning || (animationRunning = !0,
		animationFrameRequest = window.requestAnimationFrame(animateResults))
}

function animateResults() {
	for (var a = (new Date).getTime(), a = a > animationEnd ? 1 : 1 - (animationEnd - a) / animationLengthMs, b = 1, c = results.length - 1; 0 <= c; --c) {
		var d = results[c],
			e = d.domNode
		d.y = a * d.targetY + (1 - a) * d.oldY
		e.style.transform = "translate3d(0, " + d.y + "px, 0)"
		//e.style.position = "absolute"
		//e.style.left = 0 + "px"
		//e.style.top = d.y +"px"
		d.deleted ? (b = 1 - (b - d.y) / d.height,
			e.style.opacity = b,
			0 == b && (current.removeChild(e),
				results.splice(c, 1))) : 1 >= d.oldY && (e.style.opacity = Math.min(1, 1 + d.y / d.height))
		b = d.y + d.height
	}
	1 > a ? animationFrameRequest = window.requestAnimationFrame(animateResults) : animationRunning = !1
}

function toggleScrollIndicator(a) {
	a ? scrollIndicator.classList.add("scroll-indicator-visible") : scrollIndicator.classList.remove("scroll-indicator-visible")
	a && (incomingCount.innerText = incomingResultCount)
}

function findDuplicates(a, b) {
	var c = []
	for (i = b.length - 1; 0 <= i; --i) {
		var d = b[i]
		a.name == d.name && a.message == d.message && c.push(d)
	}
	return c
}

function addIncomingResult(a) {
	incomingResults.push(a)
	trimIncomingResultsAmortized()
		++incomingResultCount
}

function clearIncomingResults() {
	incomingResults = []
	incomingResultCount = 0
}

function trimIncomingResults() {
	incomingResults.length > resultsPerPage && (incomingResults = incomingResults.slice(-resultsPerPage))
}

function trimIncomingResultsAmortized() {
	incomingResults.length > 2 * resultsPerPage && trimIncomingResults()
}

function forceReconnectWebSocket() {
	clearTimeout(reconnectTimer)
	reconnectDelayMs = baseReconnectDelayMs
	setupWebSocket()
}

function trimPathName(path) {
	var tPath = path
	path = path.replace(/^.+?(\?(?:(?:search)|(?:latest)).*?)$/gi, "$1")
	return ((tPath == path) ? "" : path)
}

function setupWebSocket() {
	connectionIndicator.classList.remove("connected")
	searchInput.classList.add("offline")
	document.getElementById("nav").classList.add("offline")
	document.getElementById("results-header").classList.add("offline")
	searchInput.setAttribute("placeholder", "正在联系服务器，暂无回应")
	socket && (socket.onclose = socket.onopen = socket.onmessage = null, socket.close())
	var a = trimPathName(document.location.href);
	(a.charAt(0) == "?") ? a = "/" + a.slice(1): a
	pendingRequest || (a = "/notify" + a)
	socket = new WebSocket("wss://" + "kamadan.decltype.org" + "/ws" + a) //window.location.hostname
	socket.onclose = function (a) {
		clearTimeout(reconnectTimer)
		reconnectTimer = setTimeout(setupWebSocket, reconnectDelayMs)
		reconnectDelayMs = Math.min(2 * reconnectDelayMs, maxReconnectDelayMs)
	}

	socket.onopen = function (a) {
		clearTimeout(reconnectTimer)
		reconnectDelayMs = baseReconnectDelayMs
		connectionIndicator.classList.add("connected")
		searchInput.classList.remove("offline")
		document.getElementById("nav").classList.remove("offline")
		document.getElementById("results-header").classList.remove("offline")
		searchInput.setAttribute("placeholder", "搜索词需用字母名 | 按以下格式寻人: 名=填名；亦可点击表内人名 (浏览器会自动复制该名) | [旗标]以示原文 | [齿轮]启动自动提示")

		if (window.location.href.match(网址)) {
			navigateUrl(window.location.href.match(网址)[1])
		}
		/* 
		  else {
			retrieveResults({
				query: "",
				offset: 0
			})
		}
		*/
	}

	socket.onmessage = function (a) {
		a = JSON.parse(a.data)
		for (var prop in a) {
			a[prop] = inputVal(a[prop])
		}
		if ("undefined" !== typeof a.query) {
			displayResults(a)
		} else {			
			if (!(违禁(a))) {				
				if (notificationButton.classList.contains("enabled")) {
					var 找到 = []
					if (追踪项.length > 0) {
						找到 = 追踪项.filter(项 => {
							return (a.message.match(new RegExp(项, "i")) || parseTranslate(a.message, false).match(new RegExp(项, "i")))
						})
						var 近期广告表 = 近期广告.reduce((总结, 项) => {
							总结 += 项.name + "\n" + 项.message + "\n"
							return 总结
						}, "")
						console.log("原文: \n" + a.name + "\n" + a.message + "\n正在追踪: " + 追踪项.toString() + "\n找到: " + 找到.toString() + "\n已见过的广告: \n" + 近期广告表)
						if ((找到.length > 0) && 未曾见过(a)) {
							var b = parseRequestFromUrl(trimPathName(document.location.href)),
								d = {
									body: "角色名: " + a.name + "\n" + parseTranslate(a.message, false), //所在地: 卡玛丹，艾斯坦之钻\n美洲1区
									icon: "帆船.png", //notification related:  /v/ZjA5Y2E4NT.png
									tag: "卡玛丹/" + b.query
								},
								e = "激战广告"
							b.query && (e = e + " - '" + b.query + "' 的搜索结果")
							console.log("找到, 正在试图发报")
							new Notification(e, d)
							playNotificationSound()
						}
					}
				}
				d = scrolledDown && !scrolling
				b = findDuplicates(a, results)
				if (d) {
					d = findDuplicates(a, incomingResults)
					b = b.concat(d)
					for (d = 0; d < b.length; ++d)
						b[d].deletedByIncoming = !0
					addIncomingResult(a)
					toggleScrollIndicator(!0)
				} else
					addResult(a),
					b.forEach(function (a) {
						a.deleted = !0
					}),
					placeNewResults(),
					reflowResults(shouldAnimate())
			}
		}
	}
}

function 违禁(a){
	var 禁言项 = ["GAMERSMARKÉT", "GVGMALL", "GAMERSMARKET", "\\\.COM", "LiveChat", "GOLDAA", "[^\\sA-Za-z]COM"]
	var 有违禁 = []	
	有违禁 = 禁言项.filter(项 => {
		return a.message.match(new RegExp(项, "i")) 
	})
	return ((有违禁.length==0) ? false : true)
}

function 未曾见过(新数据) {
	近期广告 = 近期广告.filter(还新否)
	for (var i = 0; i < 近期广告.length; i++) {
		var 记录 = 近期广告[i]
		if (新数据.name == 记录.name && 新数据.message == 记录.message) {
			return false
		}
	}
	新数据.接收时间 = (new Date()).getTime()
	近期广告.push(新数据)
	return true
}

function 还新否(广告) {
	var 现在时间 = new Date()
	var 广告时间 = new Date(广告.接收时间)
	return ((现在时间 - 广告时间) > (静音时间 * 60 * 1000)) ? false : true
}

function flushNewRows() {
	trimIncomingResults()
	for (var a = 0; a < incomingResults.length; ++a)
		addResult(incomingResults[a])
	clearIncomingResults()
	for (a = 0; a < results.length; ++a) {
		var b = results[a]
		b.deletedByIncoming && (b.deleted = !0)
	}
	placeNewResults()
	reflowResults(shouldAnimate())
	toggleScrollIndicator(!1)
}

function displayTitle(a) {
	var b = "广告|卡玛丹"
	a && (b = a + " - " + b)
	document.title = b
}

function displaySearchInfo(a) {
	var b = parseInt(a.offset, 10)
	if (0 < a.results.length) {
		var c = a.elapsed_microseconds / 1E3,
			b = b + 1,
			d = b + Math.min(resultsPerPage, a.results.length) - 1
		a = a.query ? "第 " + b + "-" + d + " 条 | 共" + ("true" === a.exact ? "有" : "约") + " " + a.num_results + " 则 与 '" + a.query + "' 相关的广告 (耗时 " + c + " 毫秒)" : "第 " + b + "-" + d + " 条 | 共 " + a.num_results + " 则 (耗时 " + c + " 毫秒)"
	} else
		a = "没有 与 '" + a.query + "' 相关的广告"
	searchInfo.classList.remove("animate-fade-out")
	searchInfo.innerText = a
}

function formatPageLink(a, b, c, d) {
	return "<a class=\"page-link" + (c ? " page-link-" + c : "\" href=\"" + a + (1 != b ? "/" + (b - 1) * resultsPerPage : "")) + "\">" + d + "</a>"
}

function formatPagination(a, b, c) {
	if (0 == c)
		return ""
	c = Math.min(Math.ceil(c / resultsPerPage), maxPages)
	b = Math.floor(b / resultsPerPage) + 1
	var d = Math.max(Math.min(b - 2, c - 4), 1),
		e = Math.min(c, d + 4)
	a = htmlEscape(a)
	for (var f = formatPageLink(a, 1, 1 == b ? "disabled" : "", "&laquo;"); d <= e; ++d)
		f += formatPageLink(a, d, b == d ? "current" : "", d)
	return f += formatPageLink(a, maxPages, b == c ? "disabled" : "", "&raquo;")
}

function displayPagination(a, b, c) {
	pagination.innerHTML = formatPagination(a, b, c)
}

function buildUrlFor(a, b) {
	var c = a ? "?search/" + encodeURIComponent(a) : "?latest"
	b = "undefined" !== typeof b ? parseInt(b, 10) : 0
	0 != b && (c += "/" + b)
	return c
}

function displayQuery(a) {
	searchInput.value = a
}

function displayResults(a) {
	pendingRequest = null
	var b = buildUrlFor(a.query)
	buildUrlFor(a.query, a.offset)
	var c = parseInt(a.num_results, 10)
	clearResults()
	for (var d = a.results.length - 1; 0 <= d; --d){
		if (违禁(a.results[d])) {
			a.results[d].message = "违禁广告，内容已删"			
		}
		addResult(a.results[d])
	}		
	displaySearchInfo(a)
	displayPagination(b, a.offset, c)
	placeNewResults()
	reflowResults()
	scrollToTop(100)
}

function parseRequestFromUrl(a) {
	(a.charAt(0) == "?") ? a = a.substr(1): a
	a = a.split(/\/+/)
	"" == a[0] && (a = a.slice(1))
	var b = "",
		c = 0
	1 <= a.length && "latest" == a[0] ? a = a.slice(1) : 2 <= a.length && "search" == a[0] && (b = decodeURIComponent(a[1]),
		a = a.slice(2))
	1 <= a.length && (c = parseInt(a[0], 10),
		isNaN(c) && (c = 0))
	return {
		query: b,
		offset: c
	}
}

function displayRequest(a) {
	displayTitle(a.query)
	displayQuery(a.query)
	a.query || 0 != a.offset || searchInput.focus()
	current.classList.add("animate-fade-out")
	searchInfo.classList.add("animate-fade-out")
}

function retrieveResults(a) {
	pendingRequest = a
	displayRequest(a)
	socket && socket.readyState == WebSocket.OPEN ? socket.send(JSON.stringify({
		query: a.query,
		offset: a.offset,
		suggest: enableSuggest
	})) : forceReconnectWebSocket()
}

function reflowDocument() {
	isFirstReflow && (scrolledDown = !isAtTopOfPage(),
		populateResultsFromDom())
	measureResults()
	isFirstReflow && (document.body.classList.remove("no-js"),
		document.body.classList.add("js"),
		isFirstReflow = !1)
	reflowResults()
}

function animateScroll() {
	var a = (new Date).getTime(),
		a = a > scrollAnimationEnd ? 1 : 1 - (scrollAnimationEnd - a) / scrollAnimationLengthMs
	window.scrollTo(0, Math.floor(a * scrollEndY + (1 - a) * scrollStartY))
	1 > a ? window.requestAnimationFrame(animateScroll) : scrolledDown = scrolling = !1
}

function scrollToTop(a) {
	var b = -page.getBoundingClientRect().top
	scrollAnimationLengthMs = "undefined" === typeof a ? animationLengthMs : a
	0 < b && (scrollStartY = b,
		scrollEndY = 0,
		scrollAnimationEnd = (new Date).getTime() + scrollAnimationLengthMs,
		scrolling = !0,
		window.requestAnimationFrame(animateScroll))
}

function play(a) {
	var b = audioContext.createBufferSource()
	b.buffer = a
	b.connect(audioContext.destination)
	b.start()
}

function playNotificationSound() {
	notificationSoundBuffer && play(notificationSoundBuffer)
}

function fetchNotificationSound() {
	//New: commented out the entire block below
	/*
    "undefined" === typeof notificationSoundBuffer && (notificationSoundBuffer = null,
    "undefined" !== typeof AudioContext && (audioContext = new AudioContext,
    window.fetch("ZTkxMjA0YW.mp3").then(function(a) { //notification related: /v/ZTkxMjA0YW.mp3 
        return a.arrayBuffer()
    }).then(function(a) {
        return audioContext.decodeAudioData(a)
    }).then(function(a) {
        notificationSoundBuffer = a
    })))
	*/
}

function isAtTopOfPage() {
	return 0 <= page.getBoundingClientRect().top
}

function isSelecting(a) {
	var b = getSelection()
	return 0 == b.toString().length ? !1 : (b = b.anchorNode) && a.contains(b)
}

function displayDeleteDialog(a) {
	if (translateButton.classList.contains("字母版")) {
		a = "<div id=\"modal\"><div id=\"dialog\"><div><h1>Request message deletion</h1>To delete this message, log in with <strong>" + htmlEscape(a.name) + "</strong> and enter the following command:</div><div id=\"command\">/whisper Chat Log, DELETE " + a.id + "</div><div id=\"dialog-footer\"><button id=\"dismiss\">Got it!</button></div></div></div>"
	} else {
		a = "<div id=\"modal\"><div id=\"dialog\"><div><h1>原文 及 删除办法</h1>原文: <div id=\"command\">" + htmlEscape(a.message) + "</div>删除办法: 以 <strong>" + htmlEscape(a.name) + "</strong> 角色登入激战，再用其 对话栏 发以下字条:</div><div id=\"command\">/whisper Chat Log, DELETE " + a.id + "</div><div id=\"dialog-footer\"><button id=\"dismiss\">返回</button></div></div></div>"
	}
	document.body.insertAdjacentHTML("beforeend", a)
}

function displayNotificationDialog() {
	var sForm
	if (!translateButton.classList.contains("字母版")) {
		sForm = "<div id=\"tracking-Form\" style=\"display:flex\"> \
				<div id=\"dialog\"> \
				<div> \
					<h1>自动提示 - 设置</h1> \
					<div>填入 物品名称，或各种别名，以逗号为分隔符，中外文通用</div> \
					<div id=\"command\"> \
					<div style=\"font-size:small\">(特殊符号需以\"\\\"号开头，例：\+)</div> \
					<textarea id=\"tracked-Items\" rows=\"5\" cols=\"50\"></textarea> \
					</div> \
					<div id=\"command\"> \
					<input type=\"number\" id=\"silent-Interval\" value=\"5\" min=\"0\" max=\"99\" required pattern=\"[0-9]{1,2}\"> \
					<span style=\"font-size:small\">分钟内不报重复的广告</span> \
					</div> \
				</div> \
				<div id=\"dialog-footer\"> \
					<button id=\"cancel-Notification\">取消</button> \
					<button id=\"begin-Notification\">启动</button> \
				</div> \
				</div> \
			</div>"
	} else {
		sForm = "<div id=\"tracking-Form\" style=\"display:flex\"> \
				<div id=\"dialog\"> \
				<div> \
					<h1>Notification Settings</h1> \
					<div>Enter Item Names | Use Comma Between Entries</div> \
					<div id=\"command\"> \
					<div style=\"font-size:small\">(Escape RegExp Symbols | E.g. \\+)</div> \
					<textarea id=\"tracked-Items\" rows=\"5\" cols=\"50\"></textarea> \
					</div> \
					<div id=\"command\"> \
					<span style=\"font-size:small\">Ignore Duplicates from the last </span> \
					<input type=\"number\" id=\"silent-Interval\" value=\"5\" min=\"0\" max=\"99\" required pattern=\"[0-9]{1,2}\"> \
					<span style=\"font-size:small\"> Minutes</span> \
					</div> \
				</div> \
				<div id=\"dialog-footer\"> \
					<button id=\"cancel-Notification\">Cancel</button> \
					<button id=\"begin-Notification\">Apply</button> \
				</div> \
				</div> \
			</div>"
	}
	document.body.insertAdjacentHTML("beforeend", sForm)
	//document.getElementById("tracking-Form").style.display = "flex"
	document.getElementById("tracked-Items").value = 追踪项.toString()
	document.getElementById("silent-Interval").value = 静音时间
}

function 开报(a) {
	a.preventDefault()
	追踪项 = document.getElementById("tracked-Items").value.split(/[,，]/).map(x => x.trim()).filter(x => (x != ""))
	var 内容分类 = 追踪项.reduce((驳回, 项) => {
		try {
			new RegExp(项, "i")
			驳回[0].push(项)
		} catch (e) {
			驳回[1].push(项)
		}
		return 驳回
	}, [
		[],
		[]
	])
	var 被驳回 = 内容分类[1]
	if (被驳回.length > 0) {
		var oldErrorMsg = document.getElementById("input-Error")
		if (oldErrorMsg) {
			oldErrorMsg.parentNode.removeChild(oldErrorMsg)
		}
		document.getElementById("tracked-Items").insertAdjacentHTML("afterend", "<div style='font-size:small' id='input-Error'> \
        输入失败，以下字条违规：" + 被驳回.toString() + "</div>")
		document.getElementById("tracked-Items").value = 内容分类[0]
		return 0
	}
	静音时间 = document.getElementById("silent-Interval").value
	if (!静音时间.match(/^[0-9]{1,2}$/i)) {
		return 0
	} else {
		静音时间 = parseInt(静音时间)
	}
	fetchNotificationSound()
	if ("granted" !== Notification.permission) {
		Notification.requestPermission(function (a) {
			if ("granted" === a) {
				notificationButton.classList.add("enabled")
				console.log("用户同意发报")
			} else {}
		})
	} else {
		//add enabled		
		console.log("开始发报")
		notificationButton.classList.toggle("enabled")
	}

	document.body.removeChild(document.getElementById("tracking-Form"))
}

function 取消按钮(a) {
	a.preventDefault()
	document.body.removeChild(document.getElementById("tracking-Form"))
}

document.getElementById("wiki-button").addEventListener("click", function (a) {
	a.preventDefault()
	location.href = "https://guildwars.huijiwiki.com/wiki/首页"
})

document.getElementById("dictionary-button").addEventListener("click", function (a) {
	a.preventDefault()
	location.href = "https://guildwars.huijiwiki.com/wiki/词典"
})

document.getElementById("translate-button").addEventListener("click", function (a) {
	a.preventDefault()
	var language = !translateButton.classList.contains("字母版")
	if (language) { //currently not in foreign text
		translateButton.classList.add("字母版")
		translateButton.setAttribute("title", "Chinese")
	} else { //currently foreign, so switch to Chinese mode
		translateButton.classList.remove("字母版")
		translateButton.setAttribute("title", "字母版")
	}
	if (window.location.href.match(网址)) {
		navigateUrl(window.location.href.match(网址)[1])
	}
})

function matchesRequest(a, b) {
	return a.query === b.query && a.offset == b.offset
}

function navigateUrl(a) {
	"?latest" == a && (a = "?")
	var b = parseRequestFromUrl(a),
		c = parseRequestFromUrl(trimPathName(document.location.href))
	matchesRequest(c, b) || history.pushState({}, "", (a == "?") ? "/ad" : "/ad" + a) //previously: a	
	retrieveResults(b)
}

function navigate(a, b) {
	var c = buildUrlFor(a, b)
	navigateUrl(c)
}

function updateTimestamps() {
	for (var a = (new Date).valueOf(), b = 0; b < results.length; ++b) {
		var c = results[b],
			d = humanReadableAge(1E3 * c.timestamp, a)
		d !== c.ageDomNode.innerText && (c.ageDomNode.innerText = d)
	}
}

enableInstantSearch && searchInput.addEventListener("input", function (a) {
	navigate(searchInput.value)
})

searchForm.addEventListener("submit", function (a) {
	a.preventDefault()
	if (searchInput.value.match(/^名\s*?=\s*?[^\s]+/)) {
		searchInput.value = searchInput.value.replace(/^名\s*?=\s*?(.+?)$/gi, "author:\"$1\"")
	} else {
		searchInput.value = searchTranslate(searchInput.value)
	}
	navigate(searchInput.value)
})

homeLink.addEventListener("click", function (a) {
	a.preventDefault()
	navigate()
})

notificationButton.addEventListener("click", function () {
	if ("undefined" === typeof Notification) {
		alert("浏览器无提示窗功能")
		notificationButton.classList.remove("enabled")
		近期广告 = []
	} else {
		if (notificationButton.classList.contains("enabled")) {
			console.log("停止发报")
			notificationButton.classList.remove("enabled")
			近期广告 = []
		} else {
			displayNotificationDialog()
		}
	}
})

scrollIndicator.addEventListener("click", function () {
	flushNewRows()
	scrollToTop()
})

window.addEventListener("popstate", function (a) {
	retrieveResults(parseRequestFromUrl(trimPathName(document.location.href)))
})

window.addEventListener("beforeunload", function () {
	socket && (clearTimeout(reconnectTimer), socket.onclose = function () {}, socket.close())
})

window.addEventListener("scroll", function () {
	(scrolledDown = !isAtTopOfPage()) || flushNewRows()
})

window.addEventListener("resize", reflowDocument)

document.addEventListener("click", function (a) {
	var b = a.target
	if (1 == a.which)
		if (b.classList.contains("name") && !isSelecting(b)) {
			c = getSelection()
			c.removeAllRanges()
			var d = document.createRange()
			d.selectNode(b)
			c.addRange(d)
			try {
				document.execCommand("copy")
			} catch (e) {}
			navigate("author:\"" + b.innerText + "\""),
				a.preventDefault()
		}
	else if (b.classList.contains("page-link") && b.hasAttribute("href"))
		navigateUrl(b.getAttribute("href")),
		a.preventDefault()
	else if (b.classList.contains("delete")) {
		a = b.parentNode
		for (var c, b = 0; b < results.length; ++b)
			results[b].domNode === a && (c = results[b])
		c && displayDeleteDialog(c)
	} else if ("modal" === b.id)
		document.body.removeChild(b)
	else if ("dismiss" === b.id)
		a = document.getElementById("modal"),
		document.body.removeChild(a)
	else if ("cancel-Notification" === b.id)
		取消按钮(a)
	else if ("begin-Notification" === b.id)
		开报(a)
	else if ("command" === b.id) {
		c = getSelection()
		c.removeAllRanges()
		var d = document.createRange()
		d.selectNode(b)
		c.addRange(d)
		try {
			document.execCommand("copy")
		} catch (e) {}
		a.preventDefault()
	}
})

window.setInterval(updateTimestamps, 1E3)
reflowDocument()
setupWebSocket();

(function (h, o, t, j, a, r) {
	h.hj = h.hj || function () {
		(h.hj.q = h.hj.q || []).push(arguments)
	};
	h._hjSettings = {
		hjid: 402228,
		hjsv: 5
	};
	a = o.getElementsByTagName('head')[0];
	r = o.createElement('script');
	r.async = 1;
	r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
	a.appendChild(r);
})(window, document, '//static.hotjar.com/c/hotjar-', '.js?sv=');

function searchTranslate(data) {
	return data
}

function inputVal(data) {
	if (Array.isArray(data)) {
		for (var o = 0; o < data.length; o++) {
			for (var field in data[o]) {
				data[o][field] = inputValHelper(data[o][field])
			}
		}
	} else {
		inputValHelper(data)
	}
	return data
}

function inputValHelper(data) {
	data = data.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<script[^>]+?\/>|<script(.|\s)*?\/script>/gi, "")
		.replace(/<\/html>/gi, "")
		.replace(/<html>/gi, "")
		.replace(/<\/body>/gi, "")
		.replace(/<body>/gi, "")
		.replace(/<head\/>/gi, "")
		.replace(/<head>/gi, "")
		.replace(/<\/head>/gi, "")
		.replace(/<\/.*?>/gi, "")
		.replace(/<.*?>/gi, "")
		.replace(/!\[CDATA\[.*?\]\]/gi, "")
		.replace(/&lt;.*?&gt;/gi, "")
	return data
}

function parseTranslate(data, 样式 = true) {
	data = data.replace(/^\s*?\r*?\n*?$/gi, "")

	if (translateButton.classList.contains("字母版")) {
		if (样式) {
			data = data.replace(/^WTBUY|^WTB/gi, "<span style=\"color:#0000FF;\">WTB</span>")
			data = data.replace(/^WTSELL|^WTS/gi, "<span style=\"color:#BB00BB;\">WTS</span>")
			data = data.replace(/(^|[^A-Za-z])(WANT TO SELL)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#BB00BB;\">WTS</span>")
			data = data.replace(/(^|[^A-Za-z])(WANT TO BUY)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#0000FF;\">WTB</span>")
			data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#BB00BB;\">WTS</span>")
			data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#0000FF;\">WTB</span>")
		} else {
			data = data.replace(/^WTBUY|^WTB/gi, "WTB")
			data = data.replace(/^WTSELL|^WTS/gi, "WTS")
			data = data.replace(/(^|[^A-Za-z])(WANT TO SELL)(?=[^A-Za-z]|$)/gi, "$1WTS")
			data = data.replace(/(^|[^A-Za-z])(WANT TO BUY)(?=[^A-Za-z]|$)/gi, "$1WTB")
			data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1WTS")
			data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1WTB")
		}
		return data
	}
	//1. 起始项 (避免常见短句被拆散)
	data = data.replace(/(^|[^A-Za-z])(COLORS?)(?=[^A-Za-z]|$)/gi, "$1颜色") //不可下放
	data = data.replace(/(^|[^A-Za-z])(wE)(?=[^A-Za-z]|$)/g, "$1(加持下)") //wE
	data = data.replace(/(^|[^A-Za-z])(ONE\s*?HAND|1\s*?HAND)(?=[^A-Za-z]|$)/gi, "$1单手")
	data = data.replace(/(^|[^A-Za-z])(WTB\s*?)(VS)(?=[^A-Za-z]|$)/gi, "$1$2电流矛")
	data = data.replace(/(^|[^A-Za-z])(WTS\s*?)(VS)(?=[^A-Za-z]|$)/gi, "$1$2电流矛")
	data = data.replace(/(^|[^A-Za-z])(ALL BUT)(?=[^A-Za-z]|$)/gi, "$1所有的，除了")
	data = data.replace(/(^|[^A-Za-z])(PC|PRICE CHECKS*?)(?=[^A-Za-z]|$)/gi, "$1鉴价")
	data = data.replace(/(^|[^A-Za-z])(CAN YOU|COULD YOU)(?=[^A-Za-z]|$)/gi, "$1你能")
	data = data.replace(/(^|[^A-Za-z])(BOOKS*? OF SECRETE*?S*?)(?=[^A-Za-z]|$)/gi, "$1秘密之书")
	data = data.replace(/(^|[^A-Za-z])(Z\s*?\.*?goldcoins*?)(?=[^A-Za-z]|$)/gi, "$1金战承币")
	data = data.replace(/(^|[^A-Za-z])(Z\s*?\.*?si*?li*?vercoins*?)(?=[^A-Za-z]|$)/gi, "$1银战承币")
	data = data.replace(/(^|[^A-Za-z])(Z\s*?\.*?copp*?ercoins*?)(?=[^A-Za-z]|$)/gi, "$1铜战承币")
	data = data.replace(/(^|[^A-Za-z])(goldcoins*?)(?=[^A-Za-z]|$)/gi, "$1金币")
	data = data.replace(/(^|[^A-Za-z])(si*?li*?vercoins*?)(?=[^A-Za-z]|$)/gi, "$1银币")
	data = data.replace(/(^|[^A-Za-z])(copp*?ercoins*?)(?=[^A-Za-z]|$)/gi, "$1铜币")
	data = data.replace(/(^|[^A-Za-z])(Zcoins*?)(?=[^A-Za-z]|$)/gi, "$1战承币")
	data = data.replace(/(^|[^A-Za-z])(DESTR*?O*?Y*?E*?R*?S*?\s*?CORES*?|D\s*?-*?\s*?CORES*?)(?=[^A-Za-z]|$)/gi, "$1破坏者核心")
	data = data.replace(/(^|[^A-Za-z])(DESTROYERS*? (?:OF )?FLESH)(?=[^A-Za-z]|$)/gi, "$1血肉破坏者")
	data = data.replace(/(^|[^A-Za-z])(RED GIFT BAGS*?)(?=[^A-Za-z]|$)/gi, "$1福袋")
	data = data.replace(/(^|[^A-Za-z])(DRYADS*\s*(?:BOWS*?)?)(?=[^A-Za-z]|$)/gi, "$1森精灵弓")
	data = data.replace(/(^|[^A-Za-z])(SL*?IL*?VERWING*\s*(?:RECURVE)?\s*(?:BOWS*?)?)(?=[^A-Za-z]|$)/gi, "$1银翼反曲弓")
	data = data.replace(/(^|[^A-Za-z])((?:CAN|COULD) SOMEONE|(?:CAN|COULD) ANYONE)(?=[^A-Za-z]|$)/gi, "$1有谁能")
	data = data.replace(/(^|[^A-Za-z])((?:HAVE|HAS)+?\s*?(?:TO|2)+?\s*?BE*|MUST BE*)(?=[^A-Za-z]|$)/gi, "$1必须是")
	data = data.replace(/(^|[^A-Za-z])(LAST CHANCE)(?=[^A-Za-z]|$)/gi, "$1最后机会")
	data = data.replace(/(^|[^A-Za-z])(BUY\s*(?:ONE|1)+?\s*GET\s*(?:ONE|1)+?\s*(?:FREE)?)(?=[^A-Za-z]|$)/gi, "$1买一送一")
	data = data.replace(/(^|[^A-Za-z])(BUY\s*(?:TWO|2)+?\s*GET\s*(?:ONE|1)+?\s*(?:FREE)?)(?=[^A-Za-z]|$)/gi, "$1买二送一")
	data = data.replace(/(^|[^A-Za-z])(EXALTED*? AEGIS*)(?=[^A-Za-z]|$)/gi, "$1尊贵护盾")
	data = data.replace(/(^|[^A-Za-z])(IRIDESCENT AEGIS*)(?=[^A-Za-z]|$)/gi, "$1七彩神盾")
	data = data.replace(/(^|[^A-Za-z])(TRADES*? ACCEPTED|ACCEPTS*? TRADES*?)(?=[^A-Za-z]|$)/gi, "$1接受易物")
	data = data.replace(/(^|[^A-Za-z])(PARTY\s*?\-*?WIDE DP REMOVA*?L*?E*?R*?S*?)(?=[^A-Za-z]|$)/gi, "$1消全队死亡惩罚")
	data = data.replace(/(^|[^A-Za-z])(PARTY\s*?\-*?WIDE DP CONS*?)(?=[^A-Za-z]|$)/gi, "$1消全队死亡惩罚")
	data = data.replace(/(^|[^A-Za-z])(PARTY\s*?\-*?WIDE)(?=[^A-Za-z]|$)/gi, "$1全队")
	data = data.replace(/(^|[^A-Za-z])(ARMOU*?R PENE*?T*?R*?A*?T*?I*?O*?N?)(?=[^A-Za-z]|$)/gi, "$1防御穿透")
	data = data.replace(/(^|[^A-Za-z])(UNOPENED)(?=[^A-Za-z]|$)/gi, "$1未打开的")
	data = data.replace(/(^|[^A-Za-z])(HAM*?MERS*? (?:OF )?KAN*?THANDRAX*?S*?|KATHA*?N*?D*?R*?A*?X*?S*?\.*?\s*?HAMM*?ERS*?|HAM*?MERS*? OF KATHA*?N*?S*?X*?|KATHS*?X*? H\.*?)(?=[^A-Za-z]|$)/gi, "$1卡山卓司之锤")
	data = data.replace(/(^|[^A-Za-z])(WINTERS*?(?:DAY)*?\s*?GIFTS*?|WD GIFTS*?)(?=[^A-Za-z]|$)/gi, "$1冬庆礼物")
	data = data.replace(/(^|[^A-Za-z])(DARK\s*?WING DEFENDER|DARKWING)(?=[^A-Za-z]|$)/gi, "$1黑翼防御者")
	data = data.replace(/(^|[^A-Za-z])(Amethyst Aegis)(?=[^A-Za-z]|$)/gi, "$1紫水晶盾")
	data = data.replace(/(^|[^A-Za-z])(Amethyst*?)(?=[^A-Za-z]|$)/gi, "$1紫水晶")
	data = data.replace(/(^|[^A-Za-z])((?:FIERY|FIREY)\s*?DRAGON\s*?SWORDS*?|FDS)(?=[^A-Za-z]|$)/gi, "$1火焰巨龙之剑")
	data = data.replace(/(^|[^A-Za-z])((?:ICY|ICEY)\s*?DRAGON\s*?SWORDS*?|IDS)(?=[^A-Za-z]|$)/gi, "$1冰冻巨龙之剑")
	data = data.replace(/(^|[^A-Za-z])(WINTERS*?\s*?DAY'*?S*?|WD)(?=[^A-Za-z]|$)/gi, "$1冬庆日")
	data = data.replace(/(^|[^A-Za-z])((?:VAMPIRIC|VAMPIRE)\s*?DRAGON\s*?SWORDS*?|VDS)(?=[^A-Za-z]|$)/gi, "$1吸血巨龙之剑")
	data = data.replace(/(^|[^A-Za-z])(PRE\s*?NERF)(?=[^A-Za-z]|$)/gi, "$1绝版")
	data = data.replace(/(^|[^A-Za-z])(GUARDIAN OF THE HUNT)(?=[^A-Za-z]|$)/gi, "$1猎户守卫者")
	data = data.replace(/(^|[^A-Za-z])(PARTY\s*?POINTS*?)(?=[^A-Za-z]|$)/gi, "$1狂欢分")
	data = data.replace(/(^|[^A-Za-z])(STONE\s*?RAINS*?)(?=[^A-Za-z]|$)/gi, "$1石之雨")
	data = data.replace(/(^|[^A-Za-z])(POLYMOC*K*S*?(?: PIECES*)?)(?=[^A-Za-z]|$)/gi, "$1战斗仿棋")
	data = data.replace(/(^|[^A-Za-z])(MASTER OF WH*?I*?SPE*?R*?S*?)(?=[^A-Za-z]|$)/gi, "$1唤言大师")
	if (样式) {
		data = data.replace(/^WTBUY|^WTB/gi, "<span style=\"color:#0000FF;font-weight:900\">买</span>")
		data = data.replace(/^WTSELL|^WTS/gi, "<span style=\"color:#BB00BB;font-weight:900\">卖</span>")
	} else {
		data = data.replace(/^WTBUY|^WTB/gi, "买")
		data = data.replace(/^WTSELL|^WTS/gi, "卖")
	}
	data = data.replace(/(^|[^A-Za-z])(PRIMEVAL(?: ARO*?MOU*?R)*? REMN*?A*?N*?T*?S*?)(?=[^A-Za-z]|$)/gi, "$1太古防具零料")
	data = data.replace(/(^|[^A-Za-z])(DELDRIMORE*?(?: ARO*?MOU*?R)*? REMN*?A*?N*?T*?S*?)(?=[^A-Za-z]|$)/gi, "$1戴尔狄摩防具零料")
	data = data.replace(/(^|[^A-Za-z])(STOLEN SUNS*?PEARS*?(?: ARO*?MOU*?RS*?)?((?: PIECES*?)?|(?: REMN*?A*?N*?T*?S*?)?)?)(?=[^A-Za-z]|$)/gi, "$1失窃的日戟防具")
	data = data.replace(/(^|[^A-Za-z])(SUNS*?PEARS*?(?: ARO*?MOU*?RS*?)+?((?: PIECES*?)+?|(?: REMN*?A*?N*?T*?S*?)+?)?)(?=[^A-Za-z]|$)/gi, "$1失窃的日戟防具")
	data = data.replace(/(^|[^A-Za-z])(STOLEN SS(?: ARO*?MOU*?RS*?)?)(?=[^A-Za-z]|$)/gi, "$1失窃的日戟防具")
	data = data.replace(/(^|[^A-Za-z])(C*?S*?LOTHE*?S*?(?: OF)?(?: THE)? BROTHERHOOD|BROTHERHOOD CLOTHE*?S*?|BROTHERHOOD ARO*?MOU*?RS*?|Cloths*? of B)(?=[^A-Za-z]|$)/gi, "$1修士布料")

	data = data.replace(/(^|[^A-Za-z])(WIND\s*?RI*?Y*?DERS*?)(?=[^A-Za-z]|$)/gi, "$1驭风者")
	data = data.replace(/(^|[^A-Za-z])(IRUKAND*?J*?I)(?=[^A-Za-z]|$)/gi, "$1毒水母")
	data = data.replace(/(^|[^A-Za-z])(SPEEDBOOKING*?S*?|SPEEDBOOKS*?)(?=[^A-Za-z]|$)/gi, "$1四章快速写书(注:每本只做三任务: 1-诺恩熊的诅咒, 2-对抗夏尔, 3-英雄的光采年代)")
	data = data.replace(/(^|[^A-Za-z])(SPEEDBOOKERS*?)(?=[^A-Za-z]|$)/gi, "$1四章快速写书人(注:每本只做三任务: 1-诺恩熊的诅咒, 2-对抗夏尔, 3-英雄的光采年代)")
	data = data.replace(/(^|[^A-Za-z])(ATFH)(?=[^A-Za-z]|$)/gi, "$1英雄的光采年代")

	data = data.replace(/(^|[^A-Za-z])(FLAME*?S*? OF BL*?AL*?THA*?ZARD*?|BL*?AL*?THA*?ZAR'?s*? FLAME*?S*?|FLAME*?S*? OF BL*?AL*?THA*?S*?ARD*?|BL*?AL*?THA*?SAR'?s*? FLAME*?S*?|FLAME*?S*? OF BL*?AL*?THS*?|FLAME*?S*? OF BALT|BALT FLAMES*?)(?=[^A-Za-z]|$)/gi, "$1巴萨泽火焰")
	data = data.replace(/(^|[^A-Za-z])(OPENTRADE|OPEN TRADE|OPEN NOW|OPENN*?OW)(?=[^A-Za-z]|$)/gi, "$1来交易")
	data = data.replace(/(^|[^A-Za-z])(MOSS SPIDER EGGS*?|SPIDER EGGS*?)(?=[^A-Za-z]|$)/gi, "$1蜘蛛蛋")
	data = data.replace(/(^|[^A-Za-z])(DE*?é*?MONIC RELICS*?)(?=[^A-Za-z]|$)/gi, "$1恶魔残片")
	data = data.replace(/(^|[^A-Za-z])((?:DHUU*?M'*?S*? )?SOULD*?\s*?REAP*?V*?E*?R*?S*?|(?:DHUMM'*?S*? )?SOULD*?\s*?REAP*?V*?ERS*?|DSR|(?:DHUU*?MM*?'*?S*? )+?SC*?Y*C*?TY*HES*?)(?=[^A-Za-z]|$)/gi, "$1多姆镰刀")
	data = data.replace(/(^|[^A-Za-z])((?:BLACK*?H*? )*?BEAST(?: OF A*?R*?G*?H*?)?)(?=[^A-Za-z]|$)/gi, "$1黑色魔兽阿而古")
	data = data.replace(/(^|[^A-Za-z])(CLOCK\s*?WORK*?S*?(?:THY)?(?: SC*?Y*C*?TY*HES*?)?)(?=[^A-Za-z]|$)/gi, "$1机械镰刀")
	data = data.replace(/(^|[^A-Za-z])(volta*?ic*? spears*?)(?=[^A-Za-z]|$)/gi, "$1电流矛")
	data = data.replace(/(^|[^A-Za-z])(BDS STAF*?V*?E*?S*?|BDS|BONE DRAGON STAF*?V*?E*?S*?|B Dragon StaF*?V*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1骸骨龙法杖")
	data = data.replace(/(^|[^A-Za-z])(B DRAGON|BONE DRAGON)(?=[^A-Za-z]|$)/gi, "$1骸骨龙(迷你)")
	data = data.replace(/(^|[^A-Za-z])(MARGON*?I*?T*?E*? GEMST*?O*?N*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1玛骨奈宝石")
	data = data.replace(/(^|[^A-Za-z])(GL*?AL*?CIAL\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1冰河石")
	data = data.replace(/(^|[^A-Za-z])(LONG\s*?BOWS*?)(?=[^A-Za-z]|$)/gi, "$1长弓")
	data = data.replace(/(^|[^A-Za-z])(LONG\s*?SWORDS*?)(?=[^A-Za-z]|$)/gi, "$1长剑")
	data = data.replace(/(^|[^A-Za-z])(SHORT\s*?SWORDS*?)(?=[^A-Za-z]|$)/gi, "$1短剑")
	data = data.replace(/(^|[^A-Za-z])(SINGLE HAND|SINGLEHAND)(?=[^A-Za-z]|$)/gi, "$1单手")
	data = data.replace(/(^|[^A-Za-z])(SELF\-*?\s*?INVI*?T*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1加我入队")
	data = data.replace(/(^|[^A-Za-z])(SPEED\s*?CLEARS*?)(?=[^A-Za-z]|$)/gi, "$1快速团")
	data = data.replace(/(^|[^A-Za-z])(DARK\s*?REMAI*?NS*?)(?=[^A-Za-z]|$)/gi, "$1黑残余物")
	data = data.replace(/(^|[^A-Za-z])((?:MONUMENTAL )?TAPESTRY*?I*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1纪念碑绣帷")
	data = data.replace(/(^|[^A-Za-z])(FIRE ISLANDS*?)(?=[^A-Za-z]|$)/gi, "$1火环岛")
	data = data.replace(/(^|[^A-Za-z])(DAILY CAPS*?)(?=[^A-Za-z]|$)/gi, "$1日上限")
	data = data.replace(/(^|[^A-Za-z])(FOWSCS*?)(?=[^A-Za-z]|$)/gi, "$1灾难快速团")
	data = data.replace(/(^|[^A-Za-z])(UWSCS*?)(?=[^A-Za-z]|$)/gi, "$1地下快速团")
	data = data.replace(/(^|[^A-Za-z])(DOASCS*?|TDPSCS*?)(?=[^A-Za-z]|$)/gi, "$1四门快速团")
	data = data.replace(/(^|[^A-Za-z])(SOOSCS*?)(?=[^A-Za-z]|$)/gi, "$1偶尔快速团")
	data = data.replace(/(^|[^A-Za-z])(SIMILARS*?)(?=[^A-Za-z]|$)/gi, "$1类似的")
	data = data.replace(/(^|[^A-Za-z])(OS*?BS*?IDIAN ARO*?MOU*?RS*?|FOW ARO*?MOU*?RS*?)(?=[^A-Za-z]|$)/gi, "$1灾难盔甲")
	data = data.replace(/(^|[^A-Za-z])(AT MERCV*?HA*?N*?T*?'*?S*?|@ MERCV*?HA*?N*?T*?'*?S*?)(?=[^A-Za-z]|$)/gi, "$1在商人处")
	data = data.replace(/(^|[^A-Za-z])(MERCV*?HA*?N*?T*?'S*?)(?=[^A-Za-z]|$)/gi, "$1商人的")
	data = data.replace(/(^|[^A-Za-z])(MERCV*?HA*?N*?T*?S*?)(?=[^A-Za-z]|$)/gi, "$1商人")
	data = data.replace(/(^|[^A-Za-z])((?:GET|BUY)+?\s*?THEM\s*?WHILE\s*?(?:THEY'RE|THEIR|THEY ARE)?\s*?CHEAP)(?=[^A-Za-z]|$)/gi, "$1趁便宜时买")
	data = data.replace(/(^|[^A-Za-z])((?:GET|BUY)+?\s*?THEM\s*?WHEN\s*?(?:THEY'RE|THEIR|THEY ARE)?\s*?CHEAP)(?=[^A-Za-z]|$)/gi, "$1趁便宜时买")
	data = data.replace(/(^|[^A-Za-z])((?:GOLDEN )?RIN RELICT*?S*?|RIN RELICK*?S*?|RINS*?|Relic*K*s*)(?=[^A-Za-z]|$)/gi, "$1遗物")
	data = data.replace(/(^|[^A-Za-z])(PARTY SEARCH)(?=[^A-Za-z]|$)/gi, "$1队伍搜寻")
	data = data.replace(/(^|[^A-Za-z])(COMES WITH)(?=[^A-Za-z]|$)/gi, "$1伴")
	data = data.replace(/(^|[^A-Za-z])(DEALS* OF THE DAY)(?=[^A-Za-z]|$)/gi, "$1今日优惠")
	data = data.replace(/(^|[^A-Za-z])(Inferno ImpS*?|FIRE IMPS*?)(?=[^A-Za-z]|$)/gi, "$1地狱小恶魔")
	data = data.replace(/(^|[^A-Za-z])(HARPY RANGERS*?|HARPIES*? RANGERS*?)(?=[^A-Za-z]|$)/gi, "$1鸟妖游侠")
	data = data.replace(/(^|[^A-Za-z])(CHARR*? SHAMANS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔")
	data = data.replace(/(^|[^A-Za-z])(SUPERB*? (?:CHARR*? )?CH*?ARVING*?S*?)(?=[^A-Za-z]|$)/gi, "$1超级夏尔雕刻品")
	data = data.replace(/(^|[^A-Za-z])(CHARR*? CH*?ARVING*?S*?)(?=[^A-Za-z]|$)/gi, "$1夏尔雕刻品")
	data = data.replace(/(^|[^A-Za-z])(IBOGA PET*?D*?ALS*?)(?=[^A-Za-z]|$)/gi, "$1伊波枷花瓣")
	data = data.replace(/(^|[^A-Za-z])(FEATHERE*?D*?S*? CRESTS*?)(?=[^A-Za-z]|$)/gi, "$1羽毛冠")
	data = data.replace(/(^|[^A-Za-z])(JADE ARMOU*?RS*?)(?=[^A-Za-z]|$)/gi, "$1翡翠战士")
	data = data.replace(/(^|[^A-Za-z])(STARS*? OF TRANSFERENCES*?)(?=[^A-Za-z]|$)/gi, "$1恒星转移")
	data = data.replace(/(^|[^A-Za-z])(SERRATED*?)(?=[^A-Za-z]|$)/gi, "$1齿状")
	data = data.replace(/(^|[^A-Za-z])(CLUBS*? (?:OF )?(?:A )?THOUSANDS*? BEARS*?)(?=[^A-Za-z]|$)/gi, "$1千熊之锤")
	data = data.replace(/(^|[^A-Za-z])(TRADE MODE*?R*?A*?T*?O*?E*?R*?S*?|((?:Trusted )+?|(?:TRADE )+?)+? MODE*?R*?A*?T*?O*?E*?R*?S*?)(?=[^A-Za-z]|$)/gi, "$1中间人")
	data = data.replace(/(^|[^A-Za-z])((?:C*?S&?ELESTIALS*? )?SIGI*?E*?LS*?)(?=[^A-Za-z]|$)/gi, "$1神圣印记")
	data = data.replace(/(^|[^A-Za-z])TOMES (\d)A(?=[^A-Za-z]|$)/gi, "$1Tomes $2暗杀")
	data = data.replace(/(^|[^A-Za-z])((ele*?|ri*?t|wars*?|sin|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|assas*?)\s?,\s?)Me(\s?,\s?(ele*?|ri*?t|wars*?|sin|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|assas*?))(?=[^A-Za-z\$])/gi, "$2幻术$4")
	data = data.replace(/(^|[^A-Za-z])((ele*?|ri*?t|wars*?|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|Mes*?m*?e*?r*?s*?)\s?,\s?)A(\s?,\s?(ele*?|ri*?t|wars*?|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|Mes*?m*?e*?r*?s*?))(?=[^A-Za-z\$])/gi, "$2暗杀$4")
	data = data.replace(/(^|[^A-Za-z])((ele*?|ri*?t|wars*?|sin|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|assas*?)\s?\/\s?)Me(\s?\/\s?(ele*?|ri*?t|wars*?|sin|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|assas*?))(?=[^A-Za-z\$])/gi, "$2幻术$4")
	data = data.replace(/(^|[^A-Za-z])((ele*?|ri*?t|wars*?|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|Mes*?m*?e*?r*?s*?)\s?\/\s?)A(\s?\/\s?(ele*?|ri*?t|wars*?|necr*?o*?|rangers*?|de*?r*?v*?|Pa*?r*?a*?g*?o*?n*?|Mon*?k*?s*?|Mes*?m*?e*?r*?s*?))(?=[^A-Za-z\$])/gi, "$2暗杀$4")
	data = data.replace(/(W\/R\/)/gi, "战士/游侠/")
	data = data.replace(/(\/Me\/)/gi, "/幻术/")
	data = data.replace(/(\/D\/)/gi, "/神唤/")
	data = data.replace(/(\/P\/)/gi, "/圣言/")
	data = data.replace(/(\/N\/)/gi, "/死灵/")
	data = data.replace(/(\/E\/)/gi, "/元素/") //注意:此处或出错
	data = data.replace(/(\/EL\/)/gi, "/元素/") //注意:此处或出错
	data = data.replace(/(^|[^A-Za-z])(WOLF|WOLVES)(?=[^A-Za-z]|$)/gi, "$1狼")
	data = data.replace(/(^|[^A-Za-z])(REMOVER*?S*?)(?=[^A-Za-z]|$)/gi, "$1去除")

	//0-9\)\!\@\#\$\%\^\&\*\-\+\=\_\{\}\[\]\'\"\:\;\/\.\,\`\~
	data = data.replace(/(^|[^A-Za-z])(\/*?\s*?WH*?I*?L*E*S*T*\s*?(?:in)?\s*?(?:a)?\s*?STANCE*)(?=[^A-Za-z]|$)/gi, "$1(势态下)")
	data = data.replace(/(^|[^A-Za-z])(\/*?\s*?WH*?I*?L*E*S*T*\s*?EN*CHA*?N*?T*?E*?D*)(?=[^A-Za-z]|$)/gi, "$1(加持下)")
	data = data.replace(/(^|[^A-Za-z])(\/*?\s*?WH*?I*?L*E*S*T*\s*?HE*?A*?XE*?D*)(?=[^A-Za-z]|$)/gi, "$1(被咒时)")
	data = data.replace(/(^|[^A-Za-z])(\/*?\s*?WH*?I*?L*E*S*T*\s*?ATT*?A*?C*?KC*?I*?N*?G*)(?=[^A-Za-z]|$)/gi, "$1(进攻时)")
	//data=data.replace(/(^|[^A-Za-z])(WHILE)(?=[^A-Za-z]|$)/gi, '$1效应下');

	data = data.replace(/(^|[^A-Za-z])((?:PM|SAY|TELL(?: ME)?|WH*?I*?SPE*?R*?(?: ME)?)+? WHAT Y*?O*?U(?: NEED|WANT)+?)(?=[^A-Za-z]|$)/gi, "$1告诉我你要什么")
	data = data.replace(/(^|[^A-Za-z])(WHAT (?:DO )?Y*?O*?U(?: NEED|WANT)+?)(?=[^A-Za-z]|$)/gi, "$1你要什么")

	data = data.replace(/(^|[^A-Za-z])((?:PM|SAY|TELL(?: ME)?|WH*?I*?SPE*?R*?(?: ME)?)+? WHAT Y*?O*?U(?: GOT|HAVE)+?)(?=[^A-Za-z]|$)/gi, "$1告诉我你有什么")
	data = data.replace(/(^|[^A-Za-z])(WHAT (?:DO )?Y*?O*?U(?: GOT|HAVE)+?)(?=[^A-Za-z]|$)/gi, "$1你有什么")

	data = data.replace(/(^|[^A-Za-z])((?:PM|SAY|TELL(?: ME)?|WH*?I*?SPE*?R*?(?: ME)?)+? HOW\s*?MANY Y*?O*?U(?: NEED|WANT)+?)(?=[^A-Za-z]|$)/gi, "$1告诉我你要多少")
	data = data.replace(/(^|[^A-Za-z])((?:PM|SAY|TELL(?: ME)?|WH*?I*?SPE*?R*?(?: ME)?)+? HOW\s*?MANY Y*?O*?U(?: GOT|HAVE)+?)(?=[^A-Za-z]|$)/gi, "$1告诉我你有多少")

	data = data.replace(/(^|[^A-Za-z])(HOW\s*?MANY DO Y*?O*?U(?: NEED|WANT)+?)(?=[^A-Za-z]|$)/gi, "$1你要多少个")
	data = data.replace(/(^|[^A-Za-z])(HOW\s*?MANY DO Y*?O*?U(?: GOT|HAVE)+?)(?=[^A-Za-z]|$)/gi, "$1你有多少个")

	data = data.replace(/(^|[^A-Za-z])(HOW\s*?MUCH (?:DO )?Y*?O*?U(?: NEED|WANT)+?)(?=[^A-Za-z]|$)/gi, "$1你要多少")
	data = data.replace(/(^|[^A-Za-z])(HOW\s*?MUCH (?:DO )?Y*?O*?U(?: GOT|HAVE)+?)(?=[^A-Za-z]|$)/gi, "$1你有多少")

	data = data.replace(/(^|[^A-Za-z])(HOW MANY|combien de|HOW MUCH)(?=[^A-Za-z]|$)/gi, "$1多少")
	data = data.replace(/(^|[^A-Za-z])(Y*?O*?U WANT)(?=[^A-Za-z]|$)/gi, "$1你要")
	data = data.replace(/(^|[^A-Za-z])(Y*?O*?U HAVE|Y*?O*?U GOT)(?=[^A-Za-z]|$)/gi, "$1你有")


	data = data.replace(/(^|[^A-Za-z])(WINTERS*?DAY GRAB\s*?BA*?GS*?|WD GRAB\s*?BA*?GS*?|WINTERS*? GRAB\s*?BA*?GS*?)(?=[^A-Za-z]|$)/gi, "$1冬季节日袋(含甜点，酒，狂欢分，或迷你北极熊)")
	data = data.replace(/(^|[^A-Za-z])(LUNARS*? (?:FESTIVAL )?GRAB\s*?BAGS*?|LUNARS*? GRAB\s*?BA*?GS*?)(?=[^A-Za-z]|$)/gi, "$1农历新年节日袋(含250甜点，酒，或狂欢分)")
	data = data.replace(/(^|[^A-Za-z])(GRAB\s*?BA*?GS*?)(?=[^A-Za-z]|$)/gi, "$1节日袋(含甜点，酒，或狂欢分)")
	data = data.replace(/(^|[^A-Za-z])(CRY*?I*?STALL*?II*?NES*?\s*?(?: SWORDS*?)?|CRY*?I*?STAL*?(?: SWORDS*?)?)(?=[^A-Za-z]|$)/gi, "$1水晶剑")
	data = data.replace(/(^|[^A-Za-z])((?:SU*?GU*?A*?E*?RY*? )?BLUE DRINKS*?)(?=[^A-Za-z]|$)/gi, "$1蓝汽水(甜点)")
	data = data.replace(/(^|[^A-Za-z])(BLUE\s*?(?:SU*?GU*?A*?E*?RY*?)? DRINKS*?)(?=[^A-Za-z]|$)/gi, "$1蓝汽水(甜点)")
	data = data.replace(/(^|[^A-Za-z])((?:HARD )?APPLE CIDERS*?)(?=[^A-Za-z]|$)/gi, "$1热苹果酒")
	data = data.replace(/(^|[^A-Za-z])((?:FLASKS*? )?(?:OF )?\s*?FIRE\s*?WATERS*?)(?=[^A-Za-z]|$)/gi, "$1火焰烈酒")
	data = data.replace(/(^|[^A-Za-z])(SPEARS*? OF T*?H*?E*?\s*?HI*?EROPHANT)(?=[^A-Za-z]|$)/gi, "$1绿矛(类似电流矛)")
	data = data.replace(/(^|[^A-Za-z])(WAR IN KRYTA|WIK)(?=[^A-Za-z]|$)/gi, "$1科瑞塔战争")
	data = data.replace(/(^|[^A-Za-z])(BO\s*?STAVES|BO\s*?STAFFS|BO\s*?STAFF)(?=[^A-Za-z]|$)/gi, "$1波法杖")
	data = data.replace(/(^|[^A-Za-z])(SHI*?E*?LD OF (?:THE )?LIONS*?)(?=[^A-Za-z]|$)/gi, "$1狮盾")
	data = data.replace(/(^|[^A-Za-z])(SHI*?E*?LD OF (?:THE )?WINGS*?)(?=[^A-Za-z]|$)/gi, "$1飞翼盾")
	data = data.replace(/(^|[^A-Za-z])(Water Djii*?nn Essenc*?s*?eS*?)(?=[^A-Za-z]|$)/gi, "$1水巨灵精华")
	data = data.replace(/(^|[^A-Za-z])(WATT*?ERS*?\s*?D*JIi*?NN*?)(?=[^A-Za-z]|$)/gi, "$1水巨灵")
	data = data.replace(/(^|[^A-Za-z])(FIRE\s*?D*JIi*?NN*?|FLAME*?(?:ING)*? DJII*?NN*?)(?=[^A-Za-z]|$)/gi, "$1火巨灵")
	data = data.replace(/(^|[^A-Za-z])(Kuu*?navang*?|KUNNAs*?|KUNN|KUU*?N|KUNN*?AVANG*?s*?|kuu*?vanan*?g*?s*?|kunnuvangs*?|Kuunas*?|kuunavag)(?=[^A-Za-z]|$)/gi, "$1古纳维(绿飞龙)")
	data = data.replace(/(^|[^A-Za-z])(SHIRO'*?K*?E*?N*? ASS*?ASS*?INS*?)(?=[^A-Za-z]|$)/gi, "$1白影刺客")
	data = data.replace(/(^|[^A-Za-z])(Shiro'*?kenS*?)(?=[^A-Za-z]|$)/gi, "$1白影(注:田胜或刺客)")
	//data=data.replace(/(^|[^A-Za-z])(Shiro'*?kenS*?)(?=[^A-Za-z]|$)/gi, '$1白影军团');
	data = data.replace(/(^|[^A-Za-z])(SHIRO TAGACHI|SHIRO)(?=[^A-Za-z]|$)/gi, "$1白影田胜")
	data = data.replace(/(^|[^A-Za-z])(saurian sC*?yC*?htes*?|saurian scY*TY*hes*?)(?=[^A-Za-z]|$)/gi, "$1蜥蜴镰刀")
	data = data.replace(/(^|[^A-Za-z])((?:GUILD)?\s*?TAGS*?)(?=[^A-Za-z]|$)/gi, "$1公会牌")
	data = data.replace(/(^|[^A-Za-z])(MAKERS*?)(?=[^A-Za-z]|$)/gi, "$1制作人")
	data = data.replace(/(^|[^A-Za-z])(NEXT WEEKS*?)(?=[^A-Za-z]|$)/gi, "$1下周")
	data = data.replace(/(^|[^A-Za-z])(NEXT WEEK'S)(?=[^A-Za-z]|$)/gi, "$1下周的")
	data = data.replace(/(^|[^A-Za-z])(DUAL\s*?VAMPS*?|DUO\s*?VAMPS*?)(?=[^A-Za-z]|$)/gi, "$1双吸血")
	data = data.replace(/(^|[^A-Za-z])(PLATS*I*N*U*M* STAFFS*?|PLATS*I*N*U*M* STAVES*?)(?=[^A-Za-z]|$)/gi, "$1白金法杖")

	//部分武器，放在此处以防被拆散
	data = data.replace(/(^|[^A-Za-z])(Ascalon\s*?Axes*?)(?=[^A-Za-z]|$)/gi, "$1阿斯卡隆斧")
	data = data.replace(/(^|[^A-Za-z])(Battle\s*?Axes*?)(?=[^A-Za-z]|$)/gi, "$1战斧")
	data = data.replace(/(^|[^A-Za-z])(Cleavers*?)(?=[^A-Za-z]|$)/gi, "$1切割斧")
	data = data.replace(/(^|[^A-Za-z])(Double-bladed Axes*?)(?=[^A-Za-z]|$)/gi, "$1双刃斧")
	data = data.replace(/(^|[^A-Za-z])(Great\s*?Axes*?)(?=[^A-Za-z]|$)/gi, "$1巨斧")
	data = data.replace(/(^|[^A-Za-z])(Hand\s*?Axes*?)(?=[^A-Za-z]|$)/gi, "$1手斧")
	data = data.replace(/(^|[^A-Za-z])(Kyhlo\s*?Axes*?)(?=[^A-Za-z]|$)/gi, "$1凯隆斧")
	data = data.replace(/(^|[^A-Za-z])(Piercing\s*?Axes*?)(?=[^A-Za-z]|$)/gi, "$1刺骨之斧")
	data = data.replace(/(^|[^A-Za-z])(Sickles*?)(?=[^A-Za-z]|$)/gi, "$1镰斧")
	data = data.replace(/(^|[^A-Za-z])(Spiked\s*?Axes*?)(?=[^A-Za-z]|$)/gi, "$1棘刺斧")
	data = data.replace(/(^|[^A-Za-z])(Break\s*?Hammers*?)(?=[^A-Za-z]|$)/gi, "$1破灭之锤")
	data = data.replace(/(^|[^A-Za-z])(Forehammers*?)(?=[^A-Za-z]|$)/gi, "$1枪锤")
	data = data.replace(/(^|[^A-Za-z])(Magmas\s*?Arms*?)(?=[^A-Za-z]|$)/gi, "$1岩浆武器")
	data = data.replace(/(^|[^A-Za-z])(Ram's Hammers*?)(?=[^A-Za-z]|$)/gi, "$1攻城锤")
	data = data.replace(/(^|[^A-Za-z])(Righteous\s*?Mauls*?)(?=[^A-Za-z]|$)/gi, "$1正义巨锤")
	data = data.replace(/(^|[^A-Za-z])(Runic\s*?Hammers*?)(?=[^A-Za-z]|$)/gi, "$1古文锤")
	data = data.replace(/(^|[^A-Za-z])(Summit\s*?Hammers*?)(?=[^A-Za-z]|$)/gi, "$1山峰锤")
	data = data.replace(/(^|[^A-Za-z])(War\s*?Hammers*?)(?=[^A-Za-z]|$)/gi, "$1战锤")
	data = data.replace(/(^|[^A-Za-z])(Ascalon\s*?Razors*?)(?=[^A-Za-z]|$)/gi, "$1阿斯卡隆刀")
	data = data.replace(/(^|[^A-Za-z])(Brute\s*?Swords*?)(?=[^A-Za-z]|$)/gi, "$1残忍之剑")
	data = data.replace(/(^|[^A-Za-z])(Butterfly\s*?Swords*?)(?=[^A-Za-z]|$)/gi, "$1蝴蝶之剑")
	data = data.replace(/(^|[^A-Za-z])(Falchions*?)(?=[^A-Za-z]|$)/gi, "$1圆月砍刀")
	data = data.replace(/(^|[^A-Za-z])(Fellblades*?)(?=[^A-Za-z]|$)/gi, "$1凶猛刀刃")
	data = data.replace(/(^|[^A-Za-z])(Flamberges*?)(?=[^A-Za-z]|$)/gi, "$1火舌剑")
	data = data.replace(/(^|[^A-Za-z])(Forked\s*?Swords*?)(?=[^A-Za-z]|$)/gi, "$1叉型剑")
	data = data.replace(/(^|[^A-Za-z])(Rinblades*?)(?=[^A-Za-z]|$)/gi, "$1瑞恩之刃")
	data = data.replace(/(^|[^A-Za-z])(Spathas*?)(?=[^A-Za-z]|$)/gi, "$1细身骑剑")
	data = data.replace(/(^|[^A-Za-z])(Tribal\s*?Blades*?)(?=[^A-Za-z]|$)/gi, "$1战斗砍刀")
	data = data.replace(/(^|[^A-Za-z])(Wingblade\s*?Swords*?)(?=[^A-Za-z]|$)/gi, "$1翼刃剑")
	data = data.replace(/(^|[^A-Za-z])(Ascalon\s*?Aegiss*?)(?=[^A-Za-z]|$)/gi, "$1阿斯卡隆神盾")
	data = data.replace(/(^|[^A-Za-z])(Crimson Carapace Shields*?)(?=[^A-Za-z]|$)/gi, "$1血腥外壳之盾")
	data = data.replace(/(^|[^A-Za-z])(Crude\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1粗暴之盾")
	data = data.replace(/(^|[^A-Za-z])(Defenders*?)(?=[^A-Za-z]|$)/gi, "$1守护者之盾")
	data = data.replace(/(^|[^A-Za-z])(Eternal\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1永恒之盾")
	data = data.replace(/(^|[^A-Za-z])(Magmas\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1岩之盾")
	data = data.replace(/(^|[^A-Za-z])(Ornate\s*?Bucklers*?)(?=[^A-Za-z]|$)/gi, "$1华丽圆盾")
	data = data.replace(/(^|[^A-Za-z])(Reinforced\s*?Bucklers*?)(?=[^A-Za-z]|$)/gi, "$1强化圆盾")
	data = data.replace(/(^|[^A-Za-z])(Round\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1圆盾")
	data = data.replace(/(^|[^A-Za-z])(Shadow\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1阴影盾")
	data = data.replace(/(^|[^A-Za-z])(Skeleton\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1骷髅盾")
	data = data.replace(/(^|[^A-Za-z])(Skull\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1骨盾")
	data = data.replace(/(^|[^A-Za-z])(Summit Warlord Shields*?)(?=[^A-Za-z]|$)/gi, "$1山峰军盾")
	data = data.replace(/(^|[^A-Za-z])(Tall\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1巨盾")
	data = data.replace(/(^|[^A-Za-z])(Tower\s*?Shields*?)(?=[^A-Za-z]|$)/gi, "$1塔盾")
	data = data.replace(/(^|[^A-Za-z])(Storm\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1风暴弓")
	data = data.replace(/(^|[^A-Za-z])(Flat\s*?bows*?)(?=[^A-Za-z]|$)/gi, "$1平底弓")
	data = data.replace(/(^|[^A-Za-z])(Horn\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1角弓")
	data = data.replace(/(^|[^A-Za-z])(Ivory\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1象牙弓")
	data = data.replace(/(^|[^A-Za-z])(Shadow\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1阴影弓")
	data = data.replace(/(^|[^A-Za-z])(Recurve\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1反曲弓")
	data = data.replace(/(^|[^A-Za-z])(Composite\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1复和弓")
	data = data.replace(/(^|[^A-Za-z])(Dead\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1死亡之弓")
	data = data.replace(/(^|[^A-Za-z])(Eternal\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1永恒之弓")
	data = data.replace(/(^|[^A-Za-z])(Short\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1短弓")
	data = data.replace(/(^|[^A-Za-z])(Half\s*?Moons*?)(?=[^A-Za-z]|$)/gi, "$1半月弓")
	data = data.replace(/(^|[^A-Za-z])(Ascalon\s*?Bows*?)(?=[^A-Za-z]|$)/gi, "$1阿斯卡隆弓")
	data = data.replace(/(^|[^A-Za-z])(Holy\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1神圣法杖")
	data = data.replace(/(^|[^A-Za-z])(Holy\s*?Rods*?)(?=[^A-Za-z]|$)/gi, "$1神圣手杖")
	data = data.replace(/(^|[^A-Za-z])(Divine\s*?Symbols*?)(?=[^A-Za-z]|$)/gi, "$1神圣符号")
	data = data.replace(/(^|[^A-Za-z])(Healing\s*?Ankhs*?)(?=[^A-Za-z]|$)/gi, "$1愈合十字架")
	data = data.replace(/(^|[^A-Za-z])(Protective\s*?Icons*?)(?=[^A-Za-z]|$)/gi, "$1守护图像")
	data = data.replace(/(^|[^A-Za-z])(Diessa\s*?Icons*?)(?=[^A-Za-z]|$)/gi, "$1底耶沙图像")
	data = data.replace(/(^|[^A-Za-z])(Deadly\s*?Cestas*?)(?=[^A-Za-z]|$)/gi, "$1致命短棒")
	data = data.replace(/(^|[^A-Za-z])(GRIM\s*?Cestas*?)(?=[^A-Za-z]|$)/gi, "$1邪魔法器")
	data = data.replace(/(^|[^A-Za-z])(Truncheons*?)(?=[^A-Za-z]|$)/gi, "$1战仪杖")
	data = data.replace(/(^|[^A-Za-z])(Accursed\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1诅咒法杖")
	data = data.replace(/(^|[^A-Za-z])(Blood\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1血之法杖")
	data = data.replace(/(^|[^A-Za-z])(Bone\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1骸骨法杖")
	data = data.replace(/(^|[^A-Za-z])(Cruel\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1残忍法杖")
	data = data.replace(/(^|[^A-Za-z])(Dead\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1死亡法杖")
	data = data.replace(/(^|[^A-Za-z])(Accursed\s*?Icons*?)(?=[^A-Za-z]|$)/gi, "$1诅咒图像")
	data = data.replace(/(^|[^A-Za-z])(Idols*?)(?=[^A-Za-z]|$)/gi, "$1邪恶法器")
	data = data.replace(/(^|[^A-Za-z])(Inscribed\s*?Chakrams*?)(?=[^A-Za-z]|$)/gi, "$1雕刻的圆月轮")
	data = data.replace(/(^|[^A-Za-z])(Inscribed\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1雕刻法杖")
	data = data.replace(/(^|[^A-Za-z])(Jeweled\s*?Staffs*?)(?=[^A-Za-z]|$)/gi, "$1宝石法杖")
	data = data.replace(/(^|[^A-Za-z])(Jeweled\s*?Chalices*?)(?=[^A-Za-z]|$)/gi, "$1宝石圣杯")
	data = data.replace(/(^|[^A-Za-z])(Jeweled\s*?Chakrams*?)(?=[^A-Za-z]|$)/gi, "$1宝石的圆月轮")
	data = data.replace(/(^|[^A-Za-z])(Legendary\s*?Swords*?)(?=[^A-Za-z]|$)/gi, "$1传说之剑")
	data = data.replace(/(^|[^A-Za-z])(BOWS*? OF THE KING*?SLAYER*?)(?=[^A-Za-z]|$)/gi, "$1杀王者之弓")
	data = data.replace(/(^|[^A-Za-z])(holy staff)(?=[^A-Za-z]|$)/gi, "$1神圣法杖")
	data = data.replace(/(^|[^A-Za-z])(holy branch)(?=[^A-Za-z]|$)/gi, "$1神圣树枝")
	data = data.replace(/(^|[^A-Za-z])(astral staff)(?=[^A-Za-z]|$)/gi, "$1星界法杖")
	data = data.replace(/(^|[^A-Za-z])(hide'*?ss*?plitter)(?=[^A-Za-z]|$)/gi, "$1裂皮者")
	data = data.replace(/(^|[^A-Za-z])(Heralt*?d*?ics*?)(?=[^A-Za-z]|$)/gi, "$1纹章")
	data = data.replace(/(^|[^A-Za-z])(Prisms*?)(?=[^A-Za-z]|$)/gi, "$1棱镜")
	data = data.replace(/(^|[^A-Za-z])(DEMON\s*?CRESTS*?)(?=[^A-Za-z]|$)/gi, "$1魔冠")

	data = data.replace(/(^|[^A-Za-z])(Abominations*?)(?=[^A-Za-z]|$)/gi, "$1鲜血高仑")

	//部分武器修饰语
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?CHARR*s*?)(?=[^A-Za-z]|$)/gi, "$1(对夏尔)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?DEMONs*?)(?=[^A-Za-z]|$)/gi, "$1(对恶魔)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?DRAGONs*?)(?=[^A-Za-z]|$)/gi, "$1(对龙)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?DWARVES*?)(?=[^A-Za-z]|$)/gi, "$1(对矮人)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?GIANTS*?)(?=[^A-Za-z]|$)/gi, "$1(对巨人)")
	//data=data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?OGRES*?)(?=[^A-Za-z]|$)/gi, '$1(对___)');
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?PLANTS*?)(?=[^A-Za-z]|$)/gi, "$1(对植物)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?SKELETONS*?)(?=[^A-Za-z]|$)/gi, "$1(对骷髅)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?TENGUS*?)(?=[^A-Za-z]|$)/gi, "$1(对天狗)")
	//data=data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?TROLLS*?)(?=[^A-Za-z]|$)/gi, '$1(___)');
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?UNDEADS*?)(?=[^A-Za-z]|$)/gi, "$1(对不死族)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?DWARF*?V*?E*?s*?)(?=[^A-Za-z]|$)/gi, "$1(对矮人)")

	data = data.replace(/(^|[^A-Za-z])(DISEASE)(?=[^A-Za-z]|$)/gi, "$1疾病")
	data = data.replace(/(^|[^A-Za-z])(DAZED)(?=[^A-Za-z]|$)/gi, "$1晕眩")
	data = data.replace(/(^|[^A-Za-z])(WEAKNESS)(?=[^A-Za-z]|$)/gi, "$1虚弱")
	data = data.replace(/(^|[^A-Za-z])(POISON)(?=[^A-Za-z]|$)/gi, "$1毒")
	data = data.replace(/(^|[^A-Za-z])(BLIND)(?=[^A-Za-z]|$)/gi, "$1盲目")
	data = data.replace(/(^|[^A-Za-z])(CRIPPLED)(?=[^A-Za-z]|$)/gi, "$1残废")
	data = data.replace(/(^|[^A-Za-z])(BURNING*?)(?=[^A-Za-z]|$)/gi, "$1着火")
	data = data.replace(/(^|[^A-Za-z])(BLEEDING*?|BLEED)(?=[^A-Za-z]|$)/gi, "$1流血")
	data = data.replace(/(^|[^A-Za-z])(DEEP WOUND)(?=[^A-Za-z]|$)/gi, "$1重伤")
	data = data.replace(/(^|[^A-Za-z])(CRACKED ARMOU*?RS*?)(?=[^A-Za-z]|$)/gi, "$1碎甲")

	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?HE*?A*?XE*D*(?: FOES*?)?)(?=[^A-Za-z]|$)/gi, "$1(对被咒者)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?BLUNTS*(?: DA*?MA*?GE*?S*?)?)(?=[^A-Za-z]|$)/gi, "$1(对钝击)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?SLASHI*N*G*(?: DA*?MA*?GE*?S*?)?)(?=[^A-Za-z]|$)/gi, "$1(对砍击)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?LIGHTN*?I*N*G*(?: DA*?MA*?GE*?S*?)?)(?=[^A-Za-z]|$)/gi, "$1(对电击)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?COLDS*(?: DA*?MA*?GE*?S*?)?)(?=[^A-Za-z]|$)/gi, "$1(对冰冻)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?FIRES*(?: DA*?MA*?GE*?S*?)?)(?=[^A-Za-z]|$)/gi, "$1(对火焰)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?EARTHS*(?: DA*?MA*?GE*?S*?)?)(?=[^A-Za-z]|$)/gi, "$1(对土击)")
	data = data.replace(/(^|[^A-Za-z])(VS*?\.*?\s?PI*?EI*?RC*?S*I*N*G*(?: DA*?MA*?GE*?S*?)?)(?=[^A-Za-z]|$)/gi, "$1(对穿刺)")

	data = data.replace(/(^|[^A-Za-z])((?:OS|OLDS*?CHOO*?L|OLD SCHOO*?L|OLD SKOO*?L|OLDSKOO*?L)\s*?(?:RS|RUNESCAPES*?))(?=[^A-Za-z]|$)/gi, "$1原版 江湖")
	if (样式) {
		data = data.replace(/(^|[^A-Za-z])(WANT TO SELL)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#BB00BB;font-weight:900\">卖</span>")
		data = data.replace(/(^|[^A-Za-z])(WANT TO BUY)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#0000FF;font-weight:900\">买</span>")
	} else {
		data = data.replace(/(^|[^A-Za-z])(WANT TO SELL)(?=[^A-Za-z]|$)/gi, "$1卖")
		data = data.replace(/(^|[^A-Za-z])(WANT TO BUY)(?=[^A-Za-z]|$)/gi, "$1买")
	}
	//1a. 铸印
	data = data.replace(/(^|[^A-Za-z])(STR\&HON)(?=[^A-Za-z]|$)/gi, "$1\"力与荣耀\"") //无法对上str&hon，原因不明
	data = data.replace(/(^|[^A-Za-z])(STR*?ENGT*?HT*?\s*?(?:AND|\&)?\s*?HONO*?R*?S*?)(?=[^A-Za-z]|$)/gi, "$1\"力与荣耀\"")
	data = data.replace(/(^|[^A-Za-z])(STRE*?N*?G*?T*?H*?T*?\s*?(?:AND|\&)?\s*?HONO*?R*?S*?)(?=[^A-Za-z]|$)/gi, "$1\"力与荣耀\"")
	data = data.replace(/(^|[^A-Za-z])(GUIL*?DED BY FAI*?TH*?E*?)(?=[^A-Za-z]|$)/gi, "$1\"命运\"")
	data = data.replace(/(^|[^A-Za-z])(DANCE WITH DEATH|DANCE W\/ DEATH)(?=[^A-Za-z]|$)/gi, "$1\"与死亡共舞\"")
	data = data.replace(/(^|[^A-Za-z])(TOO MUCH INFORMATION)(?=[^A-Za-z]|$)/gi, "$1\"多说无益\"")
	data = data.replace(/(^|[^A-Za-z])(TO THE PAIN)(?=[^A-Za-z]|$)/gi, "$1\"受死吧\"")
	data = data.replace(/(^|[^A-Za-z])(BRAWN*?S*? OVER BRAINS*?)(?=[^A-Za-z]|$)/gi, "$1\"有勇无谋\"")
	data = data.replace(/(^|[^A-Za-z])(VENGEANCE IS MINE)(?=[^A-Za-z]|$)/gi, "$1\"我要报仇\"")
	data = data.replace(/(^|[^A-Za-z])(DON'*?T FEAR THE REAPER)(?=[^A-Za-z]|$)/gi, "$1\"无惧死亡\"")

	data = data.replace(/(^|[^A-Za-z])(IM*?\s*?HAVE (?:THE )?POWE*?R|IHTP)(?=[^A-Za-z]|$)/gi, "$1\"充满力量\"")

	data = data.replace(/(^|[^A-Za-z])(HALE AND HEARTY|H & H)(?=[^A-Za-z]|$)/gi, "$1\"健壮的\"")
	data = data.replace(/(^|[^A-Za-z])(HAVE FAITH)(?=[^A-Za-z]|$)/gi, "$1\"信念\"")
	data = data.replace(/(^|[^A-Za-z])(DON'*?T CALL IT A COME\s*?BACK)(?=[^A-Za-z]|$)/gi, "$1\"别说我不行\"")
	data = data.replace(/(^|[^A-Za-z])(I AM SORROW)(?=[^A-Za-z]|$)/gi, "$1\"倍感忧伤\"")
	data = data.replace(/(^|[^A-Za-z])(SEIZE THE DAY|SIEZE THE DAY)(?=[^A-Za-z]|$)/gi, "$1\"把握时间\"")

	data = data.replace(/(^|[^A-Za-z])(DON'*?T THINK TWICE)(?=[^A-Za-z]|$)/gi, "$1\"别再考虑\"")
	data = data.replace(/(^|[^A-Za-z])(LET THE MEMORY LIVE AGAIN)(?=[^A-Za-z]|$)/gi, "$1\"记忆复苏\"")
	data = data.replace(/(^|[^A-Za-z])(AP NOT AT)(?=[^A-Za-z]|$)/gi, "$1\"能力而非态度\"")
	data = data.replace(/(^|[^A-Za-z])(APP*?TT*?ITT*?UD*?T*?EE*? NOT ATT*?ITT*?I*?T*?UD*?T*?EE*?|APTT*?I*?T*?U*?D*?E*\.*? NO*T* ATTI*?T*?U*?D*?E*?\.*?|App*?tit*?t*?u*?d*?e*?s*? not attitut*?des*?)(?=[^A-Za-z]|$)/gi, "$1\"能力而非态度\"")

	data = data.replace(/(^|[^A-Za-z])(NOT THE FACE)(?=[^A-Za-z]|$)/gi, "$1\"不要打脸\"")
	data = data.replace(/(^|[^A-Za-z])(LEAF ON THE WIND|LEAF IN THE WIND)(?=[^A-Za-z]|$)/gi, "$1\"风中之叶\"") //(对冰冻攻击 防御+10)
	data = data.replace(/(^|[^A-Za-z])(LIKE A ROLLING STONE)(?=[^A-Za-z]|$)/gi, "$1\"漂泊者\"")
	data = data.replace(/(^|[^A-Za-z])(SLEEP NOW IN THE FIRE)(?=[^A-Za-z]|$)/gi, "$1\"烈焰中歇息\"")
	data = data.replace(/(^|[^A-Za-z])(RIDERS ON THE STORM)(?=[^A-Za-z]|$)/gi, "$1\"暴风骑士\"")
	data = data.replace(/(^|[^A-Za-z])(THROUGH THICK AND THIN)(?=[^A-Za-z]|$)/gi, "$1\"同甘共苦\"")
	data = data.replace(/(^|[^A-Za-z])((?:THE )?RIDDLE OF STEEL)(?=[^A-Za-z]|$)/gi, "$1\"钢铁之谜\"")
	data = data.replace(/(^|[^A-Za-z])(SHELTERED BY FAITH)(?=[^A-Za-z]|$)/gi, "$1\"信念守护\"")
	data = data.replace(/(^|[^A-Za-z])(RUN FOR YOUR LIFE)(?=[^A-Za-z]|$)/gi, "$1\"逃命\"")
	data = data.replace(/(^|[^A-Za-z])(NOTHING TO FEAR)(?=[^A-Za-z]|$)/gi, "$1\"无畏无惧\"")
	data = data.replace(/(^|[^A-Za-z])(LUCK OF THE DRAW)(?=[^A-Za-z]|$)/gi, "$1\"全凭运气\"")
	data = data.replace(/(^|[^A-Za-z])(FEAR CUTS DEEPER)(?=[^A-Za-z]|$)/gi, "$1\"戒除恐惧\"")
	data = data.replace(/(^|[^A-Za-z])(I (?:CAN )?SEE CLEARLY(?: NOE*?W*?)?)(?=[^A-Za-z]|$)/gi, "$1\"光明再现\"")
	data = data.replace(/(^|[^A-Za-z])(SWIF*?T AS THE WIND)(?=[^A-Za-z]|$)/gi, "$1\"迅捷如风\"")
	data = data.replace(/(^|[^A-Za-z])(SOUNDNESS OF MIND)(?=[^A-Za-z]|$)/gi, "$1\"坚定意念\"")
	data = data.replace(/(^|[^A-Za-z])(STR*?ENGT*?HT*? OF BODY)(?=[^A-Za-z]|$)/gi, "$1\"力贯全身\"")
	data = data.replace(/(^|[^A-Za-z])(CAST OUT THE UNCLEAN)(?=[^A-Za-z]|$)/gi, "$1\"驱除不洁\"")
	data = data.replace(/(^|[^A-Za-z])(PURE OF HEART)(?=[^A-Za-z]|$)/gi, "$1\"纯净之心\"")
	data = data.replace(/(^|[^A-Za-z])(ONLY THE STRONG SURVIVE)(?=[^A-Za-z]|$)/gi, "$1\"强者生存\"")
	data = data.replace(/(^|[^A-Za-z])(HAIL TO THE KING)(?=[^A-Za-z]|$)/gi, "$1\"与王致敬\"")
	data = data.replace(/(^|[^A-Za-z])(FAITH IS MY SHIELD)(?=[^A-Za-z]|$)/gi, "$1\"信念是盾\"")
	data = data.replace(/(^|[^A-Za-z])(MIGHT MAKES RIGHT)(?=[^A-Za-z]|$)/gi, "$1\"胜者为王\"")
	data = data.replace(/(^|[^A-Za-z])(KNOWING IS HALF THE BATTLE)(?=[^A-Za-z]|$)/gi, "$1\"知者必胜\"")
	data = data.replace(/(^|[^A-Za-z])(MA*?E*?N FOR ALL SEASONS*?)(?=[^A-Za-z]|$)/gi, "$1\"名留青史\"")
	data = data.replace(/(^|[^A-Za-z])(SURVIVAL OF THE FITTEST)(?=[^A-Za-z]|$)/gi, "$1\"适者生存\"")
	data = data.replace(/(^|[^A-Za-z])(IGNORANCE IS BLISS)(?=[^A-Za-z]|$)/gi, "$1\"傻人有傻福\"")
	data = data.replace(/(^|[^A-Za-z])(LIFE IS PAIN)(?=[^A-Za-z]|$)/gi, "$1\"生如痛楚\"")
	data = data.replace(/(^|[^A-Za-z])(DOWN BUT NOT OUT)(?=[^A-Za-z]|$)/gi, "$1\"越挫越勇\"")
	data = data.replace(/(^|[^A-Za-z])(BE JUST AND FEAR NOT)(?=[^A-Za-z]|$)/gi, "$1\"正义无敌\"")
	data = data.replace(/(^|[^A-Za-z])(LIVE FOR TODAY)(?=[^A-Za-z]|$)/gi, "$1\"活在当下\"")

	data = data.replace(/(^|[^A-Za-z])(MASTER OF MY DOMAIN)(?=[^A-Za-z]|$)/gi, "$1\"这是我的地盘\"")
	data = data.replace(/(^|[^A-Za-z])(SERENITY NOW)(?=[^A-Za-z]|$)/gi, "$1\"平静\"")
	data = data.replace(/(^|[^A-Za-z])(FR*?OR*?GG*?E*?O*?T ME NOT)(?=[^A-Za-z]|$)/gi, "$1\"勿忘我\"")

	data = data.replace(/(^|[^A-Za-z])(MEAS*?U*?R*?E*?\.*?\s*?FOR\s*?MEAS*?U*?R*?E*?\.*?|MEAS*?U*?R*?E*?\.*?\s*?4\s*?MEAS*?U*?R*?E*?\.*?)(?=[^A-Za-z]|$)/gi, "$1\"以牙还牙\"")
	data = data.replace(/(^|[^A-Za-z])(SHOW ME THE MONEY)(?=[^A-Za-z]|$)/gi, "$1\"给我钱\"")

	//2. 卖买
	if (样式) {
		data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#BB00BB;font-weight:900\">卖</span>")
		data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#0000FF;font-weight:900\">买</span>")
	} else {
		data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1卖")
		data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1买")
	}
	data = data.replace(/(^|[^A-Za-z])(WTT|W[^A-Za-z]*?T\[^A-Za-z]*?T|TRADE*?S*?|TRADING)(?=[^A-Za-z]|$)/gi, "$1交易")
	data = data.replace(/(^|[^A-Za-z])(LF|LOOKING*? FOR)(?=[^A-Za-z]|$)/gi, "$1找")

	data = data.replace(/(^|[^A-Za-z])(C\/O|CO|C[^A-Za-z]*?O)(?=[^A-Za-z]|$)/gi, "$1他人报价")
	data = data.replace(/(^|[^A-Za-z])(B\/O|BO|B[^A-Za-z]*?O)(?=[^A-Za-z]|$)/gi, "$1买断价")
	data = data.replace(/(^|[^A-Za-z])(OBO|O[^A-Za-z]*?B[^A-Za-z]*?O|OR BEST OFFERS*?)(?=[^A-Za-z]|$)/gi, "$1或最好的报价")
	data = data.replace(/(^|[^A-Za-z])(WW*?SP\s*?ME|WH*?I*?SI*?P\.*?S*?(?:ER)*?S*? ME|PM\s*?ME|MP ME|\/W ME|PST ME|PSTS*?|SEND WH*?I*?SI*?P(?:ER)?|PSM|PSS*?S*?S*?S*?S*?T|ME*?SS*?A*?GE*? ME|SEND PM|SEND WH*?I*?SPE*?R*?S*?)(?=[^A-Za-z]|$)/gi, "$1与我联系")
	data = data.replace(/(^|[^A-Za-z])(PM (?:WITH )*?OFFERS*?T*?|MP (?:WITH )*?OFFERS*?|WH*?I*?SP(?:ER)*? (?:ME )*?OFFERS*?|\/W OFFE*?RE*?S*?|PM PRICES*?|WH*?I*?SP(?:ER)*? PRICES*?|MP PRICES*?|WH*?I*?SP(?:ER)*? OFFERS*?|MESSAGE (?:ME )*?PRICES*?|OFFER MEE*?E*?E*?E*?E*?|MAKE (?:AN*? )?OFFER|TAKI*?N*?G*? OFFE*?R*?E*?S*?|SHOW OFFE*?R*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1向我报价")
	data = data.replace(/(^|[^A-Za-z])(MP|PM|WH*?I*?SP(?:ER)*?)(?=[^A-Za-z]|$)/gi, "$1与我联系")
	data = data.replace(/(^|[^A-Za-z])(OFFERS*?T*?|OFFRES*?|OFER)(?=[^A-Za-z]|$)/gi, "$1向我报价")
	data = data.replace(/(^|[^A-Za-z])(0FFERS*?|0FFRES*?|0FER)(?=[^A-Za-z]|$)/gi, "$1向我报价")
	data = data.replace(/(^|[^A-Za-z])(PRICES*?)(?=[^A-Za-z]|$)/gi, "$1价钱")

	data = data.replace(/(^|[^A-Za-z])(ANY)(?=[^A-Za-z]|$)/gi, "$1任何")
	data = data.replace(/(^|[^A-Za-z])(AMOUNTS*?|AMOUTHS*?|AMT)(?=[^A-Za-z]|$)/gi, "$1量")
	//data=data.replace(/(^|[^A-Za-z])(ONLY)(?=[^A-Za-z]|$)/gi, '$1限');
	data = data.replace(/(^|[^A-Za-z])(NEEDS*?)(?=[^A-Za-z]|$)/gi, "$1需要")
	data = data.replace(/(^|[^A-Za-z])(CHEAPS*?)(?=[^A-Za-z]|$)/gi, "$1便宜的")
	data = data.replace(/(^|[^A-Za-z])(DISCOUNTS*?)(?=[^A-Za-z]|$)/gi, "$1打折")
	data = data.replace(/(^|[^A-Za-z])(WILL PAY)(?=[^A-Za-z]|$)/gi, "$1有偿")
	data = data.replace(/(^|[^A-Za-z])(PAYS*?|PAYING*?)(?=[^A-Za-z]|$)/gi, "$1付")
	data = data.replace(/(^|[^A-Za-z])(ACC*?EPT(?:ING*?)*?)(?=[^A-Za-z]|$)/gi, "$1接受")
	data = data.replace(/(^|[^A-Za-z])(PLEASE*?|PLI*?S|PLZZ*?S*?|PLOXE*?S*?|PLE*?Z|PLE*?S)(?=[^A-Za-z]|$)/gi, "$1劳驾")
	data = data.replace(/(^|[^A-Za-z])(\/EE*?ACH|\/EA|\/u|\/μ|\/μ)(?=[^A-Za-z]|$)/gi, "$1/个")
	data = data.replace(/(^|[^A-Za-z])(EE*?ACH|EA|APIECE|EAXH|ECAH)(?=[^A-Za-z]|$)/gi, "$1每个")
	data = data.replace(/(^|[^A-Za-z])(A\s*?LOT OF|MANY|MULTIPLE|LOT'*?S*? OF)(?=[^A-Za-z]|$)/gi, "$1多个")
	data = data.replace(/(\/STA*?C*?R*?KS*?|\/STKS|\/STK)(?=[^A-Za-z]|$)/gi, "/组")

	//3. 常见语
	data = data.replace(/(^|[^A-Za-z])(UNDEDICATED|UNDEDS*?|UND|CLEAN|UDEDS*?|Uned)(?=[^A-Za-z]|$)/gi, "$1未奉献的")
	data = data.replace(/(^|[^A-Za-z])(DEDICATED|DED)(?=[^A-Za-z]|$)/gi, "$1已奉献的")
	data = data.replace(/(^|[^A-Za-z])(UN\s*?IDS*?|UNIDENT*?D*?|UNIDENTI*?FI*?ED|UNID'D|UNDE*?S*?|UNIDE*?S*?|UNID'*?ED|unidents*?|unind)(?=[^A-Za-z]|$)/gi, "$1未鉴定物")
	data = data.replace(/(^|[^A-Za-z])(HIGH)(?=[^A-Za-z]|$)/gi, "$1高")
	data = data.replace(/(^|[^A-Za-z])(RE*?Q)(?=[^A-Za-z]|$)/gi, "$1属性需求")

	data = data.replace(/(^|[^A-Za-z])(THANK YOU|TY|THX|THANK U|THK U|THANKS*?|APP*?PRECIATE IT|AP*?PRECIATED)(?=[^A-Za-z]|$)/gi, "$1谢谢")
	data = data.replace(/(^|[^A-Za-z])(YOURS|YOUR)(?=[^A-Za-z]|$)/gi, "$1你的")
	data = data.replace(/(^|[^A-Za-z])(MINE|MY)(?=[^A-Za-z]|$)/gi, "$1我的")
	data = data.replace(/(^|[^A-Za-z])(YOU)(?=[^A-Za-z]|$)/gi, "$1你")
	//data=data.replace(/(^|[^A-Za-z])(ME)(?=[^A-Za-z]|$)/gi, '$1我');

	data = data.replace(/(^|[^A-Za-z])(PERFECTL*?Y*?|PERF)(?=[^A-Za-z]|$)/gi, "$1完美")
	data = data.replace(/(^|[^A-Za-z])(OS|OLDS*?CHOO*?L|OLD SCHOO*?L|OLD SKO*?OL|OLDSKO*?OL)(?=[^A-Za-z]|$)/gi, "$1原版(不可铸)")
	data = data.replace(/(^|[^A-Za-z])(EL*?ITE*?S*?|LEETS*?|13373*?|ELTE)(?=[^A-Za-z]|$)/gi, "$1精英")
	data = data.replace(/(^|[^A-Za-z])(TT*?OMES|TOMN*?ES*?|BOOKS*?|TOMS*?|TOEMS*?)(?=[^A-Za-z]|$)/gi, "$1书")

	data = data.replace(/(^|[^A-Za-z])(SKINS|SKIN)(?=[^A-Za-z]|$)/gi, "$1外观")
	data = data.replace(/(^|[^A-Za-z])(STO*?RO*?M)(?=[^A-Za-z]|$)/gi, "$1暴风")
	data = data.replace(/(^|[^A-Za-z])(SPAMMABLE)(?=[^A-Za-z]|$)/gi, "$1可连续点击的")
	data = data.replace(/(^|[^A-Za-z])(VARIOUS)(?=[^A-Za-z]|$)/gi, "$1各种")
	data = data.replace(/(^|[^A-Za-z])(COMBO)(?=[^A-Za-z]|$)/gi, "$1组合")
	data = data.replace(/(^|[^A-Za-z])(TOTAL)(?=[^A-Za-z]|$)/gi, "$1总共")

	//4. 材料
	data = data.replace(/(^|[^A-Za-z])(AMBER CHUNC*?KS*?|AMBERS*?)(?=[^A-Za-z]|$)/gi, "$1琥珀")
	data = data.replace(/(^|[^A-Za-z])(BOLTS*? OF CLOTH|CLOTH)(?=[^A-Za-z]|$)/gi, "$1布料")
	data = data.replace(/(^|[^A-Za-z])(BOLTS*? OF DAMASK|DAMASK)(?=[^A-Za-z]|$)/gi, "$1缎布")
	data = data.replace(/(^|[^A-Za-z])(BOLTS*? OF LINEN|LINEN)(?=[^A-Za-z]|$)/gi, "$1亚麻布")
	data = data.replace(/(^|[^A-Za-z])(BOLTS*? OF SILK|SILK)(?=[^A-Za-z]|$)/gi, "$1丝绸")
	data = data.replace(/(^|[^A-Za-z])(SAURIAN BONEE*?S*?)(?=[^A-Za-z]|$)/gi, "$1蜥蜴骨")

	data = data.replace(/(^|[^A-Za-z])(CHITIN FRAGMENTS*?|CHITINS*?)(?=[^A-Za-z]|$)/gi, "$1外壳")
	data = data.replace(/(^|[^A-Za-z])(DELDRIMORE*? STEEL IN*?GN*?OTS*?|DELDRIMORE*? STEEL|DELDr*?i*? STEEL)(?=[^A-Za-z]|$)/gi, "$1戴尔狄摩钢铁矿石")
	//金刚钻石已移下
	data = data.replace(/(^|[^A-Za-z])(ELONI*?AN*? LEATHERS*(?: S*?QUARES*?)?|E-*?LEATHE*?R*?S*?(?: SQUARES*?)?)(?=[^A-Za-z]|$)/gi, "$1伊洛那皮革")
	data = data.replace(/(^|[^A-Za-z])(FEATHERS*?|FEATHERS*? STACKS*?|STACKS*? OF FEATHERS*?)(?=[^A-Za-z]|$)/gi, "$1羽毛")
	data = data.replace(/(^|[^A-Za-z])(FUR SQUARES*?|FURS*?)(?=[^A-Za-z]|$)/gi, "$1毛皮")
	data = data.replace(/(^|[^A-Za-z])((?:GLOBE*?S*? OF )?\s*?ECTOPLASMS*?|ECTOP*?S*?|ECTOE*?S*?)(?=[^A-Za-z]|$)/gi, "$1玉") //心灵之玉

	//花岗岩石板，铁，骨头 :: 放置最后
	data = data.replace(/(^|[^A-Za-z])(JADEITE SC*?HARD*?S*?)(?=[^A-Za-z]|$)/gi, "$1硬玉")
	data = data.replace(/(^|[^A-Za-z])(LEATHER S*?QUARES*?|LEATHER*?|LEATH)(?=[^A-Za-z]|$)/gi, "$1皮革")
	data = data.replace(/(^|[^A-Za-z])(LUMPS*? OF CHARCOALS*?|CHARCOALS*?)(?=[^A-Za-z]|$)/gi, "$1结块的木炭")
	data = data.replace(/(^|[^A-Za-z])(MONS*?TE*?ROUS CLAWS*?)(?=[^A-Za-z]|$)/gi, "$1巨大的爪")
	data = data.replace(/(^|[^A-Za-z])(MONS*?TE*?ROUS EYES*?)(?=[^A-Za-z]|$)/gi, "$1巨大的眼")
	data = data.replace(/(^|[^A-Za-z])(MONS*?TE*?ROUS FANGS*?)(?=[^A-Za-z]|$)/gi, "$1巨大尖牙")
	data = data.replace(/(^|[^A-Za-z])(OS*?BS*?IDIANN*?E*? EDGES*?|OS*?BS*?IDIAN EDGE|OBBY EDGE|OBBY EDGE|OBBSI EDGE|OBBSID EDGE|OBBSI EDGE|OBSI EDGE|OBSI EDGES*?|OBI*?Y*?S*? EDGES*?)(?=[^A-Za-z]|$)/gi, "$1黑曜石边刃")
	data = data.replace(/(^|[^A-Za-z])(OS*?BS*?IDIANN*?E*? SC*?HARD*?S*?|OBBSID SC*?HAR*?DS*?|OBB*?S*?I*?Y*?S*?\s*?SC*?HAR*?DS*?)(?=[^A-Za-z]|$)/gi, "$1黑曜石碎片")
	data = data.replace(/(^|[^A-Za-z])(ONYX(?: GEMSTONES*?)*?)(?=[^A-Za-z]|$)/gi, "$1玛瑙宝石")
	data = data.replace(/(^|[^A-Za-z])((?:PILES*? OF )*?(?:GLITT*?ERING*? )*?DUSTS*?|DUSTS*?|(?:GLITT*?ERING*? )*?DUSTS*?)(?=[^A-Za-z]|$)/gi, "$1闪烁之土")
	data = data.replace(/(^|[^A-Za-z])((?:PLAN*?T )*?FIBE*?RE*?S*?)(?=[^A-Za-z]|$)/gi, "$1植物纤维")
	data = data.replace(/(^|[^A-Za-z])(ROLLS*? OF PARCHMENT|ROLLS OF PARCHMENT|PARCHMENTS*?|PARCH)(?=[^A-Za-z]|$)/gi, "$1羊皮纸卷")
	data = data.replace(/(^|[^A-Za-z])(ROLLS*? OF VELLUM|VELLUM)(?=[^A-Za-z]|$)/gi, "$1牛皮纸卷")
	data = data.replace(/(^|[^A-Za-z])(RUBYS*?|RUBB*?IS*?|RUBB*?IES*?)(?=[^A-Za-z]|$)/gi, "$1红宝石")
	data = data.replace(/(^|[^A-Za-z])(SAPPHIRES*?|SAPHIRES*?)(?=[^A-Za-z]|$)/gi, "$1蓝宝石")
	data = data.replace(/(^|[^A-Za-z])(SCALES)(?=[^A-Za-z]|$)/gi, "$1鳞片")
	data = data.replace(/(^|[^A-Za-z])(SPIRITWOOD PLANKS*?)(?=[^A-Za-z]|$)/gi, "$1心灵之板")
	data = data.replace(/(^|[^A-Za-z])(STEEL IN*?GN*?OTS*?|STEEL)(?=[^A-Za-z]|$)/gi, "$1钢铁矿石")
	data = data.replace(/(^|[^A-Za-z])(TANN*?ED HIDES*?(?: SQUARES*?)?|TANNED IHDE|tan hide squares*?)(?=[^A-Za-z]|$)/gi, "$1褐色兽皮")
	data = data.replace(/(^|[^A-Za-z])(TANN*?ED)(?=[^A-Za-z]|$)/gi, "$1(兽皮)褐色")
	data = data.replace(/(^|[^A-Za-z])(TEMPERED GLASS VIALS*?)(?=[^A-Za-z]|$)/gi, "$1调和后的玻璃瓶")
	data = data.replace(/(^|[^A-Za-z])(WOOD PLANKS*?|WOODS*?)(?=[^A-Za-z]|$)/gi, "$1木材")
	data = data.replace(/(^|[^A-Za-z])(VIALS*? OF INKS*?|INKS*?)(?=[^A-Za-z]|$)/gi, "$1小瓶墨水")

	//5. 补品+节日品+消耗品
	data = data.replace(/(^|[^A-Za-z])(P\.*?\s*?CONS*?)(?=[^A-Za-z]|$)/gi, "$1补品")
	data = data.replace(/(^|[^A-Za-z])(CONSUMABLE SETS*?|CON*?R*?S*?\s*?SETS*?|CONSUMMABLE SETS*?|CONS*?|CONS*?ES*?TS*?)(?=[^A-Za-z]|$)/gi, "$1药(防具+圣杯+精华)")
	data = data.replace(/(^|[^A-Za-z])(BU'S)(?=[^A-Za-z]|$)/gi, "$1精华")
	//精华已移下
	data = data.replace(/(^|[^A-Za-z])(GRAILS*? OF MIGHT|GRAILS*?)(?=[^A-Za-z]|$)/gi, "$1圣杯")
	data = data.replace(/(^|[^A-Za-z])(ARO*?MORS*? OF SALVATION)(?=[^A-Za-z]|$)/gi, "$1防具")
	//彩糖等已移下
	data = data.replace(/(^|[^A-Za-z])(ALCOL*?HOL|ALC|ALK|DRUNK|DRUNKARD|DRINKS*?|BOOZE)(?=[^A-Za-z]|$)/gi, "$1酒")

	data = data.replace(/(^|[^A-Za-z])(CUPCAKE STACKS*?|CUP\s*?C*?AC*?KES*?|STACKS*? OF CUPCAKES*?|BR*?IR*?THDAY CUPCAKES*?|BDAY CUPCAKES*?|B-DAY CUPCAKES*?|B DAY CUPCAKES*?|CUPPY*?I*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1生日蛋糕")
	data = data.replace(/(^|[^A-Za-z])(APPL*?EL*?S*?|CANDY APPLE|CANDY APPLES)(?=[^A-Za-z]|$)/gi, "$1苹果")
	data = data.replace(/(^|[^A-Za-z])(CANDY CORNS|CANDY CORN|CORNS|CORN|CORB)(?=[^A-Za-z]|$)/gi, "$1粟米糖")

	data = data.replace(/(^|[^A-Za-z])(SPIKED\s*?EGG\s*?N*?ON*?GS*?|SPIKED NOGS*?)(?=[^A-Za-z]|$)/gi, "$1强效蛋酒")
	data = data.replace(/(^|[^A-Za-z])(GOLDEN EGGS*?|EGGS*?|goldene ggs*?|GOLD\s*?EGGS*?)(?=[^A-Za-z]|$)/gi, "$1金蛋")

	data = data.replace(/(^|[^A-Za-z])(DRAKE\s*?(?:K.*?B.*?BS*?)+?|KEBABS*?|KEBAPS*?|KABOBS*?|KEBOBS*?|KABABS*?)(?=[^A-Za-z]|$)/gi, "$1烤龙兽肉")
	data = data.replace(/(^|[^A-Za-z])(WARR*?S*? SUPPLYS*?|WARR*?S*? SUPP*?\.*?S*?|WARR*?S*? SUR*?P*?PLI*?ES*?|WARR*?S*?SUPP*?LY*?I*?E*?S*?|WARR*?S*?\s*?SUPP*?)(?=[^A-Za-z]|$)/gi, "$1战承物资")
	data = data.replace(/(^|[^A-Za-z])(LUNAR*?S*? TOC*?KK*?C*?ENS*?|lunars*?Toc*?ke*?n*?e*?s*?|coupons*?\s*?lunaires*?|LUNAR*?S*? T|L\.\s*?TOC*?KK*?C*?ENS*?|LUNAR*?S*? TOKI*?N*?S*?|LUNAR*?S*? TOENS*?)(?=[^A-Za-z]|$)/gi, "$1农历年代币")
	data = data.replace(/(^|[^A-Za-z])(LUNAR*?S*? STACKS*?|LUNAR*?S*? FOR*?TUNR*?E*?S*?|LUNARS*?|L\.\s*?FOR*?TUNR*?E*?S*?|Lunar*?S*? Forts*?)(?=[^A-Za-z]|$)/gi, "$1锦囊")
	data = data.replace(/(^|[^A-Za-z])(REZZ*?\s*?SCROLLS*?|rez*?z*?s*?s*? crolls*?|RESS*?\s*?SCROLLS*?|REZZ*?|RESS*?|RESS*?CROLLS*?|SREZ|RESURRECTION SCROLLS*?)(?=[^A-Za-z]|$)/gi, "$1复活卷")
	data = data.replace(/(^|[^A-Za-z])(SK*?C*?ALE*?\s*?FINS*? SOUPS*?)(?=[^A-Za-z]|$)/gi, "$1鳞怪鳍汤")
	data = data.replace(/(^|[^A-Za-z])(SK*?C*?ALE\s*?FINS*?)(?=[^A-Za-z]|$)/gi, "$1鳞怪鳍")
	data = data.replace(/(^|[^A-Za-z])(HONEYCOMB STACKS|HONEYCOMB STACK|HONEYCOMBS|HONEYCOMB|HONEY COMBS|HONEY COMB)(?=[^A-Za-z]|$)/gi, "$1蜂巢")
	data = data.replace(/(^|[^A-Za-z])(PARTY BE*?ACONS*?|P\s*?\.*?\-*?\s*?BEA*?CONS*?)(?=[^A-Za-z]|$)/gi, "$1狂欢灯(50分)")
	data = data.replace(/(^|[^A-Za-z])(BATT*?LE\s*?ISLE*?A*N*D*S*\s*?ICED*?\s*?TEAS*?|BATTLE TEAS*?)(?=[^A-Za-z]|$)/gi, "$1战岛冰茶酒(50分)")
	data = data.replace(/(^|[^A-Za-z])(DELIS*?CII?OUS CAKES*?|DEL CAKES*?)(?=[^A-Za-z]|$)/gi, "$1可口蛋糕(50分)")
	data = data.replace(/(^|[^A-Za-z])(PART*?YT*?S*?(?: ANIMAL)*?)(?=[^A-Za-z]|$)/gi, "$1狂欢")
	data = data.replace(/(^|[^A-Za-z])(SWEETS*?(?: TOOTHS*?)*?)(?=[^A-Za-z]|$)/gi, "$1甜点")
	data = data.replace(/(^|[^A-Za-z])(BUNNY*?S*?|BUNNIES*?|CHOCOLATE*? BUNNIES*?|CHOCOLATE*? BUNNY*?S*?|CHOCO*? BUNNIES*?|CHOC\.*? BUNNYS*?|CHOC BUNNIES)(?=[^A-Za-z]|$)/gi, "$1巧克力兔")

	data = data.replace(/(^|[^A-Za-z])(CANDY\s*?CANE\s*?SHARDS*?|CC\s*?SHARDS*?)(?=[^A-Za-z]|$)/gi, "$1拐子糖碎片")
	data = data.replace(/(^|[^A-Za-z])(W(?:INTER)*?G(?:REEN)*?\s*?CANDY*?I*?E*?S*?(\s*?CANES*?)?|W(?:INTER)*?G(?:REEN)*?\s*?CC(?:\s*?SHARDS*?)?|WINTER\s*?(?:GREEN)?\s*?CANDY*?I*?E*?S*?(\s*?CANES*?)?)(?=[^A-Za-z]|$)/gi, "$1绿圣诞拐子糖(去15%角色死亡惩罚)")
	data = data.replace(/(^|[^A-Za-z])(RAINB*?N*?OW\s*?CANDY(?:\s*?CANES*?)?|RAINBOW\s*?CC(?:\s*?SHARDS*?)?)(?=[^A-Za-z]|$)/gi, "$1彩虹拐子糖(全队+5%士气)")
	data = data.replace(/(^|[^A-Za-z])(PEPPER(?:MINT)?\s*?CANDY(?:\s*?CANES*?)?|PEPPERMINT\s*?CC(?:\s*?SHARDS*?)?|PEP*?PER\s*?MINT)(?=[^A-Za-z]|$)/gi, "$1红薄荷拐子糖(消角色死亡惩罚)")
	data = data.replace(/(^|[^A-Za-z])((?:SLICES*?)*?(?: OF )*?(?:PUMPKIN )*?PIES*?|PUMP PIES*?)(?=[^A-Za-z]|$)/gi, "$1南瓜派")
	data = data.replace(/(^|[^A-Za-z])(PUMP*?KIN*?M*? COO*?KIES*?R*?)(?=[^A-Za-z]|$)/gi, "$1南瓜饼")
	data = data.replace(/(^|[^A-Za-z])(FRUIT\s*?CA*?KE*?S*?)(?=[^A-Za-z]|$)/gi, "$1水果蛋糕")
	data = data.replace(/(^|[^A-Za-z])((?:Four-*?\s*?Leaf )*?CloverS*?|4\-*?\s*?leaf Clovers*?)(?=[^A-Za-z]|$)/gi, "$1幸运草")
	data = data.replace(/(^|[^A-Za-z])(Power*?stones*? of Courage|P-*?\s*?STONES*?|POWER*?\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1勇气粉石")
	data = data.replace(/(^|[^A-Za-z])((?:Champagne )?Poppers*?)(?=[^A-Za-z]|$)/gi, "$1缤纷拉炮")
	data = data.replace(/(^|[^A-Za-z])(Snowman Summ*?oner*?s*?|SNOWMAN SUMM*\.*|snowman spawners*?)(?=[^A-Za-z]|$)/gi, "$1雪人召唤帽(狂欢分)")
	data = data.replace(/(^|[^A-Za-z])(Sparklers*?)(?=[^A-Za-z]|$)/gi, "$1仙女棒")
	data = data.replace(/(^|[^A-Za-z])((?:Bottled*? )?Ro*?c*?ke*?ts*?)(?=[^A-Za-z]|$)/gi, "$1冲天炮")
	data = data.replace(/(^|[^A-Za-z])(CRE*?ATES*? (?:OF )*?FIRE*?WORKS*?|CRATES*?)(?=[^A-Za-z]|$)/gi, "$1烟火箱子")
	data = data.replace(/(^|[^A-Za-z])(Ghosts*?-*?\s*?in-*?\s*?the-*?\s*?Boxe*?s*?)(?=[^A-Za-z]|$)/gi, "$1盒中魂")
	data = data.replace(/(^|[^A-Za-z])(Ghosts*?-*?\s*?in-*?\s*?a-*?\s*?Boxe*?s*?)(?=[^A-Za-z]|$)/gi, "$1盒中魂")
	data = data.replace(/(^|[^A-Za-z])(TRICKS*?-*?\s*?OR-*?\s*?TREATS*? BAGS*?|TOT'*?S*?(?: BAGS*?)?)(?=[^A-Za-z]|$)/gi, "$1万圣节礼品袋")
	data = data.replace(/(^|[^A-Za-z])(Squash Serumn*?s*?)(?=[^A-Za-z]|$)/gi, "$1狂欢南瓜头")

	data = data.replace(/(^|[^A-Za-z])(R?G?B?\/R?G?B?\/R?G?B? ROCKS*?)(?=[^A-Za-z]|$)/gi, "$1红/蓝/绿 糖")
	data = data.replace(/(^|[^A-Za-z])(RED ROCK CANDIE*?S*?)(?=[^A-Za-z]|$)/gi, "$1红糖")
	data = data.replace(/(^|[^A-Za-z])(RED\s*?ROCKS*?\s*?CANDYS*?|RED ROCKS*?\s*?CANDIE*?S?|RED\s*?ROCKS*?|RED CANDYS*?|RED CANDIE*?S*?)(?=[^A-Za-z]|$)/gi, "$1红糖")
	data = data.replace(/(^|[^A-Za-z])(BLUE\s*?ROCKS*?\s*?CANDYS*?|BLUE\s*?ROCKS*?\s*?CANDIES*?|BLUE*?\s*?ROCKS*?|BLUE CANDYS*?|BLUE CANDIES*?)(?=[^A-Za-z]|$)/gi, "$1蓝糖")
	data = data.replace(/(^|[^A-Za-z])(GREEN\s*?ROCKS*?\s*?CANDYS*?|GREEN\s*?ROCKS*?\s*?CANDIES*?|GREEN\s*?ROCKS*?|GREEN CANDYS*?|GREEN CANDIES*?)(?=[^A-Za-z]|$)/gi, "$1绿糖")
	data = data.replace(/(^|[^A-Za-z])(RA*?I*?NBOWS*? ROCK CANDY*?I*?E*?S*?|RA*?I*?NBOWS*?\s*?ROCKS*?|RA*?I*?NBOWS*?\s*?CANDIES*?)(?=[^A-Za-z]|$)/gi, "$1各色糖")
	data = data.replace(/(^|[^A-Za-z])(ROCK\s*?CANDYS*?|ROCK\s*?CANDIES)(?=[^A-Za-z]|$)/gi, "$1各色糖")

	//强效蛋酒移上
	data = data.replace(/(^|[^A-Za-z])(KE*?R*?GS*? (?:OF (?:AGED )?(?:HUNTER'*?S*? )?ALE)?)(?=[^A-Za-z]|$)/gi, "$1(酒)桶(150分)")
	data = data.replace(/(^|[^A-Za-z])(((?:AGED )?(?:HUNTER'*?S*? )?ALE )?KEGS*?)(?=[^A-Za-z]|$)/gi, "$1(酒)桶(150分)")
	data = data.replace(/(^|[^A-Za-z])(EGGN*?ON*?GS*?)(?=[^A-Za-z]|$)/gi, "$1蛋酒")
	data = data.replace(/(^|[^A-Za-z])(AGED DWARVEN ALES*?)(?=[^A-Za-z]|$)/gi, "$1陈年矮人酒")
	data = data.replace(/(^|[^A-Za-z])(AGED HUNTER'*?S*? ALES*?)(?=[^A-Za-z]|$)/gi, "$1陈年猎人酒")
	data = data.replace(/(^|[^A-Za-z])(DWARVEN ALES*?)(?=[^A-Za-z]|$)/gi, "$1矮人酒")
	data = data.replace(/(^|[^A-Za-z])(HUNTER'*?S*? ALES*?)(?=[^A-Za-z]|$)/gi, "$1猎人酒")

	data = data.replace(/(^|[^A-Za-z])((?:BOTTLES*? OF )*?GROGS*?)(?=[^A-Za-z]|$)/gi, "$1海盗酒")
	data = data.replace(/(^|[^A-Za-z])(KRYTAN BRANDYS*?)(?=[^A-Za-z]|$)/gi, "$1科瑞塔酒(3分)")
	data = data.replace(/(^|[^A-Za-z])(SHAMROCK ALES*?)(?=[^A-Za-z]|$)/gi, "$1幸运草酒")
	data = data.replace(/(^|[^A-Za-z])(WITCH'*?E*?S*?'*? BREWS*?)(?=[^A-Za-z]|$)/gi, "$1巫师酒")
	data = data.replace(/(^|[^A-Za-z])((?:VIALS*? )?(?:OF )?ABSINTHE*?)(?=[^A-Za-z]|$)/gi, "$1万圣节绿酒")

	//6. 职业
	data = data.replace(/(^|[^A-Za-z])(WARRR*?IORS*?|WARRS*?)(?=[^A-Za-z]|$)/gi, "$1战士")
	data = data.replace(/(^|[^A-Za-z])(RANG(?:ER)*?)(?=[^A-Za-z]|$)/gi, "$1游侠")
	data = data.replace(/(^|[^A-Za-z])(MONKS*?)(?=[^A-Za-z]|$)/gi, "$1僧")
	data = data.replace(/(^|[^A-Za-z])(NECROMANCERS*?|NECRO|NEC|NEKRO)(?=[^A-Za-z]|$)/gi, "$1死灵")
	data = data.replace(/(^|[^A-Za-z])(MESM*?ERS*?|MES|MEZ)(?=[^A-Za-z]|$)/gi, "$1幻术")
	data = data.replace(/(^|[^A-Za-z])(ELEMENTALISTS*?|ELEMENTALIST|ELE)(?=[^A-Za-z]|$)/gi, "$1元素")
	data = data.replace(/(^|[^A-Za-z])(ASS*?ASS*?INS*?|ASSAS*?|SINS*?|ASSASIANS*?)(?=[^A-Za-z]|$)/gi, "$1暗杀")
	data = data.replace(/(^|[^A-Za-z])(RITUALISTS*?|RITUALIST|RITU|RIT|RT)(?=[^A-Za-z]|$)/gi, "$1祭祀")
	data = data.replace(/(^|[^A-Za-z])(PARAN*?GONG*?S*?|PARA)(?=[^A-Za-z]|$)/gi, "$1圣言")
	data = data.replace(/(^|[^A-Za-z])(DER*?VISH|DERVS*?|DERWIS*?CHS*?)(?=[^A-Za-z]|$)/gi, "$1神唤")

	//7. 属性
	data = data.replace(/(^|[^A-Za-z])(FAST\s*?CASTING|FAST\s*?CAST|FC)(?=[^A-Za-z]|$)/gi, "$1快速施法")
	data = data.replace(/(^|[^A-Za-z])(ILLU(?:SION)?S*?)(?=[^A-Za-z]|$)/gi, "$1幻术魔法")
	data = data.replace(/(^|[^A-Za-z])(DOMINA*?TION|DOMIANTION|DOM|DOMI)(?=[^A-Za-z]|$)/gi, "$1支配魔法")
	data = data.replace(/(^|[^A-Za-z])(INSPIRATION|INSPI|INSP)(?=[^A-Za-z]|$)/gi, "$1灵感魔法")

	data = data.replace(/(^|[^A-Za-z])(BLOOD\s*?MAGIC|BLOOD)(?=[^A-Za-z]|$)/gi, "$1血魔法")
	data = data.replace(/(^|[^A-Za-z])(DEATH\s*?MAGIC|DEATH)(?=[^A-Za-z]|$)/gi, "$1死亡魔法")
	data = data.replace(/(^|[^A-Za-z])(SOULD*?\s*?REAPI*?N*?G*?|SOUL|SR)(?=[^A-Za-z]|$)/gi, "$1灵魂吸取")
	data = data.replace(/(^|[^A-Za-z])(CUR*?SES*?)(?=[^A-Za-z]|$)/gi, "$1诅咒")

	data = data.replace(/(^|[^A-Za-z])(AIR\s*?MAGIC|AIR)(?=[^A-Za-z]|$)/gi, "$1风系魔法")
	data = data.replace(/(^|[^A-Za-z])(EARTH\s*?MAGIC|EARTH)(?=[^A-Za-z]|$)/gi, "$1地系魔法")
	//水系火系魔法已移下
	data = data.replace(/(^|[^A-Za-z])(E-STOR*?E*?S*?|ES|ESTORE|ENE*?RGY\s*?STORAGE|E(?:NERGIES)*?TORAGE|ENERGIE\s*?STORAGE)(?=[^A-Za-z]|$)/gi, "$1能量储存")

	data = data.replace(/(^|[^A-Za-z])(HEALING\s*?PRAYERS*?|HEAL|HEALING*?)(?=[^A-Za-z]|$)/gi, "$1治疗")
	data = data.replace(/(^|[^A-Za-z])(SMITE CRAWLERS*?)(?=[^A-Za-z]|$)/gi, "$1幻影爬行者")
	data = data.replace(/(^|[^A-Za-z])(SMITE*?R*?S*?|SMI*?TT*?E*?ING PRAYERS*?|SMITT*?ING*?|Smithing)(?=[^A-Za-z]|$)/gi, "$1惩戒")
	data = data.replace(/(^|[^A-Za-z])(PROTECTION\s*?PRAYERS|PROTECTION|PROT)(?=[^A-Za-z]|$)/gi, "$1防护")
	data = data.replace(/(^|[^A-Za-z])(DIVI*?NE\s*?FAVOU*?RS*?|DIVI*?NE|DF)(?=[^A-Za-z]|$)/gi, "$1神恩") //Favou*?r

	data = data.replace(/(^|[^A-Za-z])(STR*?E*?NGT*?HT*?|STR|STREN|Strg|STRN)(?=[^A-Za-z]|$)/gi, "$1力量")
	data = data.replace(/(^|[^A-Za-z])(AXE\s*?MASTERY)(?=[^A-Za-z]|$)/gi, "$1斧术")
	data = data.replace(/(^|[^A-Za-z])(HAMMER\s*?MASTERY)(?=[^A-Za-z]|$)/gi, "$1锤术")
	data = data.replace(/(^|[^A-Za-z])(SWORDS*?MANSHIP)(?=[^A-Za-z]|$)/gi, "$1剑术")
	data = data.replace(/(^|[^A-Za-z])(TAC*?TICS*?|TACT*?|TACTIQUE|TAQTICS*?)(?=[^A-Za-z]|$)/gi, "$1战术")

	data = data.replace(/(^|[^A-Za-z])(BEAST\s*?MASTERY)(?=[^A-Za-z]|$)/gi, "$1野兽术")
	data = data.replace(/(^|[^A-Za-z])(EXPERTISE)(?=[^A-Za-z]|$)/gi, "$1专精")
	data = data.replace(/(^|[^A-Za-z])(WILDERNESS\s*?SURVIVAL)(?=[^A-Za-z]|$)/gi, "$1求生")
	data = data.replace(/(^|[^A-Za-z])(MARKSMANSHIP)(?=[^A-Za-z]|$)/gi, "$1弓术")

	data = data.replace(/(^|[^A-Za-z])(DAGGER\s*?MASTERY)(?=[^A-Za-z]|$)/gi, "$1匕首术")
	data = data.replace(/(^|[^A-Za-z])(DEADLY\s*?ARTS|DEADLY ART)(?=[^A-Za-z]|$)/gi, "$1暗杀技巧")
	data = data.replace(/(^|[^A-Za-z])(SHADOW\s*?ARTS|SHADOW ART)(?=[^A-Za-z]|$)/gi, "$1暗影技巧")
	data = data.replace(/(^|[^A-Za-z])(CRITICAL\s*?STRIKES)(?=[^A-Za-z]|$)/gi, "$1致命攻击")

	data = data.replace(/(^|[^A-Za-z])(COMMUN*?I*?N*?G*?S*?)(?=[^A-Za-z]|$)/gi, "$1神谕")
	data = data.replace(/(^|[^A-Za-z])(RESTORATION(?: MAGIC)*|RESTORE|RESTOR|RESTO)(?=[^A-Za-z]|$)/gi, "$1复原")
	data = data.replace(/(^|[^A-Za-z])(CHAN*?NELL*?ING*?(?: Magic)?|CHANN*?ELL*?|CHANN*?)(?=[^A-Za-z]|$)/gi, "$1导引")
	data = data.replace(/(^|[^A-Za-z])(SPAWNING\s*?POWER|SPAWNING|SPAWN)(?=[^A-Za-z]|$)/gi, "$1召唤")

	data = data.replace(/(^|[^A-Za-z])(SPEAR\s*?MASTERY)(?=[^A-Za-z]|$)/gi, "$1矛术")
	data = data.replace(/(^|[^A-Za-z])(COMMAND|COMM|CMD|Comnd)(?=[^A-Za-z]|$)/gi, "$1命令")
	data = data.replace(/(^|[^A-Za-z])(MOTIVATION|MOTI*?V*?)(?=[^A-Za-z]|$)/gi, "$1激励")
	data = data.replace(/(^|[^A-Za-z])(LEADERSHIP)(?=[^A-Za-z]|$)/gi, "$1领导")

	data = data.replace(/(^|[^A-Za-z])(SC*?Y*C*?TY*HES*?\s*?MASTERY)(?=[^A-Za-z]|$)/gi, "$1镰刀术")
	data = data.replace(/(^|[^A-Za-z])(WIND\s*?PRAYERS|WIND)(?=[^A-Za-z]|$)/gi, "$1风系祷告")
	data = data.replace(/(^|[^A-Za-z])(EARTH\s*?PRAYERS)(?=[^A-Za-z]|$)/gi, "$1地系祷告")
	data = data.replace(/(^|[^A-Za-z])(MYSTICISM)(?=[^A-Za-z]|$)/gi, "$1秘法")

	//7a. 地名，跑图
	data = data.replace(/(^|[^A-Za-z])(LFR)(?=[^A-Za-z]|$)/gi, "$1寻领跑人")
	data = data.replace(/(^|[^A-Za-z])(RUNN*?ERS*?|RUSHERS*?)(?=[^A-Za-z]|$)/gi, "$1领跑人")
	data = data.replace(/(^|[^A-Za-z])(CITYS*?|CITIES)(?=[^A-Za-z]|$)/gi, "$1城市")
	data = data.replace(/(^|[^A-Za-z])(RUNN*?ING*?)(?=[^A-Za-z]|$)/gi, "$1领跑")
	data = data.replace(/(^|[^A-Za-z])(TOURS|TOUR|TAXI)(?=[^A-Za-z]|$)/gi, "$1跑图")
	data = data.replace(/(^|[^A-Za-z])(FER*?RYS*?|FERR*?IES*?|FERR*?YING*?(?: PEOPLE)?)(?=[^A-Za-z]|$)/gi, "$1渡人")
	data = data.replace(/(^|[^A-Za-z])(NORMALS*?|NORM|REGUA*?LA*?R|REG)(?=[^A-Za-z]|$)/gi, "$1普通")
	data = data.replace(/(^|[^A-Za-z])(HARD|DIFFICULT)(?=[^A-Za-z]|$)/gi, "$1困难")
	data = data.replace(/(^|[^A-Za-z])(MODES|MODE)(?=[^A-Za-z]|$)/gi, "$1模式")

	data = data.replace(/(^|[^A-Za-z])(Bloodstone Fen)(?=[^A-Za-z]|$)/gi, "$1血石沼泽")
	data = data.replace(/(^|[^A-Za-z])(The Wilds)(?=[^A-Za-z]|$)/gi, "$1荒原")
	data = data.replace(/(^|[^A-Za-z])(Aurora Glade)(?=[^A-Za-z]|$)/gi, "$1欧若拉林地")
	data = data.replace(/(^|[^A-Za-z])(Gates of Kryta)(?=[^A-Za-z]|$)/gi, "$1科瑞塔关所")
	data = data.replace(/(^|[^A-Za-z])(D'*?Alessio Seaboard)(?=[^A-Za-z]|$)/gi, "$1达雷西海滨")
	data = data.replace(/(^|[^A-Za-z])(Divinity Coast)(?=[^A-Za-z]|$)/gi, "$1神圣海岸")
	data = data.replace(/(^|[^A-Za-z])(Sanctum Cay)(?=[^A-Za-z]|$)/gi, "$1神圣沙滩")
	data = data.replace(/(^|[^A-Za-z])(Drokn*?a*?r'*?s*? Forge)(?=[^A-Za-z]|$)/gi, "$1熔炉")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Frost Gate)(?=[^A-Za-z]|$)/gi, "$1寒霜之门")
	data = data.replace(/(^|[^A-Za-z])(Ice Caves*?(?: of Sorrow)?)(?=[^A-Za-z]|$)/gi, "$1悲伤冰谷")
	data = data.replace(/(^|[^A-Za-z])(Thunderhead Keep)(?=[^A-Za-z]|$)/gi, "$1雷云要塞")
	data = data.replace(/(^|[^A-Za-z])(Iron Mines*? of Moladune)(?=[^A-Za-z]|$)/gi, "$1莫拉登矿山")
	data = data.replace(/(^|[^A-Za-z])(Borlis Pass)(?=[^A-Za-z]|$)/gi, "$1柏里斯通道")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Great Northern Wall)(?=[^A-Za-z]|$)/gi, "$1北方长城")
	data = data.replace(/(^|[^A-Za-z])(Fort Ranic*?k)(?=[^A-Za-z]|$)/gi, "$1瑞尼克要塞")
	data = data.replace(/(^|[^A-Za-z])(Ruins of Surmia)(?=[^A-Za-z]|$)/gi, "$1蘇米亚废墟")
	data = data.replace(/(^|[^A-Za-z])(Nolani Academy)(?=[^A-Za-z]|$)/gi, "$1若拉尼学院")
	data = data.replace(/(^|[^A-Za-z])(Ember Light Camp)(?=[^A-Za-z]|$)/gi, "$1残火影地")
	data = data.replace(/(^|[^A-Za-z])(Grendich Courthouse)(?=[^A-Za-z]|$)/gi, "$1葛兰迪法院")
	data = data.replace(/(^|[^A-Za-z])(Augury Rock)(?=[^A-Za-z]|$)/gi, "$1占卜之石")
	data = data.replace(/(^|[^A-Za-z])(Sarde*?a*?lac Sani*?tari*?um)(?=[^A-Za-z]|$)/gi, "$1萨德拉克疗养院")
	data = data.replace(/(^|[^A-Za-z])(Piken Square)(?=[^A-Za-z]|$)/gi, "$1派肯广场")
	data = data.replace(/(^|[^A-Za-z])(Henge of Denravi)(?=[^A-Za-z]|$)/gi, "$1丹拉维圣地")
	data = data.replace(/(^|[^A-Za-z])(Senjis*? Corner)(?=[^A-Za-z]|$)/gi, "$1山吉之街")
	data = data.replace(/(^|[^A-Za-z])(Lion'*?s*? Arch)(?=[^A-Za-z]|$)/gi, "$1狮子拱门")
	data = data.replace(/(^|[^A-Za-z])(Bergen Hot Springs*?)(?=[^A-Za-z]|$)/gi, "$1卑而根温泉")
	data = data.replace(/(^|[^A-Za-z])(Riverside Province)(?=[^A-Za-z]|$)/gi, "$1河畔地带")
	data = data.replace(/(^|[^A-Za-z])(House zu Heltzer|HZH)(?=[^A-Za-z]|$)/gi, "$1凤荷议院")
	data = data.replace(/(^|[^A-Za-z])(Ascalon(?: City)?|asca)(?=[^A-Za-z]|$)/gi, "$1阿斯克隆城")
	data = data.replace(/(^|[^A-Za-z])(Tomb (?:of )?(?:the )?Primeva*?i*?l Kings*?)(?=[^A-Za-z]|$)/gi, "$1先王之墓")
	//data=data.replace(/(^|[^A-Za-z])(Ascalon Arena)(?=[^A-Za-z]|$)/gi, '$1竞技场/阿斯克隆');
	data = data.replace(/(^|[^A-Za-z])((?:The )?Amnoon Oasis)(?=[^A-Za-z]|$)/gi, "$1安奴绿洲")
	data = data.replace(/(^|[^A-Za-z])(Dunes*? of Despair)(?=[^A-Za-z]|$)/gi, "$1绝望沙丘")
	data = data.replace(/(^|[^A-Za-z])(Thirsty River)(?=[^A-Za-z]|$)/gi, "$1干枯河流")
	data = data.replace(/(^|[^A-Za-z])(Elona Reach)(?=[^A-Za-z]|$)/gi, "$1伊洛那流域")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Dragon'*?s*? Lair)(?=[^A-Za-z]|$)/gi, "$1龙穴")
	data = data.replace(/(^|[^A-Za-z])(Rings*? of Fire)(?=[^A-Za-z]|$)/gi, "$1火环群岛")
	data = data.replace(/(^|[^A-Za-z])(Abaddon'*?\"*?s*? Mouth)(?=[^A-Za-z]|$)/gi, "$1地狱隘口")
	data = data.replace(/(^|[^A-Za-z])(Hell'*?s*? Precipice)(?=[^A-Za-z]|$)/gi, "$1地狱悬崖")
	data = data.replace(/(^|[^A-Za-z])(Lutgardis*? Conservatory)(?=[^A-Za-z]|$)/gi, "$1路嘉帝斯温室")
	data = data.replace(/(^|[^A-Za-z])(Vasburg(?: Aro*?mory)?)(?=[^A-Za-z]|$)/gi, "$1维思柏兵营")
	data = data.replace(/(^|[^A-Za-z])(Serenity Temple)(?=[^A-Za-z]|$)/gi, "$1宁静神殿")
	data = data.replace(/(^|[^A-Za-z])(Ice Tooth Cave)(?=[^A-Za-z]|$)/gi, "$1冰牙洞穴")
	data = data.replace(/(^|[^A-Za-z])(Beacon'*?s*? Perch)(?=[^A-Za-z]|$)/gi, "$1比肯")
	//data=data.replace(/(^|[^A-Za-z])(Yak'*s*\s*(?:Bend)?)(?=[^A-Za-z]|$)/gi, '$1牦牛村');
	data = data.replace(/(^|[^A-Za-z])(Frontier Gate)(?=[^A-Za-z]|$)/gi, "$1边境关所")
	data = data.replace(/(^|[^A-Za-z])(Beetletun)(?=[^A-Za-z]|$)/gi, "$1甲虫镇")
	data = data.replace(/(^|[^A-Za-z])(Fishermens*? Haven)(?=[^A-Za-z]|$)/gi, "$1渔人避风港")
	data = data.replace(/(^|[^A-Za-z])(Temple of the Ages*?|TOA)(?=[^A-Za-z]|$)/gi, "$1世纪神殿")
	data = data.replace(/(^|[^A-Za-z])(Ventaris*? Refuge)(?=[^A-Za-z]|$)/gi, "$1凡特里避难所")
	data = data.replace(/(^|[^A-Za-z])(Druids*? Overlook)(?=[^A-Za-z]|$)/gi, "$1德鲁伊高地")
	data = data.replace(/(^|[^A-Za-z])(Maguuma Stade)(?=[^A-Za-z]|$)/gi, "$1梅古玛业林")
	data = data.replace(/(^|[^A-Za-z])(Quarrel Falls*?)(?=[^A-Za-z]|$)/gi, "$1怨言瀑布")
	data = data.replace(/(^|[^A-Za-z])(Heroe*?s*? Audience)(?=[^A-Za-z]|$)/gi, "$1英雄之痕")
	data = data.replace(/(^|[^A-Za-z])(Seekers*? Passage)(?=[^A-Za-z]|$)/gi, "$1探索者通道")
	data = data.replace(/(^|[^A-Za-z])(Destinys*? Gorge)(?=[^A-Za-z]|$)/gi, "$1命运峡谷")
	data = data.replace(/(^|[^A-Za-z])(Camp Rankor)(?=[^A-Za-z]|$)/gi, "$1蓝口营地")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Granite Citadel)(?=[^A-Za-z]|$)/gi, "$1花岗岩堡垒")
	data = data.replace(/(^|[^A-Za-z])(Marhan'*s*\s*(?:Grotto)?)(?=[^A-Za-z]|$)/gi, "$1马汉")
	data = data.replace(/(^|[^A-Za-z])(Ports*? Sledge)(?=[^A-Za-z]|$)/gi, "$1雪橇港")
	data = data.replace(/(^|[^A-Za-z])(Copper\s*?hammer(?: Mines)?)(?=[^A-Za-z]|$)/gi, "$1铜锤矿坑")
	//data=data.replace(/(^|[^A-Za-z])(Pre-Searing: The Barradin Estate)(?=[^A-Za-z]|$)/gi, '$1毁灭前: 巴拉丁领地');
	//data=data.replace(/(^|[^A-Za-z])(Pre-Searing: Ashford Abbey)(?=[^A-Za-z]|$)/gi, '$1毁灭前: 灰色浅滩');
	//data=data.replace(/(^|[^A-Za-z])(Pre-Searing: Foibles Fair)(?=[^A-Za-z]|$)/gi, '$1毁灭前: 佛伊伯市集');
	//data=data.replace(/(^|[^A-Za-z])(Pre-Searing: Fort Ranik)(?=[^A-Za-z]|$)/gi, '$1毁灭前: 瑞尼克要塞');
	//data=data.replace(/(^|[^A-Za-z])(Shiverpeak Arena)(?=[^A-Za-z]|$)/gi, '$1竞技场/Shiverpeak');
	//data=data.replace(/(^|[^A-Za-z])(Random Arenas)(?=[^A-Za-z]|$)/gi, '$1随机竞技场');
	//data=data.replace(/(^|[^A-Za-z])(Team Arenas)(?=[^A-Za-z]|$)/gi, '$1竞技场/Team');
	data = data.replace(/(^|[^A-Za-z])(Cavalon|CAVA)(?=[^A-Za-z]|$)/gi, "$1卡瓦隆")
	data = data.replace(/(^|[^A-Za-z])(Kaineng City)(?=[^A-Za-z]|$)/gi, "$1凯宁城")
	data = data.replace(/(^|[^A-Za-z])(Kaineng Center)(?=[^A-Za-z]|$)/gi, "$1凯宁中心")
	data = data.replace(/(^|[^A-Za-z])(Unwaking Waters*?)(?=[^A-Za-z]|$)/gi, "$1沉睡之水")
	data = data.replace(/(^|[^A-Za-z])(Deldrimor War Camp)(?=[^A-Za-z]|$)/gi, "$1戴而狄摩兵营")
	data = data.replace(/(^|[^A-Za-z])(Zen Daijun)(?=[^A-Za-z]|$)/gi, "$1祯台郡")
	data = data.replace(/(^|[^A-Za-z])(Minister Chos*? Estate)(?=[^A-Za-z]|$)/gi, "$1周大臣庄园")
	data = data.replace(/(^|[^A-Za-z])(Nahpui Quarter)(?=[^A-Za-z]|$)/gi, "$1纳普区")
	data = data.replace(/(^|[^A-Za-z])(Tahnnakai Temple)(?=[^A-Za-z]|$)/gi, "$1谭纳凯神殿")
	data = data.replace(/(^|[^A-Za-z])(Arborstone)(?=[^A-Za-z]|$)/gi, "$1亭石")
	data = data.replace(/(^|[^A-Za-z])(Boreas Seabed)(?=[^A-Za-z]|$)/gi, "$1风神海床")
	data = data.replace(/(^|[^A-Za-z])(Sunji*?ang*?\s*?Dist*?r*?i*?c*?t*?s*?)(?=[^A-Za-z]|$)/gi, "$1孙江行政区")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Eter*?nal Grove)(?=[^A-Za-z]|$)/gi, "$1永恒之林")
	data = data.replace(/(^|[^A-Za-z])(Ga*?ya*?las*?(?: Hatchery*?)?)(?=[^A-Za-z]|$)/gi, "$1盖拉孵化所")
	data = data.replace(/(^|[^A-Za-z])(Raisu Palace)(?=[^A-Za-z]|$)/gi, "$1莱苏皇宫")
	data = data.replace(/(^|[^A-Za-z])(Imperial\s*?Sanctum)(?=[^A-Za-z]|$)/gi, "$1帝国圣所")
	//data=data.replace(/(^|[^A-Za-z])(Unwaking Waters Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 沉睡之水 红');
	data = data.replace(/(^|[^A-Za-z])(Amatz*?s*? Basin)(?=[^A-Za-z]|$)/gi, "$1亚马兹盆地")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Aurios Mines*?)(?=[^A-Za-z]|$)/gi, "$1奥里欧斯矿坑")
	data = data.replace(/(^|[^A-Za-z])(Shing Jea Monastery)(?=[^A-Za-z]|$)/gi, "$1星岬寺")
	//data=data.replace(/(^|[^A-Za-z])(Shing Jea Arena)(?=[^A-Za-z]|$)/gi, '$1竞技场/星岬寺');
	data = data.replace(/(^|[^A-Za-z])(Great Temple of Bl*?al*?tha*?z*?a*?r*?s*?)(?=[^A-Za-z]|$)/gi, "$1巴萨泽圣殿")
	data = data.replace(/(^|[^A-Za-z])(Tsumei Village)(?=[^A-Za-z]|$)/gi, "$1蘇梅村")
	data = data.replace(/(^|[^A-Za-z])(Seitung Harbors*?)(?=[^A-Za-z]|$)/gi, "$1青函港")
	data = data.replace(/(^|[^A-Za-z])(Ran Musu(?: Gardens*?)?)(?=[^A-Za-z]|$)/gi, "$1岚穆蘇花园")
	//data=data.replace(/(^|[^A-Za-z])(Dwayna Vs Grenth)(?=[^A-Za-z]|$)/gi, '$1Dwayna Vs Grenth');
	data = data.replace(/(^|[^A-Za-z])(Urgoz'*?s*?(?: Warren)?)(?=[^A-Za-z]|$)/gi, "$1尔果")
	data = data.replace(/(^|[^A-Za-z])(Altrumm Ruins*?)(?=[^A-Za-z]|$)/gi, "$1奥楚蘭废墟")
	data = data.replace(/(^|[^A-Za-z])(Zos Shivros*?(?: Channel)?)(?=[^A-Za-z]|$)/gi, "$1佐席洛斯水道")
	data = data.replace(/(^|[^A-Za-z])(Dragon'*?s*? Throat)(?=[^A-Za-z]|$)/gi, "$1龙喉")
	data = data.replace(/(^|[^A-Za-z])(Harvest Temple)(?=[^A-Za-z]|$)/gi, "$1丰收神殿")
	data = data.replace(/(^|[^A-Za-z])(Breaker Hollow)(?=[^A-Za-z]|$)/gi, "$1断崖谷")
	data = data.replace(/(^|[^A-Za-z])(Leviatha*?o*?n\s*?Pits*?|LEVI\s*?\.*?PITS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森矿场")
	//data=data.replace(/(^|[^A-Za-z])(Zaishen Challenge)(?=[^A-Za-z]|$)/gi, '$1战承挑战');
	//data=data.replace(/(^|[^A-Za-z])(Zaishen Elite)(?=[^A-Za-z]|$)/gi, '$1战承精英');
	data = data.replace(/(^|[^A-Za-z])(Maatu'*?s*?(?: Keep)?)(?=[^A-Za-z]|$)/gi, "$1麻都堡垒")
	data = data.replace(/(^|[^A-Za-z])(Zin\s*?Ku(?: Corridor)?)(?=[^A-Za-z]|$)/gi, "$1辛库走廊")
	data = data.replace(/(^|[^A-Za-z])(Brauer Academy)(?=[^A-Za-z]|$)/gi, "$1巴而学院")
	data = data.replace(/(^|[^A-Za-z])(Durheim Archives*?)(?=[^A-Za-z]|$)/gi, "$1杜汉姆卷藏室")
	data = data.replace(/(^|[^A-Za-z])(Bai Paasu Reach)(?=[^A-Za-z]|$)/gi, "$1拜巴蘇区域")
	data = data.replace(/(^|[^A-Za-z])(Seafarer'*?s*? Rest)(?=[^A-Za-z]|$)/gi, "$1航海者休息处")
	data = data.replace(/(^|[^A-Za-z])(Vizuna*?ha*? (?:Square )?Local(?: Quarter)?)(?=[^A-Za-z]|$)/gi, "$1薇茹广场 本地")
	data = data.replace(/(^|[^A-Za-z])(Vizuna*?ha*? (?:Square )?Foreign(?: Quarter)?)(?=[^A-Za-z]|$)/gi, "$1薇茹广场 外地")
	data = data.replace(/(^|[^A-Za-z])(Vizuna*?ha*?\s*?(?:Square)?)(?=[^A-Za-z]|$)/gi, "$1薇茹广场")
	data = data.replace(/(^|[^A-Za-z])(Fort Aspenwood)(?=[^A-Za-z]|$)/gi, "$1杨木要塞")
	//data=data.replace(/(^|[^A-Za-z])(Fort Aspenwood - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 杨木要塞 - 红');
	//data=data.replace(/(^|[^A-Za-z])(Fort Aspenwood - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - 杨木要塞 - 蓝');
	data = data.replace(/(^|[^A-Za-z])((?:The )?Jade Quarry|JQ)(?=[^A-Za-z]|$)/gi, "$1翡翠矿场")
	//data=data.replace(/(^|[^A-Za-z])(The Jade Quarry - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 翡翠矿场 - 红');
	//data=data.replace(/(^|[^A-Za-z])(The Jade Quarry - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - 翡翠矿场 - 蓝');
	data = data.replace(/(^|[^A-Za-z])((?:The )?Marketplace)(?=[^A-Za-z]|$)/gi, "$1市集")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Deep)(?=[^A-Za-z]|$)/gi, "$1深渊")
	//data=data.replace(/(^|[^A-Za-z])(Saltspray Beach - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 盐滩 - 红');
	//data=data.replace(/(^|[^A-Za-z])(Saltspray Beach - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - 盐滩 - 蓝');
	//data=data.replace(/(^|[^A-Za-z])(Heroes Ascent)(?=[^A-Za-z]|$)/gi, '$1Heroes Ascent');
	//data=data.replace(/(^|[^A-Za-z])(Grenz Frontier - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 葛伦斯领域 - 红');
	//data=data.replace(/(^|[^A-Za-z])(Grenz Frontier - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - 葛伦斯领域 - 蓝');
	//data=data.replace(/(^|[^A-Za-z])(The Ancestral Lands - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 先人圣地 - 红');
	//data=data.replace(/(^|[^A-Za-z])(The Ancestral Lands - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - 先人圣地 - 蓝');
	//data=data.replace(/(^|[^A-Za-z])(Etnaran Keys - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - Etnaran Keys - 红');
	//data=data.replace(/(^|[^A-Za-z])(Etnaran Keys - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - Etnaran Keys - 蓝');
	//data=data.replace(/(^|[^A-Za-z])(Kaanai Canyon - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - Kaanai Canyon - 红');
	//data=data.replace(/(^|[^A-Za-z])(Kaanai Canyon - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - Kaanai Canyon - 蓝');
	data = data.replace(/(^|[^A-Za-z])(Tanglewood Copse)(?=[^A-Za-z]|$)/gi, "$1谭格塢树林")
	data = data.replace(/(^|[^A-Za-z])(Saint Anjeka'*?s*? Shrine)(?=[^A-Za-z]|$)/gi, "$1圣者安捷卡的祭坛")
	data = data.replace(/(^|[^A-Za-z])(Eredon Terrace)(?=[^A-Za-z]|$)/gi, "$1而雷登平地")
	//data=data.replace(/(^|[^A-Za-z])(Dragon Arena)(?=[^A-Za-z]|$)/gi, '$1竞技场/龙');
	data = data.replace(/(^|[^A-Za-z])(Camp Hojanu)(?=[^A-Za-z]|$)/gi, "$1何加努营地")
	data = data.replace(/(^|[^A-Za-z])(Wehhan(?: Terraces*?)?)(?=[^A-Za-z]|$)/gi, "$1薇恩平台")
	data = data.replace(/(^|[^A-Za-z])(Yohlon(?: Haven)?)(?=[^A-Za-z]|$)/gi, "$1犹朗避难所")
	data = data.replace(/(^|[^A-Za-z])(Sunspear Sanctuary)(?=[^A-Za-z]|$)/gi, "$1日戟避难所")
	data = data.replace(/(^|[^A-Za-z])(Aspenwood Gate)(?=[^A-Za-z]|$)/gi, "$1杨木大门")
	//data=data.replace(/(^|[^A-Za-z])(Aspenwood Gate - Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - 杨木大门 - 蓝');
	//data=data.replace(/(^|[^A-Za-z])(Aspenwood Gate - Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 杨木大门 - 红');
	data = data.replace(/(^|[^A-Za-z])(Jade Flats*?)(?=[^A-Za-z]|$)/gi, "$1翡翠浅滩")
	//data=data.replace(/(^|[^A-Za-z])(Jade Flats Kurzick)(?=[^A-Za-z]|$)/gi, '$1蓝 - 翡翠浅滩 - 蓝');
	//data=data.replace(/(^|[^A-Za-z])(Jade Flats Luxon)(?=[^A-Za-z]|$)/gi, '$1红 - 翡翠浅滩 - 红');
	data = data.replace(/(^|[^A-Za-z])(Chantry of Secrets*?)(?=[^A-Za-z]|$)/gi, "$1隐密教堂")
	data = data.replace(/(^|[^A-Za-z])(Mihanu Township)(?=[^A-Za-z]|$)/gi, "$1米哈努小镇")
	data = data.replace(/(^|[^A-Za-z])(Basalt Grotto)(?=[^A-Za-z]|$)/gi, "$1玄武岩石穴")
	data = data.replace(/(^|[^A-Za-z])(Honur Hill)(?=[^A-Za-z]|$)/gi, "$1霍奴而丘陵")
	data = data.replace(/(^|[^A-Za-z])(Yahnur Market)(?=[^A-Za-z]|$)/gi, "$1雅诺而市集")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Kodash(?: Bazaar)?)(?=[^A-Za-z]|$)/gi, "$1库丹西市集广场")
	data = data.replace(/(^|[^A-Za-z])(Venta Cemetery)(?=[^A-Za-z]|$)/gi, "$1凡特墓地")
	data = data.replace(/(^|[^A-Za-z])(Kodonur Crossroads)(?=[^A-Za-z]|$)/gi, "$1科登诺路口")
	data = data.replace(/(^|[^A-Za-z])(Rilohn Refuge)(?=[^A-Za-z]|$)/gi, "$1里欧恩难民营")
	data = data.replace(/(^|[^A-Za-z])(Pogahn Passage)(?=[^A-Za-z]|$)/gi, "$1波甘驿站")
	data = data.replace(/(^|[^A-Za-z])(Moddok Crevice)(?=[^A-Za-z]|$)/gi, "$1摩多克裂缝")
	data = data.replace(/(^|[^A-Za-z])(Tihark Orchard)(?=[^A-Za-z]|$)/gi, "$1提亚克林地")
	data = data.replace(/(^|[^A-Za-z])(Sunspear Great Hall)(?=[^A-Za-z]|$)/gi, "$1日戟大会堂")
	data = data.replace(/(^|[^A-Za-z])(Dzagonur Bastion)(?=[^A-Za-z]|$)/gi, "$1蕯岗诺堡")
	data = data.replace(/(^|[^A-Za-z])(Dasha Vestibule)(?=[^A-Za-z]|$)/gi, "$1达沙走廊")
	data = data.replace(/(^|[^A-Za-z])(Grand Court(?: o*?f*?\s*?Sebelkeh)?)(?=[^A-Za-z]|$)/gi, "$1希贝克大宫廷")
	data = data.replace(/(^|[^A-Za-z])(Bones*?\s*?Palaces*?)(?=[^A-Za-z]|$)/gi, "$1白骨宫殿")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Mouth of Torment)(?=[^A-Za-z]|$)/gi, "$1苦痛之地隘口")
	data = data.replace(/(^|[^A-Za-z])(Lair of (?:the )?Forgotten)(?=[^A-Za-z]|$)/gi, "$1被遗忘者的巢穴")
	data = data.replace(/(^|[^A-Za-z])(Kamadan)(?=[^A-Za-z]|$)/gi, "$1卡玛丹")
	data = data.replace(/(^|[^A-Za-z])(Gate of Torment)(?=[^A-Za-z]|$)/gi, "$1苦痛之门")
	data = data.replace(/(^|[^A-Za-z])(Beknur Harbor)(?=[^A-Za-z]|$)/gi, "$1别克诺港")
	//data=data.replace(/(^|[^A-Za-z])(Rollerbeetle Racing)(?=[^A-Za-z]|$)/gi, '$1Rollerbeetle Racing');
	data = data.replace(/(^|[^A-Za-z])(Gate of Fear)(?=[^A-Za-z]|$)/gi, "$1恐惧之门")
	data = data.replace(/(^|[^A-Za-z])(Gate of Secrets*?)(?=[^A-Za-z]|$)/gi, "$1奥秘之门")
	data = data.replace(/(^|[^A-Za-z])(Gate of Anguish)(?=[^A-Za-z]|$)/gi, "$1悲难之门")
	data = data.replace(/(^|[^A-Za-z])(Jennurs*? Horde)(?=[^A-Za-z]|$)/gi, "$1征纳群落")
	data = data.replace(/(^|[^A-Za-z])(Nundu Bay)(?=[^A-Za-z]|$)/gi, "$1纳度湾")
	data = data.replace(/(^|[^A-Za-z])(Gate of Desol*a*t*i*o*n*\.*)(?=[^A-Za-z]|$)/gi, "$1荒芜之地入口")
	data = data.replace(/(^|[^A-Za-z])(Champion'*?s*? Dawn)(?=[^A-Za-z]|$)/gi, "$1勇士曙光")
	data = data.replace(/(^|[^A-Za-z])(Ruins*? of Morah*?)(?=[^A-Za-z]|$)/gi, "$1莫拉废墟")
	data = data.replace(/(^|[^A-Za-z])(Kod*?lonu Hamlet)(?=[^A-Za-z]|$)/gi, "$1克拓怒-哈姆雷特")
	data = data.replace(/(^|[^A-Za-z])(Jokanur Diggings*?)(?=[^A-Za-z]|$)/gi, "$1卓坎诺挖掘点")
	data = data.replace(/(^|[^A-Za-z])(Blacktide Den)(?=[^A-Za-z]|$)/gi, "$1黑潮之穴")
	data = data.replace(/(^|[^A-Za-z])(Consu*?o*?late Docks*?)(?=[^A-Za-z]|$)/gi, "$1领事馆码头")
	data = data.replace(/(^|[^A-Za-z])(Gate of Pain)(?=[^A-Za-z]|$)/gi, "$1惩罚之门")
	data = data.replace(/(^|[^A-Za-z])(Gate of Madnesss*?)(?=[^A-Za-z]|$)/gi, "$1疯狂之门")
	data = data.replace(/(^|[^A-Za-z])(Abaddon\'*?\"*?s*? Gate)(?=[^A-Za-z]|$)/gi, "$1亚霸顿之门")
	data = data.replace(/(^|[^A-Za-z])(Sunspear Arena)(?=[^A-Za-z]|$)/gi, "$1竞技场/日戟")
	data = data.replace(/(^|[^A-Za-z])((?:The )?Astralarium)(?=[^A-Za-z]|$)/gi, "$1亚斯特拉利姆")
	data = data.replace(/(^|[^A-Za-z])(Chah*?bek Village)(?=[^A-Za-z]|$)/gi, "$1夏贝克村庄")
	data = data.replace(/(^|[^A-Za-z])(Remains*? of Sahlahja)(?=[^A-Za-z]|$)/gi, "$1萨拉加遗址")
	//data=data.replace(/(^|[^A-Za-z])(Hero Battles)(?=[^A-Za-z]|$)/gi, '$1Hero Battles');
	data = data.replace(/(^|[^A-Za-z])(Dajkah Inlet)(?=[^A-Za-z]|$)/gi, "$1达卡港")
	//data=data.replace(/(^|[^A-Za-z])(The Shadow Nexus)(?=[^A-Za-z]|$)/gi, '$1The Shadow Nexus');
	//data=data.replace(/(^|[^A-Za-z])(Gate of the Nightfallen Lands)(?=[^A-Za-z]|$)/gi, '$1Gate of the Nightfallen Lands');
	data = data.replace(/(^|[^A-Za-z])(Vlox*'*s*s*z*(?:\s*?Falls*?)?)(?=[^A-Za-z]|$)/gi, "$1瀑布") //or \s* before (?:falls
	data = data.replace(/(^|[^A-Za-z])(Gadd'*?s*? Encampment)(?=[^A-Za-z]|$)/gi, "$1盖得")
	data = data.replace(/(^|[^A-Za-z])(Umbral Grotto)(?=[^A-Za-z]|$)/gi, "$1阴影石穴")
	data = data.replace(/(^|[^A-Za-z])(Rata Sum)(?=[^A-Za-z]|$)/gi, "$1顶点")
	data = data.replace(/(^|[^A-Za-z])(Tarnished Haven)(?=[^A-Za-z]|$)/gi, "$1灰暗避难所")
	data = data.replace(/(^|[^A-Za-z])(Eye of the North)(?=[^A-Za-z]|$)/gi, "$1极地之眼")
	data = data.replace(/(^|[^A-Za-z])(Sifhalla)(?=[^A-Za-z]|$)/gi, "$1袭哈拉")
	data = data.replace(/(^|[^A-Za-z])(Gunnar'*?s*?(?: Holds*?)?)(?=[^A-Za-z]|$)/gi, "$1甘拿")
	data = data.replace(/(^|[^A-Za-z])(Olafs*?(?:tead)?)(?=[^A-Za-z]|$)/gi, "$1欧拉夫之地")
	data = data.replace(/(^|[^A-Za-z])(Doomlore Shrine)(?=[^A-Za-z]|$)/gi, "$1末日传说神殿")
	data = data.replace(/(^|[^A-Za-z])(Longeye'*?s*? Ledge)(?=[^A-Za-z]|$)/gi, "$1长眼")
	data = data.replace(/(^|[^A-Za-z])(Central (?:Transfer )?Chamber|CTC)(?=[^A-Za-z]|$)/gi, "$1中央转送室")
	data = data.replace(/(^|[^A-Za-z])(Boreal Station)(?=[^A-Za-z]|$)/gi, "$1北极驻地")
	//data=data.replace(/(^|[^A-Za-z])(Costume Brawl)(?=[^A-Za-z]|$)/gi, '$1Costume Brawl');
	data = data.replace(/(^|[^A-Za-z])((?:Zaishen )?Menagerie)(?=[^A-Za-z]|$)/gi, "$1战承动物园")
	//data=data.replace(/(^|[^A-Za-z])(Codex Arena)(?=[^A-Za-z]|$)/gi, '$1竞技场/Codex');
	//data=data.replace(/(^|[^A-Za-z])(Lions Arch - Halloween)(?=[^A-Za-z]|$)/gi, '$1狮城 - 万圣节');
	//data=data.replace(/(^|[^A-Za-z])(Lions Arch - Wintersday)(?=[^A-Za-z]|$)/gi, '$1狮城 - 冬日');
	//data=data.replace(/(^|[^A-Za-z])(Lions Arch - Canthan New Year)(?=[^A-Za-z]|$)/gi, '$1狮城 - 二章新年');
	//data=data.replace(/(^|[^A-Za-z])(Ascalon City - Wintersday)(?=[^A-Za-z]|$)/gi, '$1阿城 - 冬日');
	//data=data.replace(/(^|[^A-Za-z])(Droknars Forge - Halloween)(?=[^A-Za-z]|$)/gi, '$1熔炉 - 万圣节');
	//data=data.replace(/(^|[^A-Za-z])(Droknars Forge - Wintersday)(?=[^A-Za-z]|$)/gi, '$1熔炉 - 冬日');
	//data=data.replace(/(^|[^A-Za-z])(Tomb of the Primeval Kings - Halloween)(?=[^A-Za-z]|$)/gi, '$1先王之墓 - 万圣节');
	//data=data.replace(/(^|[^A-Za-z])(Shing Jea - Dragon Festival)(?=[^A-Za-z]|$)/gi, '$1星岬寺 - 龙节');
	//data=data.replace(/(^|[^A-Za-z])(Shing Jea - Canthan New Year)(?=[^A-Za-z]|$)/gi, '$1星岬寺 - 二章新年');
	//data=data.replace(/(^|[^A-Za-z])(Eye of the North - Wintersday)(?=[^A-Za-z]|$)/gi, '$1极地之眼 - 冬日');
	data = data.replace(/(^|[^A-Za-z])(Embark Beach|EB)(?=[^A-Za-z]|$)/gi, "$1登陆滩EB")

	data = data.replace(/(^|[^A-Za-z])(ASCALON|ASCOLON)(?=[^A-Za-z]|$)/gi, "$1阿斯科隆")
	data = data.replace(/(^|[^A-Za-z])(BEACONS|BEACON)(?=[^A-Za-z]|$)/gi, "$1比肯")
	data = data.replace(/(^|[^A-Za-z])(DROKNAR'*?S*? FOR*?R*?GES*?)(?=[^A-Za-z]|$)/gi, "$1卓克纳熔炉")
	data = data.replace(/(^|[^A-Za-z])(DROKNARS*?|DROKS*?)(?=[^A-Za-z]|$)/gi, "$1卓克纳")
	data = data.replace(/(^|[^A-Za-z])(PROPHECIES|PROPH|TYRIA)(?=[^A-Za-z]|$)/gi, "$1一章")
	data = data.replace(/(^|[^A-Za-z])(Luxon factionS*?)(?=[^A-Za-z]|$)/gi, "$1勒克森荣誉值")
	data = data.replace(/(^|[^A-Za-z])(Kurzicks*? factionS*?)(?=[^A-Za-z]|$)/gi, "$1库兹柯荣誉值")
	data = data.replace(/(^|[^A-Za-z])(BAL*?THA*?Z*?R*?A*?R*?D* factionS*?)(?=[^A-Za-z]|$)/gi, "$1巴萨泽荣誉值")
	data = data.replace(/(^|[^A-Za-z])(FACTIONS|FACTION|CANTHA)(?=[^A-Za-z]|$)/gi, "$1二章")
	//data=data.replace(/(^|[^A-Za-z])(CANTHA)(?=[^A-Za-z]|$)/gi, '$1凯珊');
	data = data.replace(/(^|[^A-Za-z])(NIGHTFALL|NF|ELONA)(?=[^A-Za-z]|$)/gi, "$1三章")
	//data=data.replace(/(^|[^A-Za-z])(ELONA)(?=[^A-Za-z]|$)/gi, '$1伊洛那');
	data = data.replace(/(^|[^A-Za-z])(EYE OF THE NOTH|EOTN)(?=[^A-Za-z]|$)/gi, "$1四章") //NOTH vs North
	data = data.replace(/(^|[^A-Za-z])(LIONS*? ARCH|LA|LION'*?S*? ARCH)(?=[^A-Za-z]|$)/gi, "$1狮子拱门")
	data = data.replace(/(^|[^A-Za-z])((?:CONSU*?O*?LATE )*?DOCKS*?)(?=[^A-Za-z]|$)/gi, "$1码头")
	data = data.replace(/(^|[^A-Za-z])(KC|KAINENG(?: CENTER)?)(?=[^A-Za-z]|$)/gi, "$1凯宁中心")

	data = data.replace(/(^|[^A-Za-z])(MAP PE*?IE*?CES*?|MAP PARTS*?)(?=[^A-Za-z]|$)/gi, "$1地图块")
	data = data.replace(/(^|[^A-Za-z])(TOP RIGHT|RIGHT TOP)(?=[^A-Za-z]|$)/gi, "$1右上角")
	data = data.replace(/(^|[^A-Za-z\/])(BOTT*O*M* RIGHT|BO*?T*?TM RIGHT|RIGHT BO*?T*?TO*?M)(?=[^A-Za-z]|$)/gi, "$1右下角")
	data = data.replace(/(^|[^A-Za-z])(TOP LEFT|LEFT TOP)(?=[^A-Za-z]|$)/gi, "$1左上角")
	data = data.replace(/(^|[^A-Za-z\/])(BOTT*O*M* LEFT|BO*?T*?TM LEFT|LEFT BO*?T*?TO*?M)(?=[^A-Za-z]|$)/gi, "$1左下角")

	//8. 颜色,染色
	data = data.replace(/(^|[^A-Za-z])(BLACK|BLCK)(?=[^A-Za-z]|$)/gi, "$1黑色")
	data = data.replace(/(^|[^A-Za-z])(WHITT*?E)(?=[^A-Za-z]|$)/gi, "$1白色")
	data = data.replace(/(^|[^A-Za-z])(WINTER\s*?GREENS*?|WG)(?=[^A-Za-z]|$)/gi, "$1绿拐子")
	data = data.replace(/(^|[^A-Za-z])(GREENS)(?=[^A-Za-z]|$)/gi, "$1绿物")
	data = data.replace(/(^|[^A-Za-z])(GREEN)(?=[^A-Za-z]|$)/gi, "$1绿色")
	data = data.replace(/(^|[^A-Za-z])(RED)(?=[^A-Za-z]|$)/gi, "$1红色")
	data = data.replace(/(^|[^A-Za-z])(BLUE)(?=[^A-Za-z]|$)/gi, "$1蓝色")
	data = data.replace(/(^|[^A-Za-z])(PURPLE*?|PURP|PUPLE)(?=[^A-Za-z]|$)/gi, "$1紫色")
	data = data.replace(/(^|[^A-Za-z])(ORANGE)(?=[^A-Za-z]|$)/gi, "$1橙色")
	data = data.replace(/(^|[^A-Za-z])(GREY)(?=[^A-Za-z]|$)/gi, "$1灰色")
	data = data.replace(/(^|[^A-Za-z])(GRAY)(?=[^A-Za-z]|$)/gi, "$1灰色")
	data = data.replace(/(^|[^A-Za-z])(BROWN)(?=[^A-Za-z]|$)/gi, "$1褐色")
	data = data.replace(/(^|[^A-Za-z])(GOLD|GLOD|GOLDEN)(?=[^A-Za-z]|$)/gi, "$1金")
	data = data.replace(/(^|[^A-Za-z])(SI*?LI*?VER)(?=[^A-Za-z]|$)/gi, "$1银")
	data = data.replace(/(^|[^A-Za-z])(COPPER)(?=[^A-Za-z]|$)/gi, "$1铜")
	data = data.replace(/(^|[^A-Za-z])(DYES*?|DYED*?)(?=[^A-Za-z]|$)/gi, "$1染")

	//9. 生肖+天神+罗盘
	data = data.replace(/(^|[^A-Za-z])(RATS*?)(?=[^A-Za-z]|$)/gi, "$1鼠")
	data = data.replace(/(^|[^A-Za-z])(OX|OXES)(?=[^A-Za-z]|$)/gi, "$1牛")
	data = data.replace(/(^|[^A-Za-z])(TIGERS*?)(?=[^A-Za-z]|$)/gi, "$1虎")
	data = data.replace(/(^|[^A-Za-z])(RABBITS*?|RABITS*?)(?=[^A-Za-z]|$)/gi, "$1兔")
	data = data.replace(/(^|[^A-Za-z])(DRAGONS*?)(?=[^A-Za-z]|$)/gi, "$1龙")
	data = data.replace(/(^|[^A-Za-z])(SNAKES*?)(?=[^A-Za-z]|$)/gi, "$1蛇")
	data = data.replace(/(^|[^A-Za-z])(HORSES*?)(?=[^A-Za-z]|$)/gi, "$1马")
	data = data.replace(/(^|[^A-Za-z])(SHEEPS*?)(?=[^A-Za-z]|$)/gi, "$1羊")
	data = data.replace(/(^|[^A-Za-z])(MONKE*?YS*?)(?=[^A-Za-z]|$)/gi, "$1猴")
	data = data.replace(/(^|[^A-Za-z])(ROOSTERS*?)(?=[^A-Za-z]|$)/gi, "$1鸡")
	data = data.replace(/(^|[^A-Za-z])(DOGS*?)(?=[^A-Za-z]|$)/gi, "$1狗")
	data = data.replace(/(^|[^A-Za-z])(PIGS*?)(?=[^A-Za-z]|$)/gi, "$1猪")

	//10. 变身+迷你
	data = data.replace(/(^|[^A-Za-z])(MINI*?A*?TURE PETS*?|MINI\s*?\-*?PETS*?|MINI*?A*?TURES*?|MINIS*?|PETS*?)(?=[^A-Za-z]|$)/gi, "$1迷你")
	data = data.replace(/(^|[^A-Za-z])(GWEN\-*?\.*?\s*?DOLLS*?)(?=[^A-Za-z]|$)/gi, "$1大头关")
	data = data.replace(/(^|[^A-Za-z])(GWEN)(?=[^A-Za-z]|$)/gi, "$1关")
	data = data.replace(/(^|[^A-Za-z])(BIRTHDAY PRESENTS*?|BDAY PRESENTS*?|B-DAY PRESENTS*?)(?=[^A-Za-z]|$)/gi, "$1生日礼物")
	data = data.replace(/(^|[^A-Za-z])(BIRTHDAY GIFTS*?|BDAY GIFTS*?|B-DAY GIFTS*?)(?=[^A-Za-z]|$)/gi, "$1生日礼物")
	data = data.replace(/(^|[^A-Za-z])(B-*?(?:IRTH)*?(?:DAY)*? PREZ)(?=[^A-Za-z]|$)/gi, "$1生日礼物")
	data = data.replace(/(^|[^A-Za-z])(PRESENTS*?|PRES|PREZ|PRESS*?IES*?)(?=[^A-Za-z]|$)/gi, "$1礼物")

	data = data.replace(/(^|[^A-Za-z])(MA*?O*?RGO(?:NITE*?S*?)*?|MARG)(?=[^A-Za-z]|$)/gi, "$1玛古奈")
	data = data.replace(/(^|[^A-Za-z])(Transmogrifi*?er|TRANSMOG*?S*?\.*?S*?)(?=[^A-Za-z]|$)/gi, "$1粟米人")
	data = data.replace(/(^|[^A-Za-z])(Frosty|FROSTIES)(?=[^A-Za-z]|$)/gi, "$1雪人")
	data = data.replace(/(^|[^A-Za-z])(Mischievous*?|GRENTCH)(?=[^A-Za-z]|$)/gi, "$1红帽绿皮怪")
	data = data.replace(/(^|[^A-Za-z])(Yuletides*?)(?=[^A-Za-z]|$)/gi, "$1狂欢药水")
	data = data.replace(/(^|[^A-Za-z])(SIEGE TURTLEs*?)(?=[^A-Za-z]|$)/gi, "$1攻城巨龟")

	//11. 字/印/符/组件
	data = data.replace(/(^|[^A-Za-z])(HAFTS*?)(?=[^A-Za-z]|$)/gi, "$1柄")
	data = data.replace(/(^|[^A-Za-z])(HILTS*?)(?=[^A-Za-z]|$)/gi, "$1柄")
	data = data.replace(/(^|[^A-Za-z])(TANGS*?)(?=[^A-Za-z]|$)/gi, "$1刃")
	data = data.replace(/(^|[^A-Za-z])(SNATHES*?)(?=[^A-Za-z]|$)/gi, "$1柄")
	data = data.replace(/(^|[^A-Za-z])(BOW STRING*S*|BOWSTRING*S*)(?=[^A-Za-z]|$)/gi, "$1弓弦")
	data = data.replace(/(^|[^A-Za-z])(SPEA*?E*?R\s*?HEADS*?)(?=[^A-Za-z]|$)/gi, "$1矛头")
	data = data.replace(/(^|[^A-Za-z])(STA*?U*?FF HEADS*?|STA*?U*?FFHEADS*?)(?=[^A-Za-z]|$)/gi, "$1法杖头")
	data = data.replace(/(^|[^A-Za-z])(HEADS*?)(?=[^A-Za-z]|$)/gi, "$1头")
	data = data.replace(/(^|[^A-Za-z])(BOW\s*?GRIB*?P*?S*?)(?=[^A-Za-z]|$)/gi, "$1弓柄")
	data = data.replace(/(^|[^A-Za-z])(SC*?Y*C*?TY*HE\s*?GRIB*?P*?S*?)(?=[^A-Za-z]|$)/gi, "$1镰刀把")
	data = data.replace(/(^|[^A-Za-z])(GRIB*?P*?S*?)(?=[^A-Za-z]|$)/gi, "$1把手")
	data = data.replace(/(^|[^A-Za-z])(PO*?U*?MM*?ELS*?)(?=[^A-Za-z]|$)/gi, "$1柄首")
	data = data.replace(/(^|[^A-Za-z])(HANDE*?LE*?S*?)(?=[^A-Za-z]|$)/gi, "$1握柄")
	data = data.replace(/(^|[^A-Za-z])(STAFF\s*?WRAPP*?I*?N*?G*?S*?)(?=[^A-Za-z]|$)/gi, "$1法杖把手")
	data = data.replace(/(^|[^A-Za-z])(WA*?RAPPINGS*?|WRAPS*?)(?=[^A-Za-z]|$)/gi, "$1把手")


	data = data.replace(/(^|[^A-Za-z])(BARBED)(?=[^A-Za-z]|$)/gi, "$1[荆棘]")
	data = data.replace(/(^|[^A-Za-z])(CRIPPLING*?)(?=[^A-Za-z]|$)/gi, "$1[致残]")
	data = data.replace(/(^|[^A-Za-z])(CRUEL)(?=[^A-Za-z]|$)/gi, "$1[残酷]")
	//heavy移至最后
	data = data.replace(/(^|[^A-Za-z])(POISONI*?OUS)(?=[^A-Za-z]|$)/gi, "$1[淬毒]")
	data = data.replace(/(^|[^A-Za-z])(SILENCING*?)(?=[^A-Za-z]|$)/gi, "$1[沈默]")
	data = data.replace(/(^|[^A-Za-z])(EBON)(?=[^A-Za-z]|$)/gi, "$1[黑檀]")
	data = data.replace(/(^|[^A-Za-z])(FIERY)(?=[^A-Za-z]|$)/gi, "$1[火焰]")
	data = data.replace(/(^|[^A-Za-z])(ICY)(?=[^A-Za-z]|$)/gi, "$1[冰冻]")
	data = data.replace(/(^|[^A-Za-z])(SHOCKI*?N*?G*?|lighti*?ning*?)(?=[^A-Za-z]|$)/gi, "$1[电击]")
	data = data.replace(/(^|[^A-Za-z])(FURIO*?US)(?=[^A-Za-z]|$)/gi, "$1[狂怒]")
	data = data.replace(/(^|[^A-Za-z])(SUNDERI*?N*?G*?N*?)(?=[^A-Za-z]|$)/gi, "$1[分离]")
	data = data.replace(/(^|[^A-Za-z])(VAMPI*?RIC)(?=[^A-Za-z]|$)/gi, "$1[吸血鬼]")
	data = data.replace(/(^|[^A-Za-z])(ZEALOUS)(?=[^A-Za-z]|$)/gi, "$1[热望]")
	data = data.replace(/(^|[^A-Za-z])(ADEPT)(?=[^A-Za-z]|$)/gi, "$1[行家]") //(施法时间减半(概率:10-20%))
	data = data.replace(/(^|[^A-Za-z])(DEFENSIVE)(?=[^A-Za-z]|$)/gi, "$1[防卫]")
	data = data.replace(/(^|[^A-Za-z])(HALE)(?=[^A-Za-z]|$)/gi, "$1[健壮]")
	data = data.replace(/(^|[^A-Za-z])(INSIGHTFUL)(?=[^A-Za-z]|$)/gi, "$1[洞察]")
	data = data.replace(/(^|[^A-Za-z])(SWIFT)(?=[^A-Za-z]|$)/gi, "$1[迅速]")

	//见结尾项

	data = data.replace(/(^|[^A-Za-z])(SURVIVOR'*?S*?'*? INSIGNI*?AS*?)(?=[^A-Za-z]|$)/gi, "$1生存 微记")
	data = data.replace(/(^|[^A-Za-z])(INSIGNI*?AS*?)(?=[^A-Za-z]|$)/gi, "$1微记")
	data = data.replace(/(^|[^A-Za-z])(INSRCS*?\.*?|INS*?CR*?IPTI*?ONS*?|INSCS*?|INSCR*?I*?P*?T*?\.*?|INSCRIP*?B*?T*?ABLES*?|INSCRIPS*?|INS*?CRIBS*?|inscrition|inscriptible|INS*?C*?S*?RIPT*?S*?|INS|Insrcip|inscribed*?|Incription|incs*?|inscrabables*?|nscribable|inscble|incsription)(?=[^A-Za-z]|$)/gi, "$1铸印")
	data = data.replace(/(^|[^A-Za-z])(RUNE OF SUPERIOR VIGOR|RUNE OF SUP.*? VIG(?:OR)*?|SUP.*? VIG(?:OR)*?|SUPERIOR VIGOR|SUP VIGORS*?)(?=[^A-Za-z]|$)/gi, "$1高活")
	data = data.replace(/(^|[^A-Za-z])(RUNE OF MAJOR VIGOR|RUNE OF MAJO*?R*?\.*? VIG(?:OR)*?|MAJ.*? VIG(?:OR)*?|MAJO*?R*? VIGORS*?|MAJ VIGORS*?)(?=[^A-Za-z]|$)/gi, "$1中活")
	data = data.replace(/(^|[^A-Za-z])(MODS|MOD|MODD)(?=[^A-Za-z]|$)/gi, "$1组件")
	data = data.replace(/(^|[^A-Za-z])(UPP*?GRADES*?(?: COMPONENTS*?)?)(?=[^A-Za-z]|$)/gi, "$1升级组件")
	data = data.replace(/(^|[^A-Za-z])(VAMPIRIC|VAMP)(?=[^A-Za-z]|$)/gi, "$1吸血")
	data = data.replace(/(^|[^A-Za-z])(ZEALOUS|ZEAL|ZELE)(?=[^A-Za-z]|$)/gi, "$1吸蓝")
	data = data.replace(/(^|[^A-Za-z])(HP|HEALT*?R*?H)(?=[^A-Za-z]|$)/gi, "$1体力")
	data = data.replace(/(^|[^A-Za-z])(M(?:EASURES*?)*?(?: FOR )*?(?:\s*?4\s*?)*?M(?:EASURES*?)*?)(?=[^A-Za-z]|$)/gi, "$1以牙还牙(铸印)")

	//12. 武器类别
	data = data.replace(/(^|[^A-Za-z])(WEAA*?POS*?NS*?|WEAA*?PON|WEPS*?|WEAA*?PS*?|WAEPONS*?|WEPONS*?)(?=[^A-Za-z]|$)/gi, "$1武器")
	data = data.replace(/(^|[^A-Za-z])(STAVES|SA*?TA*?FFS*?)(?=[^A-Za-z]|$)/gi, "$1法杖")
	data = data.replace(/(^|[^A-Za-z])(SHI*?E*?LDS*?|SHU*?E*?LD|SHEILD|shiwld|SHI*?EI*?LD*?S*?)(?=[^A-Za-z]|$)/gi, "$1盾")
	data = data.replace(/(^|[^A-Za-z])(SPEARS*?|SPEERS*?)(?=[^A-Za-z]|$)/gi, "$1矛")
	data = data.replace(/(^|[^A-Za-z])(AXES|AXE)(?=[^A-Za-z]|$)/gi, "$1斧")
	//绿拐子已移上
	data = data.replace(/(^|[^A-Za-z])(SC*?YC*?THE*?S*?|SC*?TYHE*?S*?|sc*?yhteS*?|SCYTES*?)(?=[^A-Za-z]|$)/gi, "$1镰刀")
	data = data.replace(/(^|[^A-Za-z])(DAGGERS*?|DAGGS*?)(?=[^A-Za-z]|$)/gi, "$1匕首")
	data = data.replace(/(^|[^A-Za-z])(SWO*?RO*?DS*?)(?=[^A-Za-z]|$)/gi, "$1剑")
	data = data.replace(/(^|[^A-Za-z])(HAMMERS|HAMMER)(?=[^A-Za-z]|$)/gi, "$1锤")
	data = data.replace(/(^|[^A-Za-z])(BOWS|BOW)(?=[^A-Za-z]|$)/gi, "$1弓")
	data = data.replace(/(^|[^A-Za-z])(OFFHAND*S*|OFFHAND|OFF\s*?-*?HANDS*?)(?=[^A-Za-z]|$)/gi, "$1副手")
	data = data.replace(/(^|[^A-Za-z])(WANDS*?)(?=[^A-Za-z]|$)/gi, "$1魔杖")
	data = data.replace(/(^|[^A-Za-z])(OPP*?RO*?ESS*?OE*?RS*?)(?=[^A-Za-z]|$)/gi, "$1压迫者")
	data = data.replace(/(^|[^A-Za-z])(DESTROYER|destryer)(?=[^A-Za-z]|$)/gi, "$1破坏者") //
	data = data.replace(/(^|[^A-Za-z])(TOU*?RMENTOR|TOU*?RM|TOU*?RMENTE*?D*?|Tormentend|tormentt|tormentet)(?=[^A-Za-z]|$)/gi, "$1拷问者")
	//遗物 已移上
	data = data.replace(/(^|[^A-Za-z])(Diessi*a*'*s*(?: ChalL*?ices*?)?|D\-*?\.*?\s*?Chalices*?|DISSEA(?: ChalL*?ices*?)?)(?=[^A-Za-z]|$)/gi, "$1底耶沙(眼罩)杯")
	data = data.replace(/(^|[^A-Za-z])(ChalL*?ices*?)(?=[^A-Za-z]|$)/gi, "$1杯子")
	data = data.replace(/(^|[^A-Za-z])(CL*?ELESTI*?AI*?L*? STONES*?|CL*?ELESTI*?AI*?L*? SU*?MM*?O*?N*?(?:ING)*?\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1天神(随机)召唤石")
	data = data.replace(/(^|[^A-Za-z])(CL*?E*?LE*?STI*?AI*?L*?Y*?N*?S*?|CL*?ELE*?S*?T*?|CLESTIAL|CL*?elsetial|sL*?elestial)(?=[^A-Za-z]|$)/gi, "$1天神")
	data = data.replace(/(^|[^A-Za-z])(COMPASS*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1罗盘")
	data = data.replace(/(^|[^A-Za-z])(CC+?)(?=[^A-Za-z]|$)/gi, "$1天神罗盘")
	data = data.replace(/(^|[^A-Za-z])(ZO*?DIACUS*?|ZODIA?C?)(?=[^A-Za-z]|$)/gi, "$1星宿")

	//13. 物品
	data = data.replace(/(^|[^A-Za-z])(HERO'*?E*?'*?S*?'*? (?:ZAISHEN )*?(?:Str*?ong\s*?)*?boxe*?s*?|HERO\s*?BOXE*?S*?|HERO\s*?STR*?ONGBOXE*?S*?|H\.*?\s*?BOXE*?S*?)(?=[^A-Za-z]|$)/gi, "$1英雄之路奖品盒")
	data = data.replace(/(^|[^A-Za-z])(GLADI*?A*?T*?O*?E*?R'*?S*?'*? (?:ZAISHEN )*?(?:Str*?ong\s*?)*?boxe*?s*?|GLAD\s*?BOXE*?S*?|GLAD\s*?STR*?ONGBOXE*?S*?|G\.*?\s*?BOXE*?S*?)(?=[^A-Za-z]|$)/gi, "$1随机竞技场奖品盒")
	data = data.replace(/(^|[^A-Za-z])(STRATEGIST'*?S*?'*? (?:ZAISHEN )*?(?:Strong\s*?)*?boxe*?s*?|STRATEGIST*?'*?S*?'*?\s*?BOXE*?S*?|STRATEGISTS*?\s*?STR*?ONG\s*?BOXE*?S*?|S\.*?\s*?BOXE*?S*?|STRATS*? (?:ZAISHEN )*?(?:Strong\s*?)*?boxe*?s*?)(?=[^A-Za-z]|$)/gi, "$1Codex奖品盒")
	data = data.replace(/(^|[^A-Za-z])(CHAMPI*?O*?A*?N*?'*?S*?'*?\s*?(?:ZAISHEN )*?(?:Str*?ong\s*?)*?boxe*?s*?|CHAMPI*?O*?A*?N*?'*?S*?\s*?(STRONG )?BOXE*?S*?|CHAMPI*?O*?A*?N*?'*?S*?\s*?STR*?ONG\s*?BOXE*?S*?|C\.*?\s*?BOXE*?S*?)(?=[^A-Za-z]|$)/gi, "$1公会战奖品盒")
	data = data.replace(/(^|[^A-Za-z])(STR*?ONG*?\s*?BOXE*?S*?)(?=[^A-Za-z]|$)/gi, "$1奖品盒")

	data = data.replace(/(^|[^A-Za-z])(AR*?MBRA*?CES*? OF TRUTH|AR*?MBRA*?N*?CES*?|ARMS*?|ARMB|ARMBRAES)(?=[^A-Za-z]|$)/gi, "$1真理")
	data = data.replace(/(^|[^A-Za-z])(SMA*?LL EQ*?(?:U*?IP)*?(?:MEN*?T)*?\.*? PACKS*?)(?=[^A-Za-z]|$)/gi, "$1小号装备包(容积:5空位)")
	data = data.replace(/(^|[^A-Za-z])(LA*?RGE*? EQ*?(?:U*?IP)*?(?:MEN*?T)*?\.*? PACKS*?)(?=[^A-Za-z]|$)/gi, "$1大号装备包(容积:15空位)")
	data = data.replace(/(^|[^A-Za-z])(HE*?A*?VY EQ*?(?:U*?IP)*?(?:MEN*?T)*?\.*? PACKS*?)(?=[^A-Za-z]|$)/gi, "$1重型装备包(容积:20空位)")
	data = data.replace(/(^|[^A-Za-z])(EQ(?:U*?IP)*?(?:MENT)*?\.*? PACKS*?)(?=[^A-Za-z]|$)/gi, "$1装备包")
	data = data.replace(/(^|[^A-Za-z])(Z\.*?\s*?KEYS*?|Z-*?KE*?YE*?S*?|ZH*?AISHEN\s*?KEYS*?|ZEY|Z\.*?\s*?CLEF*?|Z-*?KAYS*?)(?=[^A-Za-z]|$)/gi, "$1战承钥匙")
	data = data.replace(/(^|[^A-Za-z])(Z-COII*?NS|Z-COII*?N|Z COII*?NS|Z COII*?N|ZCOII*?NS|ZCOII*?N|ZAI*?SH(?:EN)*? COII*?NS*?|ZC)(?=[^A-Za-z]|$)/gi, "$1战承币")
	data = data.replace(/(^|[^A-Za-z])(GOTTS*?|TRAVELL*?ER'S GIFTS*?|TRAVELL*?ERS*? GIFTS*?|NIC*?K*?H*?O*?L*?A*?S*?'*?S*? GIFT*?S*?|GIFT'*?S*? OF*?\.*? (?:THE )*?TRAVEL*?LERS*?|GIFT'*?S*? (?:THE )?TRAVEL*?LER)(?=[^A-Za-z]|$)/gi, "$1旅者礼物")
	data = data.replace(/(^|[^A-Za-z])(NIC*?K*?H*?O*?L*?A*?S*?'*?S*?\s*?SETS*?)(?=[^A-Za-z]|$)/gi, "$1旅者材料(套)")
	data = data.replace(/(^|[^A-Za-z])(NIC*?K*?H*?O*?L*?A*?S*?'*?S*?\s*?ITEMS*?)(?=[^A-Za-z]|$)/gi, "$1旅者材料")
	data = data.replace(/(^|[^A-Za-z])(Travel*?er'*?S*?)(?=[^A-Za-z]|$)/gi, "$1旅者")
	data = data.replace(/(^|[^A-Za-z])(DOA GEMSETS*?|DOA GEM|GEM\s*?SETS*?)(?=[^A-Za-z]|$)/gi, "$1四门宝石组")

	data = data.replace(/(^|[^A-Za-z])(STYGIANS*? GEMST*?O*?N*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1冥狱宝石")
	data = data.replace(/(^|[^A-Za-z])(TORMENTS*? GEMST*?O*?N*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1苦痛宝石")
	data = data.replace(/(^|[^A-Za-z])(TITI*?ANS*? GEMST*?O*?N*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1泰坦宝石")
	data = data.replace(/(^|[^A-Za-z])(TITI*?ANS*?)(?=[^A-Za-z]|$)/gi, "$1泰坦")
	data = data.replace(/(^|[^A-Za-z])(STYGIANS*?|STYG)(?=[^A-Za-z]|$)/gi, "$1冥狱")

	data = data.replace(/(^|[^A-Za-z])(DOA|TDP)(?=[^A-Za-z]|$)/gi, "$1四门")
	data = data.replace(/(^|[^A-Za-z])(COTTONTAILS*?)(?=[^A-Za-z]|$)/gi, "$1兔")
	data = data.replace(/(^|[^A-Za-z])(ENVOY)(?=[^A-Za-z]|$)/gi, "$1金币")
	data = data.replace(/(^|[^A-Za-z])(DHUUMS*?)(?=[^A-Za-z]|$)/gi, "$1多姆")
	data = data.replace(/(^|[^A-Za-z])(VICTORY TOC*?KK*?C*?ENS*?|VICTORY TOC*?KK*?C*?EN)(?=[^A-Za-z]|$)/gi, "$1胜利勋章")
	data = data.replace(/(^|[^A-Za-z])(PANDA)(?=[^A-Za-z]|$)/gi, "$1熊猫")
	data = data.replace(/(^|[^A-Za-z])(POLAR\s*?BEARS*?|POLAR)(?=[^A-Za-z]|$)/gi, "$1北极熊")
	data = data.replace(/(^|[^A-Za-z])(EBLADES*?|E-BLADES*?|ETER*?NAL BLADES*?|E BLADES*?)(?=[^A-Za-z]|$)/gi, "$1永世剑")
	data = data.replace(/(^|[^A-Za-z])(LOO*?C*?K*?\s*?PIC*?KS*?|LP|LPS|LOCKP\.*?s*?|L\.*?\s*?PICKS*?)(?=[^A-Za-z]|$)/gi, "$1开锁道具")
	data = data.replace(/(^|[^A-Za-z])(KEYS|KEY)(?=[^A-Za-z]|$)/gi, "$1钥匙")
	data = data.replace(/(^|[^A-Za-z])(GHS*?AS*?TLY STONES*?|GHS*?AS*?TLY SUMM*?O*?N*?(?:ING)*? STONES*?|G-*?STONES*?|G\.*?\s*?Summon\s*?Stones*?)(?=[^A-Za-z]|$)/gi, "$1地下召唤石")
	data = data.replace(/(^|[^A-Za-z])(MERCH STONES*?|MERCH SUMM*?O*?N*?(?:ING)*? STONES*?|M-*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1商人召唤石")
	data = data.replace(/(^|[^A-Za-z])(MYSS*?T(?:ERIOS*?US)*? STONES*?|MYSS*?T(?:ERIOS*?US)*? SUMM*?O*?N*?(?:ING)*?\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1神秘(随机)召唤石")
	//天神召唤石已移上
	data = data.replace(/(^|[^A-Za-z])(ZAISHEN STONES*?|ZAISHEN SUMM*?O*?N*?(?:ING)*?\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1战承(随机)召唤石")
	data = data.replace(/(^|[^A-Za-z])(MYSTICAL STONES*?|MYSTICAL SUMM*?O*?N*?(?:ING)*?\s*?STONES*?|GAKI STONES*?|MYSTICAL SUMM*?O*?N*?(?:ING)*?\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1尔果召唤石")
	data = data.replace(/(^|[^A-Za-z])(DEMONIC STONES*?|DEMONIC SUMM*?O*?N*?(?:ING)*?\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1深渊召唤石")
	data = data.replace(/(^|[^A-Za-z])(JADE*?ITE STONES*?|JADE*?ITE SUMM*?O*?N*?(?:ING)*?\s*?STONES*?)(?=[^A-Za-z]|$)/gi, "$1巨龟召唤石")

	data = data.replace(/(^|[^A-Za-z])(FO*?RO*?N*?GG*?YS*(?: SCEPTERS*?)?|FO*?RO*?N*?GG*?(?:IES)*(?: SCEPTERS*?)?|FO*?RO*?N*?GG*?IES*?)(?=[^A-Za-z]|$)/gi, "$1青蛙权杖")
	data = data.replace(/(^|[^A-Za-z])(BOGROOTS*?|FROG*?S*?)(?=[^A-Za-z]|$)/gi, "$1青蛙")

	data = data.replace(/(^|[^A-Za-z])(SUU*?MM*?O*?N*?G*?I*?N*?G*?S*? STONES*?)(?=[^A-Za-z]|$)/gi, "$1召唤石")
	data = data.replace(/(^|[^A-Za-z])(SUU*?MM*?ONG*?ING*?S*?|SUU*?MMONG*?S*?|SUU*?MONG*?S*?)(?=[^A-Za-z]|$)/gi, "$1召唤")
	data = data.replace(/(^|[^A-Za-z])(STONES*?)(?=[^A-Za-z]|$)/gi, "$1石")
	data = data.replace(/(^|[^A-Za-z])(SALVAGE*?\s*?KITS*?)(?=[^A-Za-z]|$)/gi, "$1拆解工具")
	data = data.replace(/(^|[^A-Za-z])((?:PE*?RFE*?C*?T*? )?SA*?LVA*?G*?E*?\s*?KITS*?)(?=[^A-Za-z]|$)/gi, "$1完美拆解工具")

	//14. 其他
	data = data.replace(/(^|[^A-Za-z])(GUILD\s*?WARS*?|GW)(?=[^A-Za-z]|$)/gi, "$1激战")
	data = data.replace(/(^|[^A-Za-z])(Accounts*?|ACCTS*?|ACCS*?)(?=[^A-Za-z]|$)/gi, "$1帐号")
	data = data.replace(/(^|[^A-Za-z])(TRIMM*?S*?E*?D*?\s*?CAPES*?)(?=[^A-Za-z]|$)/gi, "$1鑲边披风")
	data = data.replace(/(^|[^A-Za-z])(TRIMM*?S*?E*?D*?\s*?)(?=[^A-Za-z]|$)/gi, "$1鑲边披风")
	data = data.replace(/(^|[^A-Za-z])(CAPES*?)(?=[^A-Za-z]|$)/gi, "$1披风")
	data = data.replace(/(^|[^A-Za-z])(GUILD HALL|GUILD HALLS|GH)(?=[^A-Za-z]|$)/gi, "$1公会厅")
	data = data.replace(/(^|[^A-Za-z])(GUILD TAGS*?)(?=[^A-Za-z]|$)/gi, "$1公会名")
	data = data.replace(/(^|[^A-Za-z])(GUILL*?DS*?)(?=[^A-Za-z]|$)/gi, "$1公会")
	data = data.replace(/(^|[^A-Za-z])(O*?N*?\s*?(@[^A-Za-z]*?)*?BRIDGE)(?=[^A-Za-z]|$)/gi, "$1@在桥上")
	data = data.replace(/(^|[^A-Za-z])(@[^A-Za-z]*?CHEST)(?=[^A-Za-z]|$)/gi, "$1@在箱子旁")
	data = data.replace(/(^|[^A-Za-z])(STANCE)(?=[^A-Za-z]|$)/gi, "$1态势")

	data = data.replace(/(^|[^A-Za-z])(FLAMES*?)(?=[^A-Za-z]|$)/gi, "$1火焰")
	data = data.replace(/(^|[^A-Za-z])(SLOTS*?)(?=[^A-Za-z]|$)/gi, "$1空位")
	data = data.replace(/(^|[^A-Za-z])(KEGS*?)(?=[^A-Za-z]|$)/gi, "$1(酒)桶(150分)")
	data = data.replace(/(^|[^A-Za-z])(ZH*?AI*?SH*?I*?EN|S*?Z*?AIS*?C*?HENS*?)(?=[^A-Za-z]|$)/gi, "$1战承")
	data = data.replace(/(^|[^A-Za-z])(MAX)(?=[^A-Za-z]|$)/gi, "$1完整")
	data = data.replace(/(^|[^A-Za-z])(CHOICES*?|CHOOSES*?)(?=[^A-Za-z]|$)/gi, "$1选择")
	data = data.replace(/(^|[^A-Za-z])(ENERGY*?|ENE|ENJ)(?=[^A-Za-z]|$)/gi, "$1能量")
	data = data.replace(/(^|[^A-Za-z])(LUXONS*?)(?=[^A-Za-z]|$)/gi, "$1红方")
	data = data.replace(/(^|[^A-Za-z])(KURZICKS*?)(?=[^A-Za-z]|$)/gi, "$1蓝方")
	data = data.replace(/(^|[^A-Za-z])(AFKS*?|AFKING*?)(?=[^A-Za-z]|$)/gi, "$1正在挂机")
	data = data.replace(/(^|[^A-Za-z])(YEARR*?S*?)(?=[^A-Za-z]|$)/gi, "$1年")
	data = data.replace(/(^|[^A-Za-z])(BIRTHDAYS*?|BDAYS*?|B-DAYS*?|B DAYS*?|brithdays*?)(?=[^A-Za-z]|$)/gi, "$1生日")
	data = data.replace(/(^|[^A-Za-z])((?:CASTERS*?|CASTER'S)\s?(?:MODD*?E*?D*?)*?)(?=[^A-Za-z]|$)/gi, "$1施法者用")
	data = data.replace(/(^|[^A-Za-z])(DUAL)(?=[^A-Za-z]|$)/gi, "$1双")
	data = data.replace(/(^|[^A-Za-z])(FIERY)(?=[^A-Za-z]|$)/gi, "$1火(焰)")

	data = data.replace(/(^|[^A-Za-z])(FULL)(?=[^A-Za-z]|$)/gi, "$1满")
	data = data.replace(/(^|[^A-Za-z])(CONSUMM*?ABLES*?)(?=[^A-Za-z]|$)/gi, "$1消耗品")
	data = data.replace(/(^|[^A-Za-z])(TITT*?LES*?)(?=[^A-Za-z]|$)/gi, "$1称号")

	data = data.replace(/(^|[^A-Za-z])(BLESSI*?N*?G*?S*? O*?I*?F WAR*?T*?S*?|BLESSI*?N*?G*?S*? O*?I*?F BALTHS*?Z*?|BESSING)(?=[^A-Za-z]|$)/gi, "$1战争祈福(十周年)")

	data = data.replace(/(^|[^A-Za-z])(URGOZ)(?=[^A-Za-z]|$)/gi, "$1尔果")
	data = data.replace(/(^|[^A-Za-z])(DEEP)(?=[^A-Za-z]|$)/gi, "$1深渊")

	data = data.replace(/(^|[^A-Za-z])(AEGIS OF A*?R*?G*?H*?)(?=[^A-Za-z]|$)/gi, "$1阿而古之神盾")
	data = data.replace(/(^|[^A-Za-z])(IN PRE)(?=[^A-Za-z]|$)/gi, "$1毁灭前")
	data = data.replace(/(^|[^A-Za-z])(PRE ITEMS*?)(?=[^A-Za-z]|$)/gi, "$1毁灭前物品")
	data = data.replace(/(^|[^A-Za-z])(MERCANTILE)(?=[^A-Za-z]|$)/gi, "$1商人")
	data = data.replace(/(^|[^A-Za-z])(NOW)(?=[^A-Za-z]|$)/gi, "$1现在")
	data = data.replace(/(^|[^A-Za-z])(ETC)(?=[^A-Za-z]|$)/gi, "$1等")
	data = data.replace(/(^|[^A-Za-z])(INFOS*?)(?=[^A-Za-z]|$)/gi, "$1资料")
	data = data.replace(/(^|[^A-Za-z])(MAP\s*?SETS*?)(?=[^A-Za-z]|$)/gi, "$1地图套")
	data = data.replace(/(^|[^A-Za-z])(MAPS*?)(?=[^A-Za-z]|$)/gi, "$1地图")
	data = data.replace(/(^|[^A-Za-z])(STO*?RO*?M\s*?BOWS*?)(?=[^A-Za-z]|$)/gi, "$1暴风弓")
	data = data.replace(/(^|[^A-Za-z])(OTHER*?)(?=[^A-Za-z]|$)/gi, "$1其他")
	//data=data.replace(/(^|[^A-Za-z])(AMOUNT)(?=[^A-Za-z]|$)/gi, '$1数目'); 早些已转换
	data = data.replace(/(^|[^A-Za-z])(MUU*?RR*?SS*?AA*?TT*?'*?S*?)(?=[^A-Za-z]|$)/gi, "$1马赛特")

	data = data.replace(/(^|[^A-Za-z])(Q\s*?\d{1,2}(\/?\d{0,2}\s*?)*?)VS(?=[^A-Za-z]|$)/gi, "$1$2电流矛")

	//15. 选择性替代

	var searchIndex = -1
	var searchIndexB = -1
	searchIndex = data.search(/(^|[^A-Za-z])((?:Q\s*?\d*?\d\s*?)VS|VS(?:\s*?Q\s*?\d*?\d))(?=[^A-Za-z]|$)/gi);
	(searchIndex != -1) ? data = data.replace(/(^|[^A-Za-z])(VS)(?=[^A-Za-z]|$)/gi, "$1电流矛"): data = data.replace(/(^|[^A-Za-z])(VS)(?=[^A-Za-z]|$)/gi, "$1VS")
	searchIndex = data.search(/(^|[^A-Za-z])((?:属性需求\s*?\d*?\d\s*?)VS|VS(?:\s*?属性需求\s*?\d*?\d))(?=[^A-Za-z]|$)/gi);
	(searchIndex != -1) ? data = data.replace(/(^|[^A-Za-z])(VS)(?=[^A-Za-z]|$)/gi, "$1电流矛"): data = data.replace(/(^|[^A-Za-z])(VS)(?=[^A-Za-z]|$)/gi, "$1VS")
	searchIndex = data.search(/(^|[^A-Za-z])((?:R\s*?\d*?\d\s*?)VS|VS(?:\s*?R\s*?\d*?\d))(?=[^A-Za-z]|$)/gi);
	(searchIndex != -1) ? data = data.replace(/(^|[^A-Za-z])(VS)(?=[^A-Za-z]|$)/gi, "$1电流矛"): data = data.replace(/(^|[^A-Za-z])(VS)(?=[^A-Za-z]|$)/gi, "$1VS")
	searchIndex = data.search(/迷你/gi);
	(searchIndex != -1) ? data = data.replace(/(^|[^A-Za-z])(UNDEADS*?)(?=[^A-Za-z]|$)/gi, "$1未奉献的"): data = data.replace(/(^|[^A-Za-z])(UNDEADS*?)(?=[^A-Za-z]|$)/gi, "$1不死族")
	searchIndex = data.search(/(精英|普通)/gi);
	(searchIndex != -1) ? data = data.replace(/(^|[^A-Za-z])(TOMBS*?)(?=[^A-Za-z]|$)/gi, "$1书"): data = data.replace(/(^|[^A-Za-z])(TOMBS*?)(?=[^A-Za-z]|$)/gi, "$1墓")
	searchIndex = data.search(/书/gi);
	(searchIndex != -1) ? data = data.replace(/(^|[^A-Za-z])(WAR)(?=[^A-Za-z]|$)/gi, "$1战士"): data = data.replace(/(^|[^A-Za-z])(WAR)(?=[^A-Za-z]|$)/gi, "$1战士")
	searchIndex = data.search(/永久/gi)
	searchIndexB = data.search(/变身/gi);
	((searchIndex != -1) && (searchIndexB == -1)) ? data = data.replace(/(^|[^A-Za-z])(永久)(?=[^A-Za-z]|$)/gi, "$1永久变身"): searchIndexB = -1
	searchIndex = data.search(/普通|困难/gi);
	(searchIndex != -1) ? searchIndex = -1: data = data.replace(/(^|[^A-Za-z])(模式)(?=[^A-Za-z]|$)/gi, "$1组件")
	searchIndex = data.search(/地图|块/gi);
	(searchIndex != -1) ? searchIndex = -1: data = data.replace(/(^|[^A-Za-z])(LEFT)(?=[^A-Za-z]|$)/gi, "$1剩下")

	//data=data.replace(/(^|[^A-Za-z])(TOP)(?=[^A-Za-z]|$)/gi, '$1上')
	data = data.replace(/(^|[^A-Za-z])(BOTT*O*M*)(?=[^A-Za-z]|$)/gi, "$1下方")
	//data=data.replace(/(^|[^A-Za-z])(RIGHT)(?=[^A-Za-z]|$)/gi, '$1右')

	//16. 数字
	data = data.replace(/(^|[^A-Za-z])(1st)(?=[^A-Za-z]|$)/gi, "$1第1")
	data = data.replace(/(^|[^A-Za-z])(2nd)(?=[^A-Za-z]|$)/gi, "$1第2")
	data = data.replace(/(^|[^A-Za-z])(3rd)(?=[^A-Za-z]|$)/gi, "$1第3")
	data = data.replace(/(\d*?\s*?-*?\s*?\d+)(\s*?)(th)(?=[^A-Za-z]|$)/gi, " 第$1")

	//17. 结尾项 (避免拆散常见短语)
	data = data.replace(/(^|[^A-Za-z])(PUMPKIN*?M*?S*?)(?=[^A-Za-z]|$)/gi, "$1南瓜")
	data = data.replace(/(^|[^A-Za-z])(COOKIES*?)(?=[^A-Za-z]|$)/gi, "$1饼干")
	data = data.replace(/(^|[^A-Za-z])(SETS|SET)(?=[^A-Za-z]|$)/gi, "$1套")
	data = data.replace(/(^|[^A-Za-z])(POINTS|POINT|PT|PTS)(?=[^A-Za-z]|$)/gi, "$1分")
	data = data.replace(/(^|[^A-Za-z])(OBS)(?=[^A-Za-z]|$)/gi, "$1黑曜石")
	data = data.replace(/(^|[^A-Za-z])(COII*?NS*?)(?=[^A-Za-z]|$)/gi, "$1币")
	data = data.replace(/(^|[^A-Za-z])(GOLDS)(?=[^A-Za-z]|$)/gi, "$1金物")
	data = data.replace(/(^|[^A-Za-z])(ETER*?NAL)(?=[^A-Za-z]|$)/gi, "$1永世")
	data = data.replace(/(^|[^A-Za-z])(YRS*?)(?=[^A-Za-z]|$)/gi, "$1年")
	data = data.replace(/(^|[^A-Za-z])(USES*?)(?=[^A-Za-z]|$)/gi, "$1用")
	data = data.replace(/(^|[^A-Za-z])(MO)(?=[^A-Za-z]|$)/gi, "$1僧")
	data = data.replace(/(^|[^A-Za-z])(FAST|HURRY|QUICK)(?=[^A-Za-z]|$)/gi, "$1快")
	data = data.replace(/(^|[^A-Za-z])(PRE-*?\s*?SEARING*?S*?|PRESEARING*?S*?)(?=[^A-Za-z]|$)/gi, "$1毁灭前")
	data = data.replace(/(^|[^A-Za-z])(LOW)(?=[^A-Za-z]|$)/gi, "$1低")
	data = data.replace(/(^|[^A-Za-z])(HIGH)(?=[^A-Za-z]|$)/gi, "$1高")
	data = data.replace(/(^|[^A-Za-z])(ARO*?MO*?U*?R)(?=[^A-Za-z]|$)/gi, "$1防御")
	data = data.replace(/(^|[^A-Za-z])(AEGIE*?S)(?=[^A-Za-z]|$)/gi, "$1神盾")
	data = data.replace(/(^|[^A-Za-z])(ITEM*?S*?|ITMS*?)(?=[^A-Za-z]|$)/gi, "$1物品")
	data = data.replace(/(^|[^A-Za-z])(GOLDIE*?S*?)(?=[^A-Za-z]|$)/gi, "$1金物")
	data = data.replace(/(^|[^A-Za-z])(PURPZ*?S*?|PURPLES)(?=[^A-Za-z]|$)/gi, "$1紫物")

	data = data.replace(/(^|[^A-Za-z])(WHITES*?)(?=[^A-Za-z]|$)/gi, "$1白物")
	data = data.replace(/(^|[^A-Za-z])(CHANCE*?)(?=[^A-Za-z]|$)/gi, "$1概率")


	data = data.replace(/(^|[^A-Za-z])(STUFF*?S*?)(?=[^A-Za-z]|$)/gi, "$1东西")
	data = data.replace(/(^|[^A-Za-z])(TOKEN*?S*?|TOKS*?|TOENS*?|TOKINS*?)(?=[^A-Za-z]|$)/gi, "$1币")
	data = data.replace(/(^|[^A-Za-z])(DAMM*?AGES*?|DMG*?S*?)(?=[^A-Za-z]|$)/gi, "$1杀伤力")
	data = data.replace(/(^|[^A-Za-z])(RARE)(?=[^A-Za-z]|$)/gi, "$1少见的")
	data = data.replace(/(^|[^A-Za-z])(LOOKS NICE)(?=[^A-Za-z]|$)/gi, "$1好看")
	data = data.replace(/(^|[^A-Za-z])(NICE)(?=[^A-Za-z]|$)/gi, "$1好的")
	data = data.replace(/(^|[^A-Za-z])(BUNCH OF)(?=[^A-Za-z]|$)/gi, "$1多个")
	data = data.replace(/(^|[^A-Za-z])(FIREWORKS*?)(?=[^A-Za-z]|$)/gi, "$1烟花")
	data = data.replace(/(^|[^A-Za-z])(CRE*?è*?MES*? BRU*?û*?LE*?é*?E*S*?)(?=[^A-Za-z]|$)/gi, "$1焦糖布丁")
	data = data.replace(/(^|[^A-Za-z])(CRE*?è*?MES*?BRU*?û*?LE*?é*?E*S*?|Creme\s*?Brul*?le*?e|cre*?è*?me)(?=[^A-Za-z]|$)/gi, "$1焦糖布丁") //Crème Brûlée
	data = data.replace(/(^|[^A-Za-z])(TYPES*?|KINDS*?|VARIETY*?I*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1种类")
	data = data.replace(/(^|[^A-Za-z])(SINGLES*?)(?=[^A-Za-z]|$)/gi, "$1单个")
	data = data.replace(/(^|[^A-Za-z])(SC*?HARD*?S*?)(?=[^A-Za-z]|$)/gi, "$1碎片")
	data = data.replace(/(^|[^A-Za-z])(DOUBLES*?)(?=[^A-Za-z]|$)/gi, "$1双")
	data = data.replace(/(^|[^A-Za-z])(HALF)(?=[^A-Za-z]|$)/gi, "$1半")
	data = data.replace(/(^|[^A-Za-z])(MATERIALS*?|MATS)(?=[^A-Za-z]|$)/gi, "$1材料")
	data = data.replace(/(^|[^A-Za-z])(ALES*?|DRUNKS*?|BEERS*?|ALCH|alch*?ool|ALCO*?H*?OO*?LS*?|ALCS*?|alc*?hohol*?)(?=[^A-Za-z]|$)/gi, "$1酒")
	data = data.replace(/(^|[^A-Za-z])(GHOSTS*?)(?=[^A-Za-z]|$)/gi, "$1魂")
	data = data.replace(/(^|[^A-Za-z])(FOR*?TUNE*?S*?)(?=[^A-Za-z]|$)/gi, "$1锦囊")
	data = data.replace(/(^|[^A-Za-z])(RUNES*?)(?=[^A-Za-z]|$)/gi, "$1符文")
	data = data.replace(/(^|[^A-Za-z])(PERSONS*?|PEOPLES*?|PPLS*?)(?=[^A-Za-z]|$)/gi, "$1人")
	data = data.replace(/(^|[^A-Za-z])(PER)(?=[^A-Za-z]|$)/gi, "$1每")
	data = data.replace(/(^|[^A-Za-z])(ZK)(?=[^A-Za-z]|$)/gi, "$1战承钥匙")
	data = data.replace(/(^|[^A-Za-z])(FEEL FREE)(?=[^A-Za-z]|$)/gi, "$1随意")
	data = data.replace(/(^|[^A-Za-z])((?:FOR*? )?FREE)(?=[^A-Za-z]|$)/gi, "$1免费")
	data = data.replace(/(^|[^A-Za-z])(JOINS*?|JOINING*?)(?=[^A-Za-z]|$)/gi, "$1加入")
	data = data.replace(/(^|[^A-Za-z])(FROM)(?=[^A-Za-z]|$)/gi, "$1从")
	data = data.replace(/(^|[^A-Za-z])(CASH)(?=[^A-Za-z]|$)/gi, "$1现金")
	data = data.replace(/(^|[^A-Za-z])(BULK|BULK QUANTITY*?I*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1批发")
	data = data.replace(/(^|[^A-Za-z])(GIVING*? AWAY|GIVE AWAYS*?)(?=[^A-Za-z]|$)/gi, "$1发送")
	data = data.replace(/(^|[^A-Za-z])(LAST CALL|LEAVING*? SOON)(?=[^A-Za-z]|$)/gi, "$1即将离开")
	data = data.replace(/(^|[^A-Za-z])(QUESTS*?|MISSIONS*?|COOPS*?)(?=[^A-Za-z]|$)/gi, "$1任务")
	data = data.replace(/(^|[^A-Za-z])(SKILLS*?)(?=[^A-Za-z]|$)/gi, "$1技能")
	data = data.replace(/(^|[^A-Za-z])(SOME?)(?=[^A-Za-z]|$)/gi, "$1些")
	data = data.replace(/(^|[^A-Za-z])(GREAT CONCH)(?=[^A-Za-z]|$)/gi, "$1伟大海螺盾")
	data = data.replace(/(^|[^A-Za-z])(CONCH)(?=[^A-Za-z]|$)/gi, "$1海螺盾")
	//data=data.replace(/(^|[^A-Za-z])(TO)(?=[^A-Za-z]|$)/gi, '$1到');
	data = data.replace(/(^|[^A-Za-z])(UW|UNDERWORLD)(?=[^A-Za-z]|$)/gi, "$1地下")
	data = data.replace(/(^|[^A-Za-z])(FOW)(?=[^A-Za-z]|$)/gi, "$1灾难")
	data = data.replace(/(^|[^A-Za-z])(SCROLLS*?)(?=[^A-Za-z]|$)/gi, "$1卷")
	data = data.replace(/(^|[^A-Za-z])(SCAMM*?ERS*?)(?=[^A-Za-z]|$)/gi, "$1骗子")
	data = data.replace(/(^|[^A-Za-z])(SCAMM*?S*?)(?=[^A-Za-z]|$)/gi, "$1骗人")
	data = data.replace(/(^|[^A-Za-z])(GET SCAMM*?ED|GOT SCAMM*?ED|WAS SCAMM*?ED|WERE SCAMM*?ED)(?=[^A-Za-z]|$)/gi, "$1被骗")
	data = data.replace(/(^|[^A-Za-z])(GEMS*?|GEMSTONES*?|GEMS*? STONES*?)(?=[^A-Za-z]|$)/gi, "$1宝石")
	data = data.replace(/(^|[^A-Za-z])(BIRTHDAY|BDAY|B-DAY|B DAY|B'DAY)(?=[^A-Za-z]|$)/gi, "$1生日")
	data = data.replace(/(^|[^A-Za-z])(BLAC*?K*?DYES*?)(?=[^A-Za-z]|$)/gi, "$1黑染")
	data = data.replace(/(^|[^A-Za-z])(WHI*?TEDYES*?)(?=[^A-Za-z]|$)/gi, "$1白染")
	data = data.replace(/(^|[^A-Za-z])(DO NOT|DON'T|DONT)(?=[^A-Za-z]|$)/gi, "$1不要")
	data = data.replace(/(^|[^A-Za-z])(AT\s*?(?:THE )?STORAGE|\@\s*?STORAGE)(?=[^A-Za-z]|$)/gi, "$1在桑莱箱")
	//data=data.replace(/(^|[^A-Za-z])(STORAGE)(?=[^A-Za-z]|$)/gi, '$1桑莱箱');
	data = data.replace(/(^|[^A-Za-z])(DAILY)(?=[^A-Za-z]|$)/gi, "$1每日")
	data = data.replace(/(^|[^A-Za-z])(NVM)(?=[^A-Za-z]|$)/gi, "$1算了")
	data = data.replace(/(^|[^A-Za-z])(COME)(?=[^A-Za-z]|$)/gi, "$1来")
	data = data.replace(/(^|[^A-Za-z])(IDK)(?=[^A-Za-z]|$)/gi, "$1我不知道")
	data = data.replace(/(^|[^A-Za-z])(REAS*?LLY)(?=[^A-Za-z]|$)/gi, "$1很")
	data = data.replace(/(^|[^A-Za-z])(ESPECIALLY)(?=[^A-Za-z]|$)/gi, "$1特别是")
	data = data.replace(/(^|[^A-Za-z])(HAVE|HAS)(?=[^A-Za-z]|$)/gi, "$1有")
	data = data.replace(/(^|[^A-Za-z])(SHITTY)(?=[^A-Za-z]|$)/gi, "$1烂")
	data = data.replace(/(^|[^A-Za-z])(TONIGHT)(?=[^A-Za-z]|$)/gi, "$1今晚")
	data = data.replace(/(^|[^A-Za-z])(GOODS)(?=[^A-Za-z]|$)/gi, "$1商品")
	data = data.replace(/(^|[^A-Za-z])(GOOD)(?=[^A-Za-z]|$)/gi, "$1好")
	data = data.replace(/(^|[^A-Za-z])(WEIRDOS)(?=[^A-Za-z]|$)/gi, "$1怪人")
	//data=data.replace(/(^|[^A-Za-z])(DEAD)(?=[^A-Za-z]|$)/gi, '$1死');
	data = data.replace(/(^|[^A-Za-z])(LEG)(?=[^A-Za-z]|$)/gi, "$1腿")
	data = data.replace(/(^|[^A-Za-z])(END OF GAME)(?=[^A-Za-z]|$)/gi, "$1通关")
	data = data.replace(/(^|[^A-Za-z])(END\s*?\-*?GAME)(?=[^A-Za-z]|$)/gi, "$1通关")
	data = data.replace(/(^|[^A-Za-z])(MYSELF)(?=[^A-Za-z]|$)/gi, "$1我自己")
	data = data.replace(/(^|[^A-Za-z])(YOURSELF)(?=[^A-Za-z]|$)/gi, "$1你自己")
	data = data.replace(/(^|[^A-Za-z])(YOURSELVES)(?=[^A-Za-z]|$)/gi, "$1你们自己")
	data = data.replace(/(^|[^A-Za-z])(DESERT)(?=[^A-Za-z]|$)/gi, "$1沙漠")
	data = data.replace(/(^|[^A-Za-z])(OASIS)(?=[^A-Za-z]|$)/gi, "$1绿洲")
	data = data.replace(/(^|[^A-Za-z])(START|STARTING)(?=[^A-Za-z]|$)/gi, "$1开始")
	data = data.replace(/(^|[^A-Za-z])(URGENT)(?=[^A-Za-z]|$)/gi, "$1紧急")
	data = data.replace(/(^|[^A-Za-z])(BLESSINGS*?)(?=[^A-Za-z]|$)/gi, "$1祈福")
	data = data.replace(/(^|[^A-Za-z])(SALVAGES*?)(?=[^A-Za-z]|$)/gi, "$1拆解")
	data = data.replace(/(^|[^A-Za-z])(HELPS*?|HELPED|HELPING*?)(?=[^A-Za-z]|$)/gi, "$1帮助")
	data = data.replace(/(^|[^A-Za-z])(if)(?=[^A-Za-z]|$)/gi, "$1如果")
	//data=data.replace(/(^|[^A-Za-z])(i)(?=[^A-Za-z]|$)/gi, '$1我');
	data = data.replace(/(^|[^A-Za-z])(CLASSES*?|JOBS*?|PROFESS*?IONS*?)(?=[^A-Za-z]|$)/gi, "$1职业")
	data = data.replace(/(^|[^A-Za-z])(NM)(?=[^A-Za-z]|$)/gi, "$1普通模式")
	data = data.replace(/(^|[^A-Za-z])(HM)(?=[^A-Za-z]|$)/gi, "$1困难模式")
	data = data.replace(/(^|[^A-Za-z])(HUGE|BIG|LARGE)(?=[^A-Za-z]|$)/gi, "$1大")
	data = data.replace(/(^|[^A-Za-z])(CLAWS*?)(?=[^A-Za-z]|$)/gi, "$1爪")
	data = data.replace(/(^|[^A-Za-z])(EYES)(?=[^A-Za-z]|$)/gi, "$1眼")
	data = data.replace(/(^|[^A-Za-z])(VOUC*?X*?HERS*?)(?=[^A-Za-z]|$)/gi, "$1券")
	data = data.replace(/(^|[^A-Za-z])(CAKES*?)(?=[^A-Za-z]|$)/gi, "$1蛋糕")
	data = data.replace(/(^|[^A-Za-z])(CANDY CAM*?N*?ES*?)(?=[^A-Za-z]|$)/gi, "$1拐子糖")
	data = data.replace(/(^|[^A-Za-z])(ASSORTED)(?=[^A-Za-z]|$)/gi, "$1多种")
	data = data.replace(/(^|[^A-Za-z])(ALREADY)(?=[^A-Za-z]|$)/gi, "$1已")
	data = data.replace(/(^|[^A-Za-z])(INCLUDED)(?=[^A-Za-z]|$)/gi, "$1包了")
	data = data.replace(/(^|[^A-Za-z])(INCLUDING*?|INCLUDES*?)(?=[^A-Za-z]|$)/gi, "$1包括")
	data = data.replace(/(^|[^A-Za-z])(ANYONE|SOMEONE)(?=[^A-Za-z]|$)/gi, "$1有谁")
	data = data.replace(/(^|[^A-Za-z])(CAN)(?=[^A-Za-z]|$)/gi, "$1可")
	data = data.replace(/(^|[^A-Za-z])(GIVE|GAVE|GIVEN)(?=[^A-Za-z]|$)/gi, "$1给")
	data = data.replace(/(^|[^A-Za-z])(TOWNS*?|OUTPOSTS*?)(?=[^A-Za-z]|$)/gi, "$1城镇")
	data = data.replace(/(^|[^A-Za-z])(SOLD OUT)(?=[^A-Za-z]|$)/gi, "$1卖完了")
	//data=data.replace(/(^|[^A-Za-z])(BOUGHT OUT)(?=[^A-Za-z]|$)/gi, '$1买完了');
	data = data.replace(/(^|[^A-Za-z])(BOUGHT?)(?=[^A-Za-z]|$)/gi, "$1买了")
	data = data.replace(/(^|[^A-Za-z])(SOLD?)(?=[^A-Za-z]|$)/gi, "$1卖了")
	data = data.replace(/(^|[^A-Za-z])(OMG)(?=[^A-Za-z]|$)/gi, "$1天哪")
	data = data.replace(/(^|[^A-Za-z])(PROVIDES*?|PROVIDING*?)(?=[^A-Za-z]|$)/gi, "$1提供")
	data = data.replace(/(^|[^A-Za-z])(INTERESTED)(?=[^A-Za-z]|$)/gi, "$1有意")
	data = data.replace(/(^|[^A-Za-z])(CREATURES*?)(?=[^A-Za-z]|$)/gi, "$1生物")
	data = data.replace(/(^|[^A-Za-z])(TODAY'*?S+?)(?=[^A-Za-z]|$)/gi, "$1今天的")
	data = data.replace(/(^|[^A-Za-z])(TOMORROW'*?S+?)(?=[^A-Za-z]|$)/gi, "$1明天的")
	data = data.replace(/(^|[^A-Za-z])(TODAY)(?=[^A-Za-z]|$)/gi, "$1今天")
	data = data.replace(/(^|[^A-Za-z])(TOMORROW)(?=[^A-Za-z]|$)/gi, "$1明天")
	data = data.replace(/(^|[^A-Za-z])(NEXT)(?=[^A-Za-z]|$)/gi, "$1下个")
	data = data.replace(/(^|[^A-Za-z])(HOURS*?)(?=[^A-Za-z]|$)/gi, "$1小时")
	data = data.replace(/(^|[^A-Za-z])(EERIE)(?=[^A-Za-z]|$)/gi, "$1诡异")
	data = data.replace(/(^|[^A-Za-z])(RODS*?)(?=[^A-Za-z]|$)/gi, "$1手杖")
	data = data.replace(/(^|[^A-Za-z])(TALONS*?)(?=[^A-Za-z]|$)/gi, "$1爪")
	data = data.replace(/(^|[^A-Za-z])(PIERCING*?S*?)(?=[^A-Za-z]|$)/gi, "$1穿刺")
	data = data.replace(/(^|[^A-Za-z])(DP)(?=[^A-Za-z]|$)/gi, "$1死亡惩罚")
	data = data.replace(/(^|[^A-Za-z])(REWARDS*?)(?=[^A-Za-z]|$)/gi, "$1奖励")
	data = data.replace(/(^|[^A-Za-z])(GHASTLY*?I*?E*?S*?)(?=[^A-Za-z]|$)/gi, "$1地下召唤石")
	data = data.replace(/(^|[^A-Za-z])(JADES*?)(?=[^A-Za-z]|$)/gi, "$1翡翠")
	data = data.replace(/(^|[^A-Za-z])(FINALLY)(?=[^A-Za-z]|$)/gi, "$1终于")
	data = data.replace(/(^|[^A-Za-z])(INVITATIONS*?)(?=[^A-Za-z]|$)/gi, "$1邀请")

	//武器描述
	data = data.replace(/(^|[^A-Za-z])(SHADOW)(?=[^A-Za-z]|$)/gi, "$1阴影")
	data = data.replace(/(^|[^A-Za-z])(CHAOS*?)(?=[^A-Za-z]|$)/gi, "$1混沌")
	data = data.replace(/(^|[^A-Za-z])(GLADIUS*?)(?=[^A-Za-z]|$)/gi, "$1罗马战剑")
	data = data.replace(/(^|[^A-Za-z])(EXALTED*?)(?=[^A-Za-z]|$)/gi, "$1尊贵")
	data = data.replace(/(^|[^A-Za-z])(IRIDESCENT)(?=[^A-Za-z]|$)/gi, "$1七彩")
	data = data.replace(/(^|[^A-Za-z])(Amethyst)(?=[^A-Za-z]|$)/gi, "$1紫水晶")
	data = data.replace(/(^|[^A-Za-z])(HOOKED)(?=[^A-Za-z]|$)/gi, "$1曲钩")
	data = data.replace(/(^|[^A-Za-z])(voi*?ltaic|volta|volti)(?=[^A-Za-z]|$)/gi, "$1电流")
	data = data.replace(/(^|[^A-Za-z])(SCEPTERS*?)(?=[^A-Za-z]|$)/gi, "$1权杖")
	data = data.replace(/(^|[^A-Za-z])(KORAMBITS*?)(?=[^A-Za-z]|$)/gi, "$1克兰刃")
	data = data.replace(/(^|[^A-Za-z])(RECURVES*?)(?=[^A-Za-z]|$)/gi, "$1反曲")
	data = data.replace(/(^|[^A-Za-z])(SICKLES*?)(?=[^A-Za-z]|$)/gi, "$1镰斧")
	data = data.replace(/(^|[^A-Za-z])(Canes*?)(?=[^A-Za-z]|$)/gi, "$1藤杖")

	//微记
	//生存微记已移上
	data = data.replace(/(^|[^A-Za-z])(RADIANT)(?=[^A-Za-z]|$)/gi, "$1闪耀")
	data = data.replace(/(^|[^A-Za-z])(BLESS*?ED)(?=[^A-Za-z]|$)/gi, "$1祝福")
	data = data.replace(/(^|[^A-Za-z])(INFILTRATORS*?)(?=[^A-Za-z]|$)/gi, "$1渗透者")
	data = data.replace(/(^|[^A-Za-z])(WINDWALKERS*?)(?=[^A-Za-z]|$)/gi, "$1风行者")

	//任务

	//人物，英雄，迷你
	data = data.replace(/(^|[^A-Za-z])(OOLA'*?S*?)(?=[^A-Za-z]|$)/gi, "$1乌拉")
	data = data.replace(/(^|[^A-Za-z])(ASURA'*?S*?)(?=[^A-Za-z]|$)/gi, "$1阿苏拉")
	data = data.replace(/(^|[^A-Za-z])(JUGG*?ERNAUTS*?)(?=[^A-Za-z]|$)/gi, "$1札格纳特")

	data = data.replace(/(^|[^A-Za-z])((?:PRINCE )?RURIC*?K*?S*)(?=[^A-Za-z]|$)/gi, "$1盧瑞克王子")
	data = data.replace(/(^|[^A-Za-z])(VARESH)(?=[^A-Za-z]|$)/gi, "$1梵禾斯")

	data = data.replace(/(^|[^A-Za-z])(GOREN)(?=[^A-Za-z]|$)/gi, "$1高恩")
	data = data.replace(/(^|[^A-Za-z])(KOSS)(?=[^A-Za-z]|$)/gi, "$1寇斯")
	data = data.replace(/(^|[^A-Za-z])((?:ACOLYTE )?JIN)(?=[^A-Za-z]|$)/gi, "$1侍从 静")
	data = data.replace(/(^|[^A-Za-z])(MAR*?GRIDS*?(?: THE)?(?: SLYS*?)?|SLYS*? MAGRIDS*?)(?=[^A-Za-z]|$)/gi, "$1狡诈者-玛格")
	data = data.replace(/(^|[^A-Za-z])(DUNKORO)(?=[^A-Za-z]|$)/gi, "$1唐克罗")
	data = data.replace(/(^|[^A-Za-z])(TAL*?HL*?KORA)(?=[^A-Za-z]|$)/gi, "$1塔蔻菈")
	//唤言大师已移上
	data = data.replace(/(^|[^A-Za-z])(NORGU)(?=[^A-Za-z]|$)/gi, "$1诺古")
	data = data.replace(/(^|[^A-Za-z])((?:ACOLYTE )?SOUSU*?KE)(?=[^A-Za-z]|$)/gi, "$1侍从-萨苏克")
	data = data.replace(/(^|[^A-Za-z])(ZHED(?: SHADOWHOOF)?)(?=[^A-Za-z]|$)/gi, "$1影爪-杰德")
	data = data.replace(/(^|[^A-Za-z])((?:GENERAL )?MORGAH*?N*?N)(?=[^A-Za-z]|$)/gi, "$1摩根将军")
	data = data.replace(/(^|[^A-Za-z])(MELONNI)(?=[^A-Za-z]|$)/gi, "$1梅隆妮")
	data = data.replace(/(^|[^A-Za-z])(RAZAH)(?=[^A-Za-z]|$)/gi, "$1雷撒")
	data = data.replace(/(^|[^A-Za-z])(JORA)(?=[^A-Za-z]|$)/gi, "$1乔拉")
	data = data.replace(/(^|[^A-Za-z])(PYRE?O?(?: FIERCESHOTS*?)?)(?=[^A-Za-z]|$)/gi, "$1烈之击-炎焰") //"馅"字左边去掉"饣"右边加上"炎"是什么字?
	data = data.replace(/(^|[^A-Za-z])(OGDEN(?: STONEHEALER)?)(?=[^A-Za-z]|$)/gi, "$1石愈者-欧格登")
	data = data.replace(/(^|[^A-Za-z])(LIVIA)(?=[^A-Za-z]|$)/gi, "$1莉薇亚")
	data = data.replace(/(^|[^A-Za-z])(GWEN)(?=[^A-Za-z]|$)/gi, "$1关")
	data = data.replace(/(^|[^A-Za-z])(VEKK)(?=[^A-Za-z]|$)/gi, "$1维克")
	//data=data.replace(/(^|[^A-Za-z])(ANTON)(?=[^A-Za-z]|$)/gi, '$1闪耀');
	data = data.replace(/(^|[^A-Za-z])(X*?S*?ANDRA)(?=[^A-Za-z]|$)/gi, "$1珊卓亚")
	data = data.replace(/(^|[^A-Za-z])(HAYDA)(?=[^A-Za-z]|$)/gi, "$1海妲")
	data = data.replace(/(^|[^A-Za-z])(KAHMU)(?=[^A-Za-z]|$)/gi, "$1卡慕")
	data = data.replace(/(^|[^A-Za-z])(OLIAS)(?=[^A-Za-z]|$)/gi, "$1奥里亚斯")
	//data=data.replace(/(^|[^A-Za-z])(MIKU)(?=[^A-Za-z]|$)/gi, '$1闪耀');
	data = data.replace(/(^|[^A-Za-z])(ZENMAI)(?=[^A-Za-z]|$)/gi, "$1刃玛伊")
	//data=data.replace(/(^|[^A-Za-z])(ZEI\s*?RI)(?=[^A-Za-z]|$)/gi, '$1闪耀');
	//data=data.replace(/(^|[^A-Za-z])(KEIRAN(?: THACKERAY)?)(?=[^A-Za-z]|$)/gi, '$1闪耀');
	data = data.replace(/(^|[^A-Za-z])(M\.*?O\.*?X\.*?)(?=[^A-Za-z]|$)/gi, "$1M.O.X.高仑")


	//组件描述
	data = data.replace(/(^|[^A-Za-z])(PHYSICALS*?|PHYSI*?)(?=[^A-Za-z]|$)/gi, "$1物理")
	data = data.replace(/(^|[^A-Za-z])(MELEE*?S*?)(?=[^A-Za-z]|$)/gi, "$1近战")
	data = data.replace(/(^|[^A-Za-z])(adrenaline|adrelin)(?=[^A-Za-z]|$)/gi, "$1怒气")

	//称号
	data = data.replace(/(^|[^A-Za-z])(CARTOGRAPHY*?E*?R*?S*(?: TITLE)?)(?=[^A-Za-z]|$)/gi, "$1版图宗师")

	//其他
	data = data.replace(/(^|[^A-Za-z])(PRE)(?=[^A-Za-z]|$)/gi, "$1毁灭前")
	data = data.replace(/(^|[^A-Za-z])(CS\s*?GO|CS\:GO|CS\:\:GO|COUNTERSTRIKES*? GO)(?=[^A-Za-z]|$)/gi, "$1反恐精英-全球攻势")
	data = data.replace(/(^|[^A-Za-z0-9])(RS\s*?GP)(?=[^A-Za-z]|$)/gi, "$1江湖金币")
	data = data.replace(/(^|[^A-Za-z0-9])(RS|RUNESCAPES*?)(?=[^A-Za-z]|$)/gi, "$1江湖")
	data = data.replace(/(^|[^A-Za-z])(GIFTS*?)(?=[^A-Za-z]|$)/gi, "$1礼品")
	data = data.replace(/(^|[^A-Za-z])(BAGS*?)(?=[^A-Za-z]|$)/gi, "$1袋子")

	//前缀 补充:
	data = data.replace(/(^|[^A-Za-z])(HEAVY)(?=[^A-Za-z]|$)/gi, "$1[沉重]")

	//毁灭前旅者材料
	data = data.replace(/(^|[^A-Za-z])(Unnatural SeedS*?)(?=[^A-Za-z]|$)/gi, "$1古怪的种子")
	data = data.replace(/(^|[^A-Za-z])(Enchanted LodestoneS*?)(?=[^A-Za-z]|$)/gi, "$1附魔磁石")
	data = data.replace(/(^|[^A-Za-z])(Gargoyle SkullS*?)(?=[^A-Za-z]|$)/gi, "$1石像鬼头颅")
	data = data.replace(/(^|[^A-Za-z])(Dull CarapaceS*?)(?=[^A-Za-z]|$)/gi, "$1阴暗的甲壳")
	data = data.replace(/(^|[^A-Za-z])(Baked HuskS*?)(?=[^A-Za-z]|$)/gi, "$1烧焦外壳")
	data = data.replace(/(^|[^A-Za-z])(Spider LegS*?)(?=[^A-Za-z]|$)/gi, "$1蜘蛛腿")
	data = data.replace(/(^|[^A-Za-z])(Skeletal LimbS*?)(?=[^A-Za-z]|$)/gi, "$1骷髅手臂")
	data = data.replace(/(^|[^A-Za-z])(Grawl NecklaceS*?)(?=[^A-Za-z]|$)/gi, "$1穴居人项链")
	data = data.replace(/(^|[^A-Za-z])(Worn BeltS*?)(?=[^A-Za-z]|$)/gi, "$1破旧的腰带")

	//旅行者材料 相关语句，包括部分城镇及敌人名称 （共925行）
	data = data.replace(/(^|[^A-Za-z])(Ice Tooth CaveS*?)(?=[^A-Za-z]|$)/gi, "$1冰牙洞穴")
	data = data.replace(/(^|[^A-Za-z])(Anvil RockS*?)(?=[^A-Za-z]|$)/gi, "$1铁砧石")
	data = data.replace(/(^|[^A-Za-z])(Frostfire DryderS*?)(?=[^A-Za-z]|$)/gi, "$1霜火蛛化精灵")
	data = data.replace(/(^|[^A-Za-z])(Frostfire FangS*?)(?=[^A-Za-z]|$)/gi, "$1霜火尖牙")
	data = data.replace(/(^|[^A-Za-z])(Boreas SeabedS*?)(?=[^A-Za-z]|$)/gi, "$1风神海床")
	data = data.replace(/(^|[^A-Za-z])(Pongmei ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1朋美谷")
	data = data.replace(/(^|[^A-Za-z])(Rot Wallow TuskS*?)(?=[^A-Za-z]|$)/gi, "$1腐败兽獠牙")
	data = data.replace(/(^|[^A-Za-z])(Rot WallowS*?)(?=[^A-Za-z]|$)/gi, "$1腐败兽")
	data = data.replace(/(^|[^A-Za-z])(Elona Reach)(?=[^A-Za-z]|$)/gi, "$1伊洛那流域")
	data = data.replace(/(^|[^A-Za-z])(Diviner's Ascent)(?=[^A-Za-z]|$)/gi, "$1预言者之坡")
	data = data.replace(/(^|[^A-Za-z])(Sand DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1沙龙兽")
	data = data.replace(/(^|[^A-Za-z])(Topaz CrestS*?)(?=[^A-Za-z]|$)/gi, "$1黄宝石颈脊")
	data = data.replace(/(^|[^A-Za-z])(Rata Sum)(?=[^A-Za-z]|$)/gi, "$1洛达顶点")
	data = data.replace(/(^|[^A-Za-z])(Magus Stones)(?=[^A-Za-z]|$)/gi, "$1玛古斯之石")
	data = data.replace(/(^|[^A-Za-z])(LifeweaverS*?)(?=[^A-Za-z]|$)/gi, "$1织命者")
	data = data.replace(/(^|[^A-Za-z])(BloodweaverS*?)(?=[^A-Za-z]|$)/gi, "$1织血者")
	data = data.replace(/(^|[^A-Za-z])(VenomweaverS*?)(?=[^A-Za-z]|$)/gi, "$1织恨者")
	data = data.replace(/(^|[^A-Za-z])(SpiderS*?)(?=[^A-Za-z]|$)/gi, "$1蜘蛛")
	data = data.replace(/(^|[^A-Za-z])(Weaver LegS*?)(?=[^A-Za-z]|$)/gi, "$1编织者的腿")
	data = data.replace(/(^|[^A-Za-z])(Yahnur MarketS*?)(?=[^A-Za-z]|$)/gi, "$1雅诺尔市集")
	data = data.replace(/(^|[^A-Za-z])(Vehtendi Valley)(?=[^A-Za-z]|$)/gi, "$1巍天帝峡谷")
	data = data.replace(/(^|[^A-Za-z])(Storm JacarandaS*?)(?=[^A-Za-z]|$)/gi, "$1暴风荆棘")
	data = data.replace(/(^|[^A-Za-z])(Mirage IbogaS*?)(?=[^A-Za-z]|$)/gi, "$1幻象伊波枷")
	data = data.replace(/(^|[^A-Za-z])(Enchanted Brambles)(?=[^A-Za-z]|$)/gi, "$1魔法树根")
	data = data.replace(/(^|[^A-Za-z])(Whistling ThornbrushS*?)(?=[^A-Za-z]|$)/gi, "$1荆棘之藤")
	data = data.replace(/(^|[^A-Za-z])(Sentient SporeS*?)(?=[^A-Za-z]|$)/gi, "$1知觉孢子")
	data = data.replace(/(^|[^A-Za-z])(AhojS*?)(?=[^A-Za-z]|$)/gi, "$1亚禾")
	data = data.replace(/(^|[^A-Za-z])(Bottle of Vabbian WineS*?)(?=[^A-Za-z]|$)/gi, "$1瓦贝红酒")
	data = data.replace(/(^|[^A-Za-z])(Jarimiya the Unmerciful)(?=[^A-Za-z]|$)/gi, "$1残酷 贾米里")
	data = data.replace(/(^|[^A-Za-z])(Blacktide Den)(?=[^A-Za-z]|$)/gi, "$1黑潮之穴")
	data = data.replace(/(^|[^A-Za-z])(Lahtenda Bog)(?=[^A-Za-z]|$)/gi, "$1洛天帝沼泽")
	data = data.replace(/(^|[^A-Za-z])(Mandragor ImpS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗恶魔")
	data = data.replace(/(^|[^A-Za-z])(Mandragor SlitherS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗之藤")
	data = data.replace(/(^|[^A-Za-z])(Stoneflesh MandragorS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗石根")
	data = data.replace(/(^|[^A-Za-z])(Mandragor SwamprootS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗根")
	data = data.replace(/(^|[^A-Za-z])(Vasburg Armory)(?=[^A-Za-z]|$)/gi, "$1维思柏兵营")
	data = data.replace(/(^|[^A-Za-z])(The Eternal Grove)(?=[^A-Za-z]|$)/gi, "$1永恒之林")
	data = data.replace(/(^|[^A-Za-z])(Skill Hungry GakiS*?)(?=[^A-Za-z]|$)/gi, "$1灵巧的饿鬼")
	data = data.replace(/(^|[^A-Za-z])(Pain Hungry GakiS*?)(?=[^A-Za-z]|$)/gi, "$1痛苦的饿鬼")
	data = data.replace(/(^|[^A-Za-z])(The Time EaterS*?)(?=[^A-Za-z]|$)/gi, "$1时间吞噬者")
	data = data.replace(/(^|[^A-Za-z])(The Scar EaterS*?)(?=[^A-Za-z]|$)/gi, "$1疤痕吞噬者")
	data = data.replace(/(^|[^A-Za-z])(Quarrel Falls)(?=[^A-Za-z]|$)/gi, "$1怨言瀑布")
	data = data.replace(/(^|[^A-Za-z])(SilverwoodS*?)(?=[^A-Za-z]|$)/gi, "$1银树")
	data = data.replace(/(^|[^A-Za-z])(Maguuma WarriorS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛战士")
	data = data.replace(/(^|[^A-Za-z])(Maguuma HunterS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛猎人")
	data = data.replace(/(^|[^A-Za-z])(Maguuma ProtectorS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛守护者")
	data = data.replace(/(^|[^A-Za-z])(Maguuma ManeS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛鬃毛")
	data = data.replace(/(^|[^A-Za-z])(Seeker's PassageS*?)(?=[^A-Za-z]|$)/gi, "$1探索者通道")
	data = data.replace(/(^|[^A-Za-z])(Salt FlatsS*?)(?=[^A-Za-z]|$)/gi, "$1盐滩")
	data = data.replace(/(^|[^A-Za-z])(The Amnoon OasisS*?)(?=[^A-Za-z]|$)/gi, "$1安奴绿洲")
	data = data.replace(/(^|[^A-Za-z])(Prophet's PathS*?)(?=[^A-Za-z]|$)/gi, "$1先知之路")
	data = data.replace(/(^|[^A-Za-z])(Jade ScarabS*?)(?=[^A-Za-z]|$)/gi, "$1翡翠圣甲虫")
	data = data.replace(/(^|[^A-Za-z])(Jade MandibleS*?)(?=[^A-Za-z]|$)/gi, "$1翡翠下颚骨")
	data = data.replace(/(^|[^A-Za-z])(Temple of the AgesS*?)(?=[^A-Za-z]|$)/gi, "$1世纪神殿")
	data = data.replace(/(^|[^A-Za-z])(Sunji*?ang DistrictS*?)(?=[^A-Za-z]|$)/gi, "$1孙江行政区")
	//data=data.replace(/(^|[^A-Za-z])(Sunji*?ang DistrictS*?)(?=[^A-Za-z]|$)/gi, '$1孙江行政区');
	data = data.replace(/(^|[^A-Za-z])(Shenzun TunnelsS*?)(?=[^A-Za-z]|$)/gi, "$1申赞通道")
	data = data.replace(/(^|[^A-Za-z])(AfflictedS*?)(?=[^A-Za-z]|$)/gi, "$1被感染的")
	data = data.replace(/(^|[^A-Za-z])(Putrid CystS*?)(?=[^A-Za-z]|$)/gi, "$1腐败胞囊")
	data = data.replace(/(^|[^A-Za-z])(Temple of the AgesS*?)(?=[^A-Za-z]|$)/gi, "$1世纪神殿")
	data = data.replace(/(^|[^A-Za-z])(The Black CurtainS*?)(?=[^A-Za-z]|$)/gi, "$1黑色帷幕")
	data = data.replace(/(^|[^A-Za-z])(Kessex PeakS*?)(?=[^A-Za-z]|$)/gi, "$1凯席斯山峰")
	data = data.replace(/(^|[^A-Za-z])(Talmark WildernessS*?)(?=[^A-Za-z]|$)/gi, "$1突马克荒地")
	data = data.replace(/(^|[^A-Za-z])(Forest MinotaurS*?)(?=[^A-Za-z]|$)/gi, "$1森林牛头怪")
	data = data.replace(/(^|[^A-Za-z])(Forest Minotaur HornS*?)(?=[^A-Za-z]|$)/gi, "$1森林牛头怪的角")
	data = data.replace(/(^|[^A-Za-z])(The AstralariumS*?)(?=[^A-Za-z]|$)/gi, "$1亚斯特拉利姆")
	data = data.replace(/(^|[^A-Za-z])(Zehlon ReachS*?)(?=[^A-Za-z]|$)/gi, "$1列隆流域")
	data = data.replace(/(^|[^A-Za-z])(Beknur HarborS*?)(?=[^A-Za-z]|$)/gi, "$1别克诺港")
	data = data.replace(/(^|[^A-Za-z])(Issnur IslesS*?)(?=[^A-Za-z]|$)/gi, "$1伊斯诺岛")
	data = data.replace(/(^|[^A-Za-z])(Skale BlighterS*?)(?=[^A-Za-z]|$)/gi, "$1黑暗鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Frigid SkaleS*?)(?=[^A-Za-z]|$)/gi, "$1寒冰鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Ridgeback SkaleS*?)(?=[^A-Za-z]|$)/gi, "$1脊背鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Skale FinS*?)(?=[^A-Za-z]|$)/gi, "$1鳞怪鳍")
	data = data.replace(/(^|[^A-Za-z])(Chef PanjohS*?)(?=[^A-Za-z]|$)/gi, "$1大厨 潘乔")
	data = data.replace(/(^|[^A-Za-z])(Bowl of Skale*?fin SoupS*?)(?=[^A-Za-z]|$)/gi, "$1鳞怪鳍汤")
	data = data.replace(/(^|[^A-Za-z])(Sage LandsS*?)(?=[^A-Za-z]|$)/gi, "$1荒原")
	data = data.replace(/(^|[^A-Za-z])(Mamnoon LagoonS*?)(?=[^A-Za-z]|$)/gi, "$1玛奴泻湖")
	data = data.replace(/(^|[^A-Za-z])(Henge of DenraviS*?)(?=[^A-Za-z]|$)/gi, "$1丹拉维圣地")
	data = data.replace(/(^|[^A-Za-z])(Tangle RootS*?)(?=[^A-Za-z]|$)/gi, "$1纠结之根")
	data = data.replace(/(^|[^A-Za-z])(Dry TopS*?)(?=[^A-Za-z]|$)/gi, "$1干燥高地")
	data = data.replace(/(^|[^A-Za-z])(Root BehemothS*?)(?=[^A-Za-z]|$)/gi, "$1根巨兽")
	data = data.replace(/(^|[^A-Za-z])(Behemoth JawS*?)(?=[^A-Za-z]|$)/gi, "$1巨兽颚")
	data = data.replace(/(^|[^A-Za-z])(SifhallaS*?)(?=[^A-Za-z]|$)/gi, "$1袭哈拉")
	data = data.replace(/(^|[^A-Za-z])(Jaga MoraineS*?)(?=[^A-Za-z]|$)/gi, "$1亚加摩瑞恩")
	data = data.replace(/(^|[^A-Za-z])(Berserking BisonS*?)(?=[^A-Za-z]|$)/gi, "$1海冶克狂战士")
	data = data.replace(/(^|[^A-Za-z])(Berserking MinotaurS*?)(?=[^A-Za-z]|$)/gi, "$1牛头怪狂战士")
	data = data.replace(/(^|[^A-Za-z])(Berserking WendigoS*?)(?=[^A-Za-z]|$)/gi, "$1狂战士 纹帝哥")
	data = data.replace(/(^|[^A-Za-z])(Berserking AurochsS*?)(?=[^A-Za-z]|$)/gi, "$1棘狼狂战士")
	data = data.replace(/(^|[^A-Za-z])(Berserker HornS*?)(?=[^A-Za-z]|$)/gi, "$1狂战士的角")
	data = data.replace(/(^|[^A-Za-z])(Brauer AcademyS*?)(?=[^A-Za-z]|$)/gi, "$1巴尔学院")
	data = data.replace(/(^|[^A-Za-z])(Drazach ThicketS*?)(?=[^A-Za-z]|$)/gi, "$1德瑞扎灌木林")
	data = data.replace(/(^|[^A-Za-z])(Tanglewood CopseS*?)(?=[^A-Za-z]|$)/gi, "$1谭格坞树林")
	data = data.replace(/(^|[^A-Za-z])(Pongmei ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1朋美谷")
	data = data.replace(/(^|[^A-Za-z])(UndergrowthS*?)(?=[^A-Za-z]|$)/gi, "$1矮树丛")
	data = data.replace(/(^|[^A-Za-z])(Dragon MossS*?)(?=[^A-Za-z]|$)/gi, "$1龙苔")
	data = data.replace(/(^|[^A-Za-z])(Dragon RootS*?)(?=[^A-Za-z]|$)/gi, "$1龙根")
	data = data.replace(/(^|[^A-Za-z])(Fishermen's HavenS*?)(?=[^A-Za-z]|$)/gi, "$1渔人避风港")
	data = data.replace(/(^|[^A-Za-z])(Stingray StrandS*?)(?=[^A-Za-z]|$)/gi, "$1魟鱼湖滨")
	data = data.replace(/(^|[^A-Za-z])(Tears of the FallenS*?)(?=[^A-Za-z]|$)/gi, "$1战死者之泪")
	data = data.replace(/(^|[^A-Za-z])(Grand DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1强龙兽")
	data = data.replace(/(^|[^A-Za-z])(Sanctum CayS*?)(?=[^A-Za-z]|$)/gi, "$1神圣沙滩")
	data = data.replace(/(^|[^A-Za-z])(Lightning DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1闪光龙兽")
	data = data.replace(/(^|[^A-Za-z])(Spiked CrestS*?)(?=[^A-Za-z]|$)/gi, "$1尖刺的颈脊")
	data = data.replace(/(^|[^A-Za-z])(Imperial SanctumS*?)(?=[^A-Za-z]|$)/gi, "$1帝国圣所")
	data = data.replace(/(^|[^A-Za-z])(Raisu PalaceS*?)(?=[^A-Za-z]|$)/gi, "$1莱苏皇宫")
	data = data.replace(/(^|[^A-Za-z])(Soul StoneS*?)(?=[^A-Za-z]|$)/gi, "$1灵魂石")
	data = data.replace(/(^|[^A-Za-z])(Tihark OrchardS*?)(?=[^A-Za-z]|$)/gi, "$1提亚克林地")
	data = data.replace(/(^|[^A-Za-z])(Forum HighlandsS*?)(?=[^A-Za-z]|$)/gi, "$1高地广场")
	data = data.replace(/(^|[^A-Za-z])(Skree WingS*?)(?=[^A-Za-z]|$)/gi, "$1鸟妖翅膀")
	data = data.replace(/(^|[^A-Za-z])(SkreeS*?)(?=[^A-Za-z]|$)/gi, "$1鸟妖")
	data = data.replace(/(^|[^A-Za-z])(Serenity TempleS*?)(?=[^A-Za-z]|$)/gi, "$1宁静神殿")
	data = data.replace(/(^|[^A-Za-z])(Pockmark FlatsS*?)(?=[^A-Za-z]|$)/gi, "$1麻点平原")
	data = data.replace(/(^|[^A-Za-z])(Storm RiderS*?)(?=[^A-Za-z]|$)/gi, "$1暴风驾驭者")
	data = data.replace(/(^|[^A-Za-z])(Stormy EyeS*?)(?=[^A-Za-z]|$)/gi, "$1暴风之眼")
	data = data.replace(/(^|[^A-Za-z])(Gates of KrytaS*?)(?=[^A-Za-z]|$)/gi, "$1科瑞塔之门")
	data = data.replace(/(^|[^A-Za-z])(Scoundrel's RiseS*?)(?=[^A-Za-z]|$)/gi, "$1恶汉山丘")
	data = data.replace(/(^|[^A-Za-z])(Griffon's MouthS*?)(?=[^A-Za-z]|$)/gi, "$1狮鹭兽隘口")
	data = data.replace(/(^|[^A-Za-z])(Spiritwood PlankS*?)(?=[^A-Za-z]|$)/gi, "$1心灵之板")
	data = data.replace(/(^|[^A-Za-z])(Tsumei VillageS*?)(?=[^A-Za-z]|$)/gi, "$1苏梅村")
	data = data.replace(/(^|[^A-Za-z])(Panji*?ang PeninsulaS*?)(?=[^A-Za-z]|$)/gi, "$1班让半岛")
	data = data.replace(/(^|[^A-Za-z])(Naga HideS*?)(?=[^A-Za-z]|$)/gi, "$1纳迦皮")
	data = data.replace(/(^|[^A-Za-z])(NagaS*?)(?=[^A-Za-z]|$)/gi, "$1纳迦")
	data = data.replace(/(^|[^A-Za-z])(SifhallaS*?)(?=[^A-Za-z]|$)/gi, "$1袭哈拉")
	data = data.replace(/(^|[^A-Za-z])(Drakkar LakeS*?)(?=[^A-Za-z]|$)/gi, "$1卓卡湖")
	data = data.replace(/(^|[^A-Za-z])(Frozen ElementalS*?)(?=[^A-Za-z]|$)/gi, "$1冰元素")
	data = data.replace(/(^|[^A-Za-z])(Piles*? of Elemental DustS*?)(?=[^A-Za-z]|$)/gi, "$1元素之土")
	//data=data.replace(/(^|[^A-Za-z])(Leviathan PitsS*?)(?=[^A-Za-z]|$)/gi, '$1卑尔根温泉');
	//data=data.replace(/(^|[^A-Za-z])(Silent SurfS*?)(?=[^A-Za-z]|$)/gi, '$1尼伯山丘');
	//data=data.replace(/(^|[^A-Za-z])(OniS*?)(?=[^A-Za-z]|$)/gi, '$1柯瑞塔北部');
	//data=data.replace(/(^|[^A-Za-z])(Keen Oni TalonS*?)(?=[^A-Za-z]|$)/gi, '$1硬瘤');
	data = data.replace(/(^|[^A-Za-z])(Leviathan PitsS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森矿场")
	data = data.replace(/(^|[^A-Za-z])(Silent SurfS*?)(?=[^A-Za-z]|$)/gi, "$1寂静之浪")
	data = data.replace(/(^|[^A-Za-z])(Seafarer's RestS*?)(?=[^A-Za-z]|$)/gi, "$1航海者休憩处")
	data = data.replace(/(^|[^A-Za-z])(OniS*?)(?=[^A-Za-z]|$)/gi, "$1鬼")
	data = data.replace(/(^|[^A-Za-z])(Keen Oni TalonS*?)(?=[^A-Za-z]|$)/gi, "$1鬼爪")
	data = data.replace(/(^|[^A-Za-z])(Ice Caves of SorrowS*?)(?=[^A-Za-z]|$)/gi, "$1悲伤冰谷")
	data = data.replace(/(^|[^A-Za-z])(IcedomeS*?)(?=[^A-Za-z]|$)/gi, "$1冰顶")
	data = data.replace(/(^|[^A-Za-z])(Siege Ice GolemS*?)(?=[^A-Za-z]|$)/gi, "$1攻城冰高仑")
	data = data.replace(/(^|[^A-Za-z])(Icy LodestoneS*?)(?=[^A-Za-z]|$)/gi, "$1冰磁石")
	data = data.replace(/(^|[^A-Za-z])(Augury RockS*?)(?=[^A-Za-z]|$)/gi, "$1占卜之石")
	data = data.replace(/(^|[^A-Za-z])(Skyward ReachS*?)(?=[^A-Za-z]|$)/gi, "$1天际流域")
	data = data.replace(/(^|[^A-Za-z])(Destiny's GorgeS*?)(?=[^A-Za-z]|$)/gi, "$1命运峡谷")
	data = data.replace(/(^|[^A-Za-z])(Prophet's PathS*?)(?=[^A-Za-z]|$)/gi, "$1探索者通道/先知通道")
	data = data.replace(/(^|[^A-Za-z])(Salt FlatsS*?)(?=[^A-Za-z]|$)/gi, "$1盐滩")
	data = data.replace(/(^|[^A-Za-z])(Storm KinS*?)(?=[^A-Za-z]|$)/gi, "$1风暴魔")
	data = data.replace(/(^|[^A-Za-z])(Shriveled EyeS*?)(?=[^A-Za-z]|$)/gi, "$1干枯的眼睛")
	data = data.replace(/(^|[^A-Za-z])(Camp HojanuS*?)(?=[^A-Za-z]|$)/gi, "$1何加努营地")
	data = data.replace(/(^|[^A-Za-z])(Barbarous ShoreS*?)(?=[^A-Za-z]|$)/gi, "$1野蛮河岸")
	data = data.replace(/(^|[^A-Za-z])(CorsairS*?)(?=[^A-Za-z]|$)/gi, "$1海盗")
	data = data.replace(/(^|[^A-Za-z])(Gold DoubloonS*?)(?=[^A-Za-z]|$)/gi, "$1金古币")
	data = data.replace(/(^|[^A-Za-z])(Dragon's ThroatS*?)(?=[^A-Za-z]|$)/gi, "$1龙喉")
	data = data.replace(/(^|[^A-Za-z])(Shadow's PassageS*?)(?=[^A-Za-z]|$)/gi, "$1阴暗通道")
	data = data.replace(/(^|[^A-Za-z])(rare material traderS*?)(?=[^A-Za-z]|$)/gi, "$1稀有材料商")
	data = data.replace(/(^|[^A-Za-z])(Jadeite ShardS*?)(?=[^A-Za-z]|$)/gi, "$1硬玉")
	data = data.replace(/(^|[^A-Za-z])(Port SledgeS*?)(?=[^A-Za-z]|$)/gi, "$1雪橇港")
	data = data.replace(/(^|[^A-Za-z])(Witman's FollyS*?)(?=[^A-Za-z]|$)/gi, "$1威特曼的怪异建筑")
	data = data.replace(/(^|[^A-Za-z])(GrawlS*?)(?=[^A-Za-z]|$)/gi, "$1穴居人")
	data = data.replace(/(^|[^A-Za-z])(Grawl CroneS*?)(?=[^A-Za-z]|$)/gi, "$1穴居人巫婆")
	data = data.replace(/(^|[^A-Za-z])(Intricate Grawl NecklaceS*?)(?=[^A-Za-z]|$)/gi, "$1精细的穴居人项链")
	data = data.replace(/(^|[^A-Za-z])(The Mouth of TormentS*?)(?=[^A-Za-z]|$)/gi, "$1苦痛之地隘口")
	data = data.replace(/(^|[^A-Za-z])(Crystal OverlookS*?)(?=[^A-Za-z]|$)/gi, "$1水晶高地")
	data = data.replace(/(^|[^A-Za-z])(Ruins of MorahS*?)(?=[^A-Za-z]|$)/gi, "$1摩拉废墟")
	data = data.replace(/(^|[^A-Za-z])(Mandragor Sand DevilS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗沙恶魔")
	data = data.replace(/(^|[^A-Za-z])(Mandragor TerrorS*?)(?=[^A-Za-z]|$)/gi, "$1惊骇曼陀罗")
	data = data.replace(/(^|[^A-Za-z])(Ravenous MandragorS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗贪婪者")
	data = data.replace(/(^|[^A-Za-z])(Luminous StoneS*?)(?=[^A-Za-z]|$)/gi, "$1发亮的石头")
	data = data.replace(/(^|[^A-Za-z])(Dzagonur BastionS*?)(?=[^A-Za-z]|$)/gi, "$1萨岗诺棱堡")
	data = data.replace(/(^|[^A-Za-z])(Wilderness of BahdzaS*?)(?=[^A-Za-z]|$)/gi, "$1巴萨荒野")
	data = data.replace(/(^|[^A-Za-z])(Behemoth GravebaneS*?)(?=[^A-Za-z]|$)/gi, "$1剧毒巨兽")
	data = data.replace(/(^|[^A-Za-z])(Scytheclaw BehemothS*?)(?=[^A-Za-z]|$)/gi, "$1镰刀爪巨兽")
	data = data.replace(/(^|[^A-Za-z])(Behemoth HideS*?)(?=[^A-Za-z]|$)/gi, "$1巨兽皮革")
	data = data.replace(/(^|[^A-Za-z])(Rata SumS*?)(?=[^A-Za-z]|$)/gi, "$1洛达顶点")
	data = data.replace(/(^|[^A-Za-z])(Riven EarthS*?)(?=[^A-Za-z]|$)/gi, "$1撕裂大地")
	data = data.replace(/(^|[^A-Za-z])(RaptorS*?)(?=[^A-Za-z]|$)/gi, "$1毒瑞克斯")
	data = data.replace(/(^|[^A-Za-z])(AngorodonS*?)(?=[^A-Za-z]|$)/gi, "$1安哥罗顿")
	data = data.replace(/(^|[^A-Za-z])(Saurian BoneS*?)(?=[^A-Za-z]|$)/gi, "$1蜥蜴骨头")
	data = data.replace(/(^|[^A-Za-z])(Sanctum CayS*?)(?=[^A-Za-z]|$)/gi, "$1神圣沙滩")
	data = data.replace(/(^|[^A-Za-z])(Stingray StrandS*?)(?=[^A-Za-z]|$)/gi, "$1魟鱼湖滨")
	data = data.replace(/(^|[^A-Za-z])(Fishermen's HavenS*?)(?=[^A-Za-z]|$)/gi, "$1渔人避风港")
	data = data.replace(/(^|[^A-Za-z])(Talmark WildernessS*?)(?=[^A-Za-z]|$)/gi, "$1突马克荒地")
	//地狱小恶魔移上
	data = data.replace(/(^|[^A-Za-z])(Glowing HeartS*?)(?=[^A-Za-z]|$)/gi, "$1灼热的心脏")
	data = data.replace(/(^|[^A-Za-z])(House zu HeltzerS*?)(?=[^A-Za-z]|$)/gi, "$1凤核议院")
	data = data.replace(/(^|[^A-Za-z])(FerndaleS*?)(?=[^A-Za-z]|$)/gi, "$1厥谷")
	data = data.replace(/(^|[^A-Za-z])(Rare crafting materialS*?)(?=[^A-Za-z]|$)/gi, "$1稀有材料")
	data = data.replace(/(^|[^A-Za-z])(Amber ChunkS*?)(?=[^A-Za-z]|$)/gi, "$1琥珀")
	data = data.replace(/(^|[^A-Za-z])(Kurzick BureaucratS*?)(?=[^A-Za-z]|$)/gi, "$1库兹柯理事")
	data = data.replace(/(^|[^A-Za-z])(Kodlonu HamletS*?)(?=[^A-Za-z]|$)/gi, "$1克拓奴‧哈姆雷特")
	data = data.replace(/(^|[^A-Za-z])(Issnur IslesS*?)(?=[^A-Za-z]|$)/gi, "$1伊斯诺岛")
	data = data.replace(/(^|[^A-Za-z])(Irontooth DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1钢牙龙兽")
	data = data.replace(/(^|[^A-Za-z])(Rilohn RefugeS*?)(?=[^A-Za-z]|$)/gi, "$1里欧恩难民营")
	data = data.replace(/(^|[^A-Za-z])(Steelfang DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1硬甲龙兽")
	data = data.replace(/(^|[^A-Za-z])(Chunk of Drake FleshS*?)(?=[^A-Za-z]|$)/gi, "$1大块龙兽肉")
	data = data.replace(/(^|[^A-Za-z])(Chef LonbahnS*?)(?=[^A-Za-z]|$)/gi, "$1大厨 萝韩")
	data = data.replace(/(^|[^A-Za-z])(Drake KabobS*?)(?=[^A-Za-z]|$)/gi, "$1烤龙兽肉")
	data = data.replace(/(^|[^A-Za-z])(Beacon's PerchS*?)(?=[^A-Za-z]|$)/gi, "$1毕肯高地")
	data = data.replace(/(^|[^A-Za-z])(Lornar's PassS*?)(?=[^A-Za-z]|$)/gi, "$1洛拿斯通道")
	data = data.replace(/(^|[^A-Za-z])(Tomb of the Primeval KingsS*?)(?=[^A-Za-z]|$)/gi, "$1先王之墓")
	data = data.replace(/(^|[^A-Za-z])(Banished Dream RiderS*?)(?=[^A-Za-z]|$)/gi, "$1被放逐的梦想骑士")
	data = data.replace(/(^|[^A-Za-z])(Phantom ResidueS*?)(?=[^A-Za-z]|$)/gi, "$1幻影残留物")
	//data=data.replace(/(^|[^A-Za-z])(Zos Shivros ChannelS*?)(?=[^A-Za-z]|$)/gi, '$1山吉之街');
	data = data.replace(/(^|[^A-Za-z])(Nahpui QuarterS*?)(?=[^A-Za-z]|$)/gi, "$1纳普区")
	data = data.replace(/(^|[^A-Za-z])(Nahpui QuarterS*?)(?=[^A-Za-z]|$)/gi, "$1纳普区")
	data = data.replace(/(^|[^A-Za-z])(Essenc*?s*?e of DragonS*?)(?=[^A-Za-z]|$)/gi, "$1龙之质体")
	data = data.replace(/(^|[^A-Za-z])(Essenc*?s*?e of KirinS*?)(?=[^A-Za-z]|$)/gi, "$1麒麟之质体")
	data = data.replace(/(^|[^A-Za-z])(Essenc*?s*?e of PhoenixS*?)(?=[^A-Za-z]|$)/gi, "$1凤之质体")
	data = data.replace(/(^|[^A-Za-z])(Essenc*?s*?e of TurtleS*?)(?=[^A-Za-z]|$)/gi, "$1龟之质体")
	data = data.replace(/(^|[^A-Za-z])(Celestial Essenc*?s*?eS*?)(?=[^A-Za-z]|$)/gi, "$1天神质体")
	data = data.replace(/(^|[^A-Za-z])(The Granite CitadelS*?)(?=[^A-Za-z]|$)/gi, "$1花岗岩堡垒")
	data = data.replace(/(^|[^A-Za-z])(Spearhead PeakS*?)(?=[^A-Za-z]|$)/gi, "$1尖枪山")
	data = data.replace(/(^|[^A-Za-z])(Ice ImpS*?)(?=[^A-Za-z]|$)/gi, "$1冰小恶魔")
	data = data.replace(/(^|[^A-Za-z])(Frigid HeartS*?)(?=[^A-Za-z]|$)/gi, "$1冰冻的心脏")
	data = data.replace(/(^|[^A-Za-z])(Thirsty RiverS*?)(?=[^A-Za-z]|$)/gi, "$1干枯河流")
	data = data.replace(/(^|[^A-Za-z])(The ScarS*?)(?=[^A-Za-z]|$)/gi, "$1断崖")
	data = data.replace(/(^|[^A-Za-z])(Destiny's GorgeS*?)(?=[^A-Za-z]|$)/gi, "$1命运峡谷")
	data = data.replace(/(^|[^A-Za-z])(Augury RockS*?)(?=[^A-Za-z]|$)/gi, "$1占卜之石")
	data = data.replace(/(^|[^A-Za-z])(Skyward ReachS*?)(?=[^A-Za-z]|$)/gi, "$1天际流域")
	data = data.replace(/(^|[^A-Za-z])(HydraS*?)(?=[^A-Za-z]|$)/gi, "$1三头龙")
	data = data.replace(/(^|[^A-Za-z])(Dessicated Hydra ClawS*?)(?=[^A-Za-z]|$)/gi, "$1干燥的三头龙爪")
	data = data.replace(/(^|[^A-Za-z])(Umbral GrottoS*?)(?=[^A-Za-z]|$)/gi, "$1阴影石穴")
	data = data.replace(/(^|[^A-Za-z])(Verdant CascadesS*?)(?=[^A-Za-z]|$)/gi, "$1远野瀑布")
	data = data.replace(/(^|[^A-Za-z])(Skelk ReaperS*?)(?=[^A-Za-z]|$)/gi, "$1司怪收割者")
	data = data.replace(/(^|[^A-Za-z])(Skelk ScourgerS*?)(?=[^A-Za-z]|$)/gi, "$1司怪严惩者")
	data = data.replace(/(^|[^A-Za-z])(Skelk AfflictorS*?)(?=[^A-Za-z]|$)/gi, "$1司怪折磨者")
	data = data.replace(/(^|[^A-Za-z])(Skelk ClawS*?)(?=[^A-Za-z]|$)/gi, "$1司怪爪")
	data = data.replace(/(^|[^A-Za-z])(Vasburg ArmoryS*?)(?=[^A-Za-z]|$)/gi, "$1维思柏兵营")
	data = data.replace(/(^|[^A-Za-z])(Morostav TrailS*?)(?=[^A-Za-z]|$)/gi, "$1摩洛神秘通道")
	data = data.replace(/(^|[^A-Za-z])(Durheim ArchivesS*?)(?=[^A-Za-z]|$)/gi, "$1杜汉姆卷藏室")
	data = data.replace(/(^|[^A-Za-z])(Fungal WallowS*?)(?=[^A-Za-z]|$)/gi, "$1泥泞兽")
	data = data.replace(/(^|[^A-Za-z])(TruffleS*?)(?=[^A-Za-z]|$)/gi, "$1松露")
	data = data.replace(/(^|[^A-Za-z])(Kodlonu HamletS*?)(?=[^A-Za-z]|$)/gi, "$1克拓奴 哈姆雷特")
	data = data.replace(/(^|[^A-Za-z])(Mehtani KeysS*?)(?=[^A-Za-z]|$)/gi, "$1梅坦尼之钥")
	data = data.replace(/(^|[^A-Za-z])(CorsairS*?)(?=[^A-Za-z]|$)/gi, "$1海盗")
	data = data.replace(/(^|[^A-Za-z])(Silver Bullion CoinS*?)(?=[^A-Za-z]|$)/gi, "$1银铸币")
	data = data.replace(/(^|[^A-Za-z])(Camp RankorS*?)(?=[^A-Za-z]|$)/gi, "$1蓝口营地")
	data = data.replace(/(^|[^A-Za-z])(Snake DanceS*?)(?=[^A-Za-z]|$)/gi, "$1蛇舞")
	data = data.replace(/(^|[^A-Za-z])(Blessed GriffonS*?)(?=[^A-Za-z]|$)/gi, "$1被祝福的狮鹫兽")
	data = data.replace(/(^|[^A-Za-z])(Frosted Griffon WingS*?)(?=[^A-Za-z]|$)/gi, "$1冻结的狮鹫兽翅膀")
	data = data.replace(/(^|[^A-Za-z])(Augury RockS*?)(?=[^A-Za-z]|$)/gi, "$1占卜之石")
	data = data.replace(/(^|[^A-Za-z])(Prophet's PathS*?)(?=[^A-Za-z]|$)/gi, "$1先知之路")
	data = data.replace(/(^|[^A-Za-z])(Minotaur (Crystal Desert)S*?)(?=[^A-Za-z]|$)/gi, "$1牛头怪")
	data = data.replace(/(^|[^A-Za-z])(Minotaur HornS*?)(?=[^A-Za-z]|$)/gi, "$1牛头怪角")
	data = data.replace(/(^|[^A-Za-z])(Zin Ku CorridorS*?)(?=[^A-Za-z]|$)/gi, "$1辛库走廊")
	data = data.replace(/(^|[^A-Za-z])(Tahnnakai TempleS*?)(?=[^A-Za-z]|$)/gi, "$1谭纳凯神殿")
	data = data.replace(/(^|[^A-Za-z])(Jade BrotherhoodS*?)(?=[^A-Za-z]|$)/gi, "$1翡翠兄弟会")
	data = data.replace(/(^|[^A-Za-z])(Jade BraceletS*?)(?=[^A-Za-z]|$)/gi, "$1翡翠手镯")
	data = data.replace(/(^|[^A-Za-z])(Zen DaijunS*?)(?=[^A-Za-z]|$)/gi, "$1祯台郡")
	data = data.replace(/(^|[^A-Za-z])(Haiju LagoonS*?)(?=[^A-Za-z]|$)/gi, "$1海幽泻湖")
	data = data.replace(/(^|[^A-Za-z])(Crimson Skull Spirit LordS*?)(?=[^A-Za-z]|$)/gi, "$1红颅灵王")
	data = data.replace(/(^|[^A-Za-z])(Crimson Skull LongbowS*?)(?=[^A-Za-z]|$)/gi, "$1红颅长弓手")
	data = data.replace(/(^|[^A-Za-z])(Crimson Skull MentalistS*?)(?=[^A-Za-z]|$)/gi, "$1红颅心灵使")
	data = data.replace(/(^|[^A-Za-z])(Crimson Skull PriestS*?)(?=[^A-Za-z]|$)/gi, "$1红颅祭司")
	data = data.replace(/(^|[^A-Za-z])(Gold Crimson Skull CoinS*?)(?=[^A-Za-z]|$)/gi, "$1红颅金币")
	data = data.replace(/(^|[^A-Za-z])(Mihanu TownshipS*?)(?=[^A-Za-z]|$)/gi, "$1米哈努小镇")
	data = data.replace(/(^|[^A-Za-z])(Holdings of ChokhinS*?)(?=[^A-Za-z]|$)/gi, "$1舟克辛卷藏室")
	data = data.replace(/(^|[^A-Za-z])(Bull Trainer GiantS*?)(?=[^A-Za-z]|$)/gi, "$1Bull Trainer Giant")
	data = data.replace(/(^|[^A-Za-z])(Pillaged GoodsS*?)(?=[^A-Za-z]|$)/gi, "$1掠夺的货品")
	data = data.replace(/(^|[^A-Za-z])(Lion's ArchS*?)(?=[^A-Za-z]|$)/gi, "$1狮子拱门")
	data = data.replace(/(^|[^A-Za-z])(North Kryta ProvinceS*?)(?=[^A-Za-z]|$)/gi, "$1科瑞塔北部")
	data = data.replace(/(^|[^A-Za-z])(Caromi Tengu BraveS*?)(?=[^A-Za-z]|$)/gi, "$1卡洛米天狗勇士")
	data = data.replace(/(^|[^A-Za-z])(Caromi Tengu WildS*?)(?=[^A-Za-z]|$)/gi, "$1卡洛米天狗野人")
	data = data.replace(/(^|[^A-Za-z])(Caromi Tengu ScoutS*?)(?=[^A-Za-z]|$)/gi, "$1卡洛米天狗射手")
	data = data.replace(/(^|[^A-Za-z])(Feathered Caromi ScalpS*?)(?=[^A-Za-z]|$)/gi, "$1卡洛米羽毛头皮")
	data = data.replace(/(^|[^A-Za-z])(Altrumm RuinsS*?)(?=[^A-Za-z]|$)/gi, "$1奥楚兰废墟")
	data = data.replace(/(^|[^A-Za-z])(ArborstoneS*?)(?=[^A-Za-z]|$)/gi, "$1亭石")
	data = data.replace(/(^|[^A-Za-z])(ArborstoneS*?)(?=[^A-Za-z]|$)/gi, "$1亭石")
	data = data.replace(/(^|[^A-Za-z])(Vasburg ArmoryS*?)(?=[^A-Za-z]|$)/gi, "$1维思柏兵营")
	data = data.replace(/(^|[^A-Za-z])(Morostav TrailS*?)(?=[^A-Za-z]|$)/gi, "$1摩洛神秘通道")
	data = data.replace(/(^|[^A-Za-z])(Stone ReaperS*?)(?=[^A-Za-z]|$)/gi, "$1石之收割者")
	data = data.replace(/(^|[^A-Za-z])(Stone RainS*?)(?=[^A-Za-z]|$)/gi, "$1石之雨")
	data = data.replace(/(^|[^A-Za-z])(Stone SoulS*?)(?=[^A-Za-z]|$)/gi, "$1石之灵")
	data = data.replace(/(^|[^A-Za-z])(Stone CarvingS*?)(?=[^A-Za-z]|$)/gi, "$1石雕品")
	data = data.replace(/(^|[^A-Za-z])(Honur HillS*?)(?=[^A-Za-z]|$)/gi, "$1霍奴尔丘陵")
	data = data.replace(/(^|[^A-Za-z])(Resplendent MakuunS*?)(?=[^A-Za-z]|$)/gi, "$1奢华之城．莫肯")
	data = data.replace(/(^|[^A-Za-z])(Dasha VestibuleS*?)(?=[^A-Za-z]|$)/gi, "$1达沙走廊")
	data = data.replace(/(^|[^A-Za-z])(Key of AhdashimS*?)(?=[^A-Za-z]|$)/gi, "$1哈达辛之钥")
	data = data.replace(/(^|[^A-Za-z])(The Hidden City of AhdashimS*?)(?=[^A-Za-z]|$)/gi, "$1隐藏之城．哈达辛")
	data = data.replace(/(^|[^A-Za-z])(Sapphire Djii*?nn Essenc*?s*?e*?S*?)(?=[^A-Za-z]|$)/gi, "$1蓝宝石巨灵精华")
	data = data.replace(/(^|[^A-Za-z])(Sapphire Djii*?nnS*?)(?=[^A-Za-z]|$)/gi, "$1蓝宝石巨灵")
	data = data.replace(/(^|[^A-Za-z])(Henge of DenraviS*?)(?=[^A-Za-z]|$)/gi, "$1丹拉维圣地")
	data = data.replace(/(^|[^A-Za-z])(Tangle RootS*?)(?=[^A-Za-z]|$)/gi, "$1纠结之恨")
	data = data.replace(/(^|[^A-Za-z])(Jungle TrollS*?)(?=[^A-Za-z]|$)/gi, "$1丛林巨魔")
	data = data.replace(/(^|[^A-Za-z])(Jungle Troll TuskS*?)(?=[^A-Za-z]|$)/gi, "$1丛林巨魔獠牙")
	data = data.replace(/(^|[^A-Za-z])(Wehhan TerracesS*?)(?=[^A-Za-z]|$)/gi, "$1薇恩平台")
	data = data.replace(/(^|[^A-Za-z])(Bahdok CavernsS*?)(?=[^A-Za-z]|$)/gi, "$1巴多克洞穴")
	data = data.replace(/(^|[^A-Za-z])(Pogahn PassageS*?)(?=[^A-Za-z]|$)/gi, "$1波甘驿站")
	data = data.replace(/(^|[^A-Za-z])(Dejarin EstateS*?)(?=[^A-Za-z]|$)/gi, "$1达贾林庄园")
	data = data.replace(/(^|[^A-Za-z])(Cracked MesaS*?)(?=[^A-Za-z]|$)/gi, "$1疯狂梅萨")
	data = data.replace(/(^|[^A-Za-z])(Stone Shard CragS*?)(?=[^A-Za-z]|$)/gi, "$1巨大岩石怪")
	data = data.replace(/(^|[^A-Za-z])(Sentient LodestoneS*?)(?=[^A-Za-z]|$)/gi, "$1知觉磁石")
	data = data.replace(/(^|[^A-Za-z])(Marhan's GrottoS*?)(?=[^A-Za-z]|$)/gi, "$1马翰洞穴")
	data = data.replace(/(^|[^A-Za-z])(Ice FloeS*?)(?=[^A-Za-z]|$)/gi, "$1浮冰")
	data = data.replace(/(^|[^A-Za-z])(Thunderhead KeepS*?)(?=[^A-Za-z]|$)/gi, "$1雷云要塞")
	data = data.replace(/(^|[^A-Za-z])(MursaatS*?)(?=[^A-Za-z]|$)/gi, "$1马赛特")
	data = data.replace(/(^|[^A-Za-z])(Mursaat TokenS*?)(?=[^A-Za-z]|$)/gi, "$1马赛特记号")
	data = data.replace(/(^|[^A-Za-z])(Eye of the NorthS*?)(?=[^A-Za-z]|$)/gi, "$1极地之眼")
	data = data.replace(/(^|[^A-Za-z])(Ice Cliff ChasmsS*?)(?=[^A-Za-z]|$)/gi, "$1冰崖裂口")
	data = data.replace(/(^|[^A-Za-z])(Gwen's gardenS*?)(?=[^A-Za-z]|$)/gi, "$1关的庭园")
	data = data.replace(/(^|[^A-Za-z])(BattledepthsS*?)(?=[^A-Za-z]|$)/gi, "$1战斗深渊")
	data = data.replace(/(^|[^A-Za-z])(Chromatic DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1染色龙兽")
	data = data.replace(/(^|[^A-Za-z])(Chromatic ScaleS*?)(?=[^A-Za-z]|$)/gi, "$1染色的麟片")
	data = data.replace(/(^|[^A-Za-z])(Augury RockS*?)(?=[^A-Za-z]|$)/gi, "$1占卜之石")
	data = data.replace(/(^|[^A-Za-z])(The Arid SeaS*?)(?=[^A-Za-z]|$)/gi, "$1枯竭之海")
	data = data.replace(/(^|[^A-Za-z])(Dunes of DespairS*?)(?=[^A-Za-z]|$)/gi, "$1绝望沙丘")
	data = data.replace(/(^|[^A-Za-z])(Sand GiantS*?)(?=[^A-Za-z]|$)/gi, "$1沙巨人")
	data = data.replace(/(^|[^A-Za-z])(Massive JawboneS*?)(?=[^A-Za-z]|$)/gi, "$1粗大下颚骨")
	data = data.replace(/(^|[^A-Za-z])(Leviathan PitsS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森矿场")
	data = data.replace(/(^|[^A-Za-z])(Gyala HatcheryS*?)(?=[^A-Za-z]|$)/gi, "$1盖拉孵化所")
	data = data.replace(/(^|[^A-Za-z])(Leviathan ClawS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森之爪")
	data = data.replace(/(^|[^A-Za-z])(Leviathan EyeS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森之眼")
	data = data.replace(/(^|[^A-Za-z])(Leviathan MouthS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森之口")
	data = data.replace(/(^|[^A-Za-z])(Moon ShellS*?)(?=[^A-Za-z]|$)/gi, "$1月贝")
	data = data.replace(/(^|[^A-Za-z])(Frontier GateS*?)(?=[^A-Za-z]|$)/gi, "$1边境关所")
	data = data.replace(/(^|[^A-Za-z])(Eastern FrontierS*?)(?=[^A-Za-z]|$)/gi, "$1东方边境")
	data = data.replace(/(^|[^A-Za-z])(Carrion DevourerS*?)(?=[^A-Za-z]|$)/gi, "$1腐肉蝎")
	data = data.replace(/(^|[^A-Za-z])(Whiptail DevourerS*?)(?=[^A-Za-z]|$)/gi, "$1鞭尾蝎")
	data = data.replace(/(^|[^A-Za-z])(Plague DevourerS*?)(?=[^A-Za-z]|$)/gi, "$1瘟疫蝎")
	data = data.replace(/(^|[^A-Za-z])(Fetid CarapaceS*?)(?=[^A-Za-z]|$)/gi, "$1恶臭的甲壳")
	data = data.replace(/(^|[^A-Za-z])(Beacon's PerchS*?)(?=[^A-Za-z]|$)/gi, "$1毕肯高地")
	data = data.replace(/(^|[^A-Za-z])(Deldrimor BowlS*?)(?=[^A-Za-z]|$)/gi, "$1戴尔狄摩盆地")
	data = data.replace(/(^|[^A-Za-z])(Shiverpeak WarriorS*?)(?=[^A-Za-z]|$)/gi, "$1席娃山脉战士")
	data = data.replace(/(^|[^A-Za-z])(Shiverpeak LongbowS*?)(?=[^A-Za-z]|$)/gi, "$1席娃山脉弓手")
	data = data.replace(/(^|[^A-Za-z])(Shiverpeak ProtectorS*?)(?=[^A-Za-z]|$)/gi, "$1席娃山脉守护者")
	data = data.replace(/(^|[^A-Za-z])(Shiverpeak ManeS*?)(?=[^A-Za-z]|$)/gi, "$1席娃山脉鬃毛")
	data = data.replace(/(^|[^A-Za-z])(The MarketplaceS*?)(?=[^A-Za-z]|$)/gi, "$1市集")
	data = data.replace(/(^|[^A-Za-z])(Bukdek BywayS*?)(?=[^A-Za-z]|$)/gi, "$1巴德克小径")
	data = data.replace(/(^|[^A-Za-z])(Branche*?s*? of Juni BerrieS*?)(?=[^A-Za-z]|$)/gi, "$1柳树枝")
	data = data.replace(/(^|[^A-Za-z])(Sunspear SanctuaryS*?)(?=[^A-Za-z]|$)/gi, "$1日戟避难所")
	data = data.replace(/(^|[^A-Za-z])(Marga CoastS*?)(?=[^A-Za-z]|$)/gi, "$1马加海岸")
	data = data.replace(/(^|[^A-Za-z])(RonjokS*?)(?=[^A-Za-z]|$)/gi, "$1罗鸠村")
	data = data.replace(/(^|[^A-Za-z])(ChunoS*?)(?=[^A-Za-z]|$)/gi, "$1周纳")
	data = data.replace(/(^|[^A-Za-z])(Insatiable AppetiteS*?)(?=[^A-Za-z]|$)/gi, "$1贪得无厌的食欲")
	data = data.replace(/(^|[^A-Za-z])(TomaS*?)(?=[^A-Za-z]|$)/gi, "$1托玛")
	data = data.replace(/(^|[^A-Za-z])(Tihark OrchardS*?)(?=[^A-Za-z]|$)/gi, "$1提亚克林地")
	data = data.replace(/(^|[^A-Za-z])(Garden of SeborhinS*?)(?=[^A-Za-z]|$)/gi, "$1希伯欣花园")
	data = data.replace(/(^|[^A-Za-z])(Forum HighlandsS*?)(?=[^A-Za-z]|$)/gi, "$1高地广场")
	data = data.replace(/(^|[^A-Za-z])(Roaring EtherS*?)(?=[^A-Za-z]|$)/gi, "$1苍穹咆哮者")
	data = data.replace(/(^|[^A-Za-z])(Roaring Ether ClawS*?)(?=[^A-Za-z]|$)/gi, "$1苍穹咆哮者之爪")
	data = data.replace(/(^|[^A-Za-z])(Seitung HarborS*?)(?=[^A-Za-z]|$)/gi, "$1青函港")
	data = data.replace(/(^|[^A-Za-z])(Zen DaijunS*?)(?=[^A-Za-z]|$)/gi, "$1祯邰郡")
	data = data.replace(/(^|[^A-Za-z])(Rolls*? of ParchmentS*?)(?=[^A-Za-z]|$)/gi, "$1羊皮纸卷")
	data = data.replace(/(^|[^A-Za-z])(Kaineng CenterS*?)(?=[^A-Za-z]|$)/gi, "$1凯宁中心")
	data = data.replace(/(^|[^A-Za-z])(Xue YiS*?)(?=[^A-Za-z]|$)/gi, "$1薛易")
	data = data.replace(/(^|[^A-Za-z])(Wood PlankS*?)(?=[^A-Za-z]|$)/gi, "$1树木")
	data = data.replace(/(^|[^A-Za-z])(Rolls*? of ParchmentS*?)(?=[^A-Za-z]|$)/gi, "$1羊皮纸卷")
	data = data.replace(/(^|[^A-Za-z])(Doomlore ShrineS*?)(?=[^A-Za-z]|$)/gi, "$1末日传说神殿")
	data = data.replace(/(^|[^A-Za-z])(Dalada UplandsS*?)(?=[^A-Za-z]|$)/gi, "$1达拉达山地")
	data = data.replace(/(^|[^A-Za-z])(Charr SeekerS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔追寻者")
	data = data.replace(/(^|[^A-Za-z])(Charr BlademasterS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔剑术大师")
	data = data.replace(/(^|[^A-Za-z])(Charr ProphetS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔先知")
	data = data.replace(/(^|[^A-Za-z])(Charr FlameshielderS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔避燃者")
	data = data.replace(/(^|[^A-Za-z])(Superb Charr CarvingS*?)(?=[^A-Za-z]|$)/gi, "$1超级夏尔雕刻品")
	data = data.replace(/(^|[^A-Za-z])(OlafsteadS*?)(?=[^A-Za-z]|$)/gi, "$1欧拉夫之地")
	data = data.replace(/(^|[^A-Za-z])(Varajar FellsS*?)(?=[^A-Za-z]|$)/gi, "$1维拉戛阵地")
	data = data.replace(/(^|[^A-Za-z])(Modniir BerserkerS*?)(?=[^A-Za-z]|$)/gi, "$1莫得米狂战士")
	data = data.replace(/(^|[^A-Za-z])(Modniir HunterS*?)(?=[^A-Za-z]|$)/gi, "$1莫得米猎人")
	data = data.replace(/(^|[^A-Za-z])(Modniir ManeS*?)(?=[^A-Za-z]|$)/gi, "$1莫得米鬃毛")
	data = data.replace(/(^|[^A-Za-z])(Leviathan PitsS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森矿场")
	data = data.replace(/(^|[^A-Za-z])(Rhea's CraterS*?)(?=[^A-Za-z]|$)/gi, "$1席亚火山口")
	data = data.replace(/(^|[^A-Za-z])(Outcast WarriorS*?)(?=[^A-Za-z]|$)/gi, "$1被流放的战士")
	data = data.replace(/(^|[^A-Za-z])(Outcast AssassinS*?)(?=[^A-Za-z]|$)/gi, "$1被流放的暗杀者")
	data = data.replace(/(^|[^A-Za-z])(Outcast RitualistS*?)(?=[^A-Za-z]|$)/gi, "$1被流放的祭祀者")
	data = data.replace(/(^|[^A-Za-z])(Majesty's RestS*?)(?=[^A-Za-z]|$)/gi, "$1王者安息地")
	data = data.replace(/(^|[^A-Za-z])(Druid's OverlookS*?)(?=[^A-Za-z]|$)/gi, "$1德鲁伊高地")
	data = data.replace(/(^|[^A-Za-z])(Temple of the AgesS*?)(?=[^A-Za-z]|$)/gi, "$1世纪神殿")
	data = data.replace(/(^|[^A-Za-z])(Thorn DevourerS*?)(?=[^A-Za-z]|$)/gi, "$1棘刺蝎")
	data = data.replace(/(^|[^A-Za-z])(Fevered DevourerS*?)(?=[^A-Za-z]|$)/gi, "$1热病蝎")
	data = data.replace(/(^|[^A-Za-z])(Thorny CarapaceS*?)(?=[^A-Za-z]|$)/gi, "$1多刺的甲壳")
	data = data.replace(/(^|[^A-Za-z])(Bone PalaceS*?)(?=[^A-Za-z]|$)/gi, "$1白骨宫殿")
	data = data.replace(/(^|[^A-Za-z])(The Alkali PanS*?)(?=[^A-Za-z]|$)/gi, "$1金属熔炉")
	data = data.replace(/(^|[^A-Za-z])(Ruby Djii*?nn Essenc*?s*?e*?S*?)(?=[^A-Za-z]|$)/gi, "$1红宝石巨灵精华")
	data = data.replace(/(^|[^A-Za-z])(Ruby Djii*?nnS*?)(?=[^A-Za-z]|$)/gi, "$1红宝石巨灵")
	data = data.replace(/(^|[^A-Za-z])(Piken SquareS*?)(?=[^A-Za-z]|$)/gi, "$1派肯广场")
	data = data.replace(/(^|[^A-Za-z])(The BreachS*?)(?=[^A-Za-z]|$)/gi, "$1缺口")
	data = data.replace(/(^|[^A-Za-z])(AscalonS*?)(?=[^A-Za-z]|$)/gi, "$1阿斯卡隆")
	data = data.replace(/(^|[^A-Za-z])(CharrS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔")
	data = data.replace(/(^|[^A-Za-z])(Charr HideS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔皮")
	data = data.replace(/(^|[^A-Za-z])(Ventari's RefugeS*?)(?=[^A-Za-z]|$)/gi, "$1凡特里庇护所")
	data = data.replace(/(^|[^A-Za-z])(The FallsS*?)(?=[^A-Za-z]|$)/gi, "$1陷落区")
	data = data.replace(/(^|[^A-Za-z])(The Fissure of WoeS*?)(?=[^A-Za-z]|$)/gi, "$1灾难裂痕")
	data = data.replace(/(^|[^A-Za-z])(Forest of the Wailing LordS*?)(?=[^A-Za-z]|$)/gi, "$1悲鸣领主区")
	data = data.replace(/(^|[^A-Za-z])(Gloom SeedS*?)(?=[^A-Za-z]|$)/gi, "$1黑暗种子")
	data = data.replace(/(^|[^A-Za-z])(Breaker HollowS*?)(?=[^A-Za-z]|$)/gi, "$1断崖谷")
	data = data.replace(/(^|[^A-Za-z])(Mount QinkaiS*?)(?=[^A-Za-z]|$)/gi, "$1今凯山")
	data = data.replace(/(^|[^A-Za-z])(Naga WarriorS*?)(?=[^A-Za-z]|$)/gi, "$1迦纳战士")
	data = data.replace(/(^|[^A-Za-z])(Naga ArcherS*?)(?=[^A-Za-z]|$)/gi, "$1迦纳弓手")
	data = data.replace(/(^|[^A-Za-z])(Naga RitualistS*?)(?=[^A-Za-z]|$)/gi, "$1迦纳祭祀者")
	data = data.replace(/(^|[^A-Za-z])(Naga SkinS*?)(?=[^A-Za-z]|$)/gi, "$1迦纳外皮")
	data = data.replace(/(^|[^A-Za-z])(Riverside ProvinceS*?)(?=[^A-Za-z]|$)/gi, "$1河畔地带")
	data = data.replace(/(^|[^A-Za-z])(Twin Serpent LakesS*?)(?=[^A-Za-z]|$)/gi, "$1双头蛇湖泊")
	data = data.replace(/(^|[^A-Za-z])(Lion's ArchS*?)(?=[^A-Za-z]|$)/gi, "$1狮子拱门")
	data = data.replace(/(^|[^A-Za-z])(Bog SkaleS*?)(?=[^A-Za-z]|$)/gi, "$1泥鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Twin Serpent LakesS*?)(?=[^A-Za-z]|$)/gi, "$1双头蛇湖泊")
	data = data.replace(/(^|[^A-Za-z])(Gruhn the FisherS*?)(?=[^A-Za-z]|$)/gi, "$1渔人古露恩")
	data = data.replace(/(^|[^A-Za-z])(Bog Skale FinS*?)(?=[^A-Za-z]|$)/gi, "$1泥鳞怪的鳍")
	data = data.replace(/(^|[^A-Za-z])(HerringS*?)(?=[^A-Za-z]|$)/gi, "$1鲱鱼")
	data = data.replace(/(^|[^A-Za-z])(Doomlore ShrineS*?)(?=[^A-Za-z]|$)/gi, "$1末日传说神殿")
	data = data.replace(/(^|[^A-Za-z])(Sacnoth ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1圣诺谷")
	data = data.replace(/(^|[^A-Za-z])(Grawl ChampionS*?)(?=[^A-Za-z]|$)/gi, "$1穴居人冠军")
	data = data.replace(/(^|[^A-Za-z])(Grawl Dark PriestS*?)(?=[^A-Za-z]|$)/gi, "$1穴居人黑暗祭司")
	data = data.replace(/(^|[^A-Za-z])(Stone Grawl NecklaceS*?)(?=[^A-Za-z]|$)/gi, "$1石穴居人项链")
	data = data.replace(/(^|[^A-Za-z])(Jokanur DiggingsS*?)(?=[^A-Za-z]|$)/gi, "$1卓坎诺挖掘点")
	data = data.replace(/(^|[^A-Za-z])(Fahranur, The First CityS*?)(?=[^A-Za-z]|$)/gi, "$1旧城 法兰努尔")
	data = data.replace(/(^|[^A-Za-z])(Beautiful IbogaS*?)(?=[^A-Za-z]|$)/gi, "$1美丽伊波枷")
	data = data.replace(/(^|[^A-Za-z])(Fanged IbogaS*?)(?=[^A-Za-z]|$)/gi, "$1毒牙伊波枷")
	data = data.replace(/(^|[^A-Za-z])(Sentient SeedS*?)(?=[^A-Za-z]|$)/gi, "$1知觉种子")
	data = data.replace(/(^|[^A-Za-z])(Seitung HarborS*?)(?=[^A-Za-z]|$)/gi, "$1青函港")
	data = data.replace(/(^|[^A-Za-z])(Saoshang TrailS*?)(?=[^A-Za-z]|$)/gi, "$1绍商小径")
	data = data.replace(/(^|[^A-Za-z])(Mantid DarkwingS*?)(?=[^A-Za-z]|$)/gi, "$1螳螂黑翼")
	data = data.replace(/(^|[^A-Za-z])(Mantid GlitterfangS*?)(?=[^A-Za-z]|$)/gi, "$1螳螂锐牙")
	data = data.replace(/(^|[^A-Za-z])(Mantid PincerS*?)(?=[^A-Za-z]|$)/gi, "$1螳螂镰")
	data = data.replace(/(^|[^A-Za-z])(Ember Light CampS*?)(?=[^A-Za-z]|$)/gi, "$1残火营地")
	data = data.replace(/(^|[^A-Za-z])(Perdition RockS*?)(?=[^A-Za-z]|$)/gi, "$1破灭石")
	data = data.replace(/(^|[^A-Za-z])(Mahgo HydraS*?)(?=[^A-Za-z]|$)/gi, "$1码果三头龙")
	data = data.replace(/(^|[^A-Za-z])(Mahgo ClawS*?)(?=[^A-Za-z]|$)/gi, "$1码果的爪")
	data = data.replace(/(^|[^A-Za-z])(Yohlon HavenS*?)(?=[^A-Za-z]|$)/gi, "$1犹朗避难所")
	data = data.replace(/(^|[^A-Za-z])(Arkjok WardS*?)(?=[^A-Za-z]|$)/gi, "$1阿尔科监禁区")
	data = data.replace(/(^|[^A-Za-z])(Mandragor ImpS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗恶魔")
	data = data.replace(/(^|[^A-Za-z])(Mandragor SlitherS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗撕裂者")
	data = data.replace(/(^|[^A-Za-z])(Mandragor RootS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗根")
	data = data.replace(/(^|[^A-Za-z])(Yohlon HavenS*?)(?=[^A-Za-z]|$)/gi, "$1犹朗避难所")
	data = data.replace(/(^|[^A-Za-z])(YajideS*?)(?=[^A-Za-z]|$)/gi, "$1叶吉达")
	data = data.replace(/(^|[^A-Za-z])(Mandragor Root CakeS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗根糕点")
	data = data.replace(/(^|[^A-Za-z])(Mandragor RootS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗根")
	data = data.replace(/(^|[^A-Za-z])(Snake DanceS*?)(?=[^A-Za-z]|$)/gi, "$1蛇舞")
	data = data.replace(/(^|[^A-Za-z])(Dreadnought's DriftS*?)(?=[^A-Za-z]|$)/gi, "$1无惧者之丘")
	data = data.replace(/(^|[^A-Za-z])(Beacon's PerchS*?)(?=[^A-Za-z]|$)/gi, "$1毕肯高地")
	data = data.replace(/(^|[^A-Za-z])(Deldrimor War CampS*?)(?=[^A-Za-z]|$)/gi, "$1戴尔狄摩兵营")
	data = data.replace(/(^|[^A-Za-z])(Azure ShadowS*?)(?=[^A-Za-z]|$)/gi, "$1湛蓝阴影")
	data = data.replace(/(^|[^A-Za-z])(Azure RemainS*?)(?=[^A-Za-z]|$)/gi, "$1湛蓝残留物")
	data = data.replace(/(^|[^A-Za-z])(The MarketplaceS*?)(?=[^A-Za-z]|$)/gi, "$1市集")
	data = data.replace(/(^|[^A-Za-z])(Wajjun BazaarS*?)(?=[^A-Za-z]|$)/gi, "$1瓦江市场")
	data = data.replace(/(^|[^A-Za-z])(Am FahS*?)(?=[^A-Za-z]|$)/gi, "$1安费")
	data = data.replace(/(^|[^A-Za-z])(Plague IdolS*?)(?=[^A-Za-z]|$)/gi, "$1瘟疫法器")
	data = data.replace(/(^|[^A-Za-z])(Tarnished HavenS*?)(?=[^A-Za-z]|$)/gi, "$1灰暗避难所")
	data = data.replace(/(^|[^A-Za-z])(Alcazia TangleS*?)(?=[^A-Za-z]|$)/gi, "$1纠结之艾卡滋亚")
	data = data.replace(/(^|[^A-Za-z])(Umbral GrottoS*?)(?=[^A-Za-z]|$)/gi, "$1阴影石穴")
	data = data.replace(/(^|[^A-Za-z])(Verdant CascadesS*?)(?=[^A-Za-z]|$)/gi, "$1原野瀑布")
	data = data.replace(/(^|[^A-Za-z])(Quetzal CrestS*?)(?=[^A-Za-z]|$)/gi, "$1长尾冠毛")
	data = data.replace(/(^|[^A-Za-z])(QuetzalS*?)(?=[^A-Za-z]|$)/gi, "$1长尾")
	data = data.replace(/(^|[^A-Za-z])(The Mouth of TormentS*?)(?=[^A-Za-z]|$)/gi, "$1苦痛之地隘口")
	data = data.replace(/(^|[^A-Za-z])(Poisoned OutcropsS*?)(?=[^A-Za-z]|$)/gi, "$1剧毒地表")
	data = data.replace(/(^|[^A-Za-z])(MargoniteS*?)(?=[^A-Za-z]|$)/gi, "$1玛骨奈")
	data = data.replace(/(^|[^A-Za-z])(Margonite MaskS*?)(?=[^A-Za-z]|$)/gi, "$1玛骨奈面具")
	data = data.replace(/(^|[^A-Za-z])(The Granite CitadelS*?)(?=[^A-Za-z]|$)/gi, "$1花岗岩堡垒")
	data = data.replace(/(^|[^A-Za-z])(Tasca's DemiseS*?)(?=[^A-Za-z]|$)/gi, "$1塔斯加之死")
	data = data.replace(/(^|[^A-Za-z])(Mineral SpringsS*?)(?=[^A-Za-z]|$)/gi, "$1矿物泉源")
	data = data.replace(/(^|[^A-Za-z])(TenguS*?)(?=[^A-Za-z]|$)/gi, "$1天狗")
	data = data.replace(/(^|[^A-Za-z])(AvicaraS*?)(?=[^A-Za-z]|$)/gi, "$1阿比卡拉")
	data = data.replace(/(^|[^A-Za-z])(Feathered Avicara ScalpS*?)(?=[^A-Za-z]|$)/gi, "$1阿比卡拉头皮羽毛")
	data = data.replace(/(^|[^A-Za-z])(Fort RanikS*?)(?=[^A-Za-z]|$)/gi, "$1瑞尼克要塞")
	data = data.replace(/(^|[^A-Za-z])(Regent ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1统治者之谷")
	data = data.replace(/(^|[^A-Za-z])(Red Iris FlowerS*?)(?=[^A-Za-z]|$)/gi, "$1红色鸢尾花")
	data = data.replace(/(^|[^A-Za-z])(Grendich CourthouseS*?)(?=[^A-Za-z]|$)/gi, "$1葛兰迪法院")
	data = data.replace(/(^|[^A-Za-z])(Flame Temple CorridorS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔火焰神殿")
	data = data.replace(/(^|[^A-Za-z])(CharrS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔")
	data = data.replace(/(^|[^A-Za-z])(Charr CarvingS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔雕刻品")
	//data=data.replace(/(^|[^A-Za-z])(Yak's BendS*?)(?=[^A-Za-z]|$)/gi, '$1牦牛村');
	data = data.replace(/(^|[^A-Za-z])(Traveler's ValeS*?)(?=[^A-Za-z]|$)/gi, "$1旅人谷")
	data = data.replace(/(^|[^A-Za-z])(Rare material traderS*?)(?=[^A-Za-z]|$)/gi, "$1稀有材料商人")
	data = data.replace(/(^|[^A-Za-z])(Bolts*? of LinenS*?)(?=[^A-Za-z]|$)/gi, "$1亚麻布")
	data = data.replace(/(^|[^A-Za-z])(ArtisanS*?)(?=[^A-Za-z]|$)/gi, "$1工匠")
	data = data.replace(/(^|[^A-Za-z])(Plant Fie*?berS*?)(?=[^A-Za-z]|$)/gi, "$1植物纤维")
	data = data.replace(/(^|[^A-Za-z])(Gunnar's HoldS*?)(?=[^A-Za-z]|$)/gi, "$1甘拿的占领地")
	data = data.replace(/(^|[^A-Za-z])(Norrhart DomainsS*?)(?=[^A-Za-z]|$)/gi, "$1诺恩之心领地")
	data = data.replace(/(^|[^A-Za-z])(Dreamroot MandragorS*?)(?=[^A-Za-z]|$)/gi, "$1梦之根曼陀罗")
	data = data.replace(/(^|[^A-Za-z])(Mandragor ScavengerS*?)(?=[^A-Za-z]|$)/gi, "$1拾荒曼陀罗")
	data = data.replace(/(^|[^A-Za-z])(Mystic MandragorS*?)(?=[^A-Za-z]|$)/gi, "$1秘教曼陀罗")
	data = data.replace(/(^|[^A-Za-z])(Ulcerous MandragorS*?)(?=[^A-Za-z]|$)/gi, "$1已腐蚀曼陀罗")
	data = data.replace(/(^|[^A-Za-z])(Frigid Mandragor HuskS*?)(?=[^A-Za-z]|$)/gi, "$1呆板曼陀罗外壳")
	data = data.replace(/(^|[^A-Za-z])(Champion's DawnS*?)(?=[^A-Za-z]|$)/gi, "$1勇士曙光")
	data = data.replace(/(^|[^A-Za-z])(Cliffs of DohjokS*?)(?=[^A-Za-z]|$)/gi, "$1杜夏悬崖")
	data = data.replace(/(^|[^A-Za-z])(CorsairS*?)(?=[^A-Za-z]|$)/gi, "$1海盗")
	data = data.replace(/(^|[^A-Za-z])(Copper ShillingS*?)(?=[^A-Za-z]|$)/gi, "$1铜先令")
	data = data.replace(/(^|[^A-Za-z])(The WildsS*?)(?=[^A-Za-z]|$)/gi, "$1荒原")
	data = data.replace(/(^|[^A-Za-z])(Sage LandsS*?)(?=[^A-Za-z]|$)/gi, "$1贤者领地")
	data = data.replace(/(^|[^A-Za-z])(Wind Riders*?)(?=[^A-Za-z]|$)/gi, "$1驭风者")
	data = data.replace(/(^|[^A-Za-z])(Ancient EyeS*?)(?=[^A-Za-z]|$)/gi, "$1远古之眼")
	data = data.replace(/(^|[^A-Za-z])(Sunspear SanctuaryS*?)(?=[^A-Za-z]|$)/gi, "$1日戟避难所")
	data = data.replace(/(^|[^A-Za-z])(Sunward MarchesS*?)(?=[^A-Za-z]|$)/gi, "$1向阳边境")
	data = data.replace(/(^|[^A-Za-z])(Mirage IbogaS*?)(?=[^A-Za-z]|$)/gi, "$1幻象伊波枷")
	data = data.replace(/(^|[^A-Za-z])(Murmuring ThornbrushS*?)(?=[^A-Za-z]|$)/gi, "$1荆棘之藤")
	data = data.replace(/(^|[^A-Za-z])(Sentient SporeS*?)(?=[^A-Za-z]|$)/gi, "$1知觉孢子")
	data = data.replace(/(^|[^A-Za-z])(Gates of KrytaS*?)(?=[^A-Za-z]|$)/gi, "$1科瑞塔关所")
	data = data.replace(/(^|[^A-Za-z])(Scoundrel's RiseS*?)(?=[^A-Za-z]|$)/gi, "$1恶汉山丘")
	data = data.replace(/(^|[^A-Za-z])(Bog Skale FinS*?)(?=[^A-Za-z]|$)/gi, "$1泥鳞怪的鳍")
	data = data.replace(/(^|[^A-Za-z])(Bog SkaleS*?)(?=[^A-Za-z]|$)/gi, "$1泥鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Zos Shivros ChannelS*?)(?=[^A-Za-z]|$)/gi, "$1佐席洛斯水道")
	data = data.replace(/(^|[^A-Za-z])(Boreas SeabedS*?)(?=[^A-Za-z]|$)/gi, "$1风神海床")
	data = data.replace(/(^|[^A-Za-z])(Kraken SpawnS*?)(?=[^A-Za-z]|$)/gi, "$1海妖卵")
	data = data.replace(/(^|[^A-Za-z])(Kraken EyeS*?)(?=[^A-Za-z]|$)/gi, "$1海妖之眼")
	data = data.replace(/(^|[^A-Za-z])(Grendich CourthouseS*?)(?=[^A-Za-z]|$)/gi, "$1葛兰迪法院")
	data = data.replace(/(^|[^A-Za-z])(Flame Temple CorridorS*?)(?=[^A-Za-z]|$)/gi, "$1夏尔火焰神殿")
	data = data.replace(/(^|[^A-Za-z])(Dragon's GulletS*?)(?=[^A-Za-z]|$)/gi, "$1巨龙峡谷")
	data = data.replace(/(^|[^A-Za-z])(Abomination (NPC)S*?)(?=[^A-Za-z]|$)/gi, "$1憎恨者")
	data = data.replace(/(^|[^A-Za-z])(Gruesome RibcageS*?)(?=[^A-Za-z]|$)/gi, "$1可怕的胸腔")
	data = data.replace(/(^|[^A-Za-z])(Longeye's LedgeS*?)(?=[^A-Za-z]|$)/gi, "$1长眼岩脉")
	data = data.replace(/(^|[^A-Za-z])(Grothmar WardownsS*?)(?=[^A-Za-z]|$)/gi, "$1古斯玛战争丘陵地")
	data = data.replace(/(^|[^A-Za-z])(Mandragor Dust DevilS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗尘魔")
	data = data.replace(/(^|[^A-Za-z])(Mandragor Smoke DevilS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗烟魔")
	data = data.replace(/(^|[^A-Za-z])(Vile MandragorS*?)(?=[^A-Za-z]|$)/gi, "$1暗黑曼陀罗")
	data = data.replace(/(^|[^A-Za-z])(Fibrous Mandragor RootS*?)(?=[^A-Za-z]|$)/gi, "$1纤维曼陀罗根")
	data = data.replace(/(^|[^A-Za-z])(Chantry of SecretsS*?)(?=[^A-Za-z]|$)/gi, "$1隐密教堂")
	data = data.replace(/(^|[^A-Za-z])(Yatendi CanyonsS*?)(?=[^A-Za-z]|$)/gi, "$1亚天帝峡谷")
	data = data.replace(/(^|[^A-Za-z])(Rain BeetleS*?)(?=[^A-Za-z]|$)/gi, "$1雨甲虫")
	data = data.replace(/(^|[^A-Za-z])(Rock BeetleS*?)(?=[^A-Za-z]|$)/gi, "$1石甲虫")
	data = data.replace(/(^|[^A-Za-z])(GeodeS*?)(?=[^A-Za-z]|$)/gi, "$1晶石")
	data = data.replace(/(^|[^A-Za-z])(Vizunah Square (Local Quarter)S*?)(?=[^A-Za-z]|$)/gi, "$1薇茹广场本地")
	data = data.replace(/(^|[^A-Za-z])(The UndercityS*?)(?=[^A-Za-z]|$)/gi, "$1地下城")
	data = data.replace(/(^|[^A-Za-z])(Kappa (level 20)S*?)(?=[^A-Za-z]|$)/gi, "$1河童")
	data = data.replace(/(^|[^A-Za-z])(Ancient Kappa ShellS*?)(?=[^A-Za-z]|$)/gi, "$1古河童壳")
	data = data.replace(/(^|[^A-Za-z])(Temple of the AgesS*?)(?=[^A-Za-z]|$)/gi, "$1世纪神殿")
	data = data.replace(/(^|[^A-Za-z])(The Black CurtainS*?)(?=[^A-Za-z]|$)/gi, "$1黑色帷幕")
	data = data.replace(/(^|[^A-Za-z])(Fog NightmareS*?)(?=[^A-Za-z]|$)/gi, "$1迷雾梦靥")
	data = data.replace(/(^|[^A-Za-z])(Shadowy RemnantsS*?)(?=[^A-Za-z]|$)/gi, "$1阴影残留物")
	data = data.replace(/(^|[^A-Za-z])(Remains of SahlahjaS*?)(?=[^A-Za-z]|$)/gi, "$1萨拉迦遗址")
	data = data.replace(/(^|[^A-Za-z])(The Sulfurous WastesS*?)(?=[^A-Za-z]|$)/gi, "$1硫磺荒地")
	data = data.replace(/(^|[^A-Za-z])(Awakened CavalierS*?)(?=[^A-Za-z]|$)/gi, "$1觉醒的骑士")
	data = data.replace(/(^|[^A-Za-z])(Mummy WrappingS*?)(?=[^A-Za-z]|$)/gi, "$1木乃伊裹尸布")
	data = data.replace(/(^|[^A-Za-z])(Tsumei VillageS*?)(?=[^A-Za-z]|$)/gi, "$1苏梅村")
	data = data.replace(/(^|[^A-Za-z])(Sunqua ValeS*?)(?=[^A-Za-z]|$)/gi, "$1桑泉谷")
	data = data.replace(/(^|[^A-Za-z])(SensaliS*?)(?=[^A-Za-z]|$)/gi, "$1圣沙利天狗")
	data = data.replace(/(^|[^A-Za-z])(Feathered ScalpS*?)(?=[^A-Za-z]|$)/gi, "$1羽头皮")
	data = data.replace(/(^|[^A-Za-z])(Bone PalaceS*?)(?=[^A-Za-z]|$)/gi, "$1白骨宫殿")
	data = data.replace(/(^|[^A-Za-z])(Joko's DomainS*?)(?=[^A-Za-z]|$)/gi, "$1杰格领地")
	data = data.replace(/(^|[^A-Za-z])(Gate of TormentS*?)(?=[^A-Za-z]|$)/gi, "$1苦痛之门")
	data = data.replace(/(^|[^A-Za-z])(Nightfallen JahaiS*?)(?=[^A-Za-z]|$)/gi, "$1夜蚀暗殒 夏亥")
	data = data.replace(/(^|[^A-Za-z])(Graven MonolithS*?)(?=[^A-Za-z]|$)/gi, "$1铭刻石雕")
	data = data.replace(/(^|[^A-Za-z])(Inscribed ShardS*?)(?=[^A-Za-z]|$)/gi, "$1铭刻碎片")
	data = data.replace(/(^|[^A-Za-z])(Vlox's FallsS*?)(?=[^A-Za-z]|$)/gi, "$1弗洛克斯瀑布")
	data = data.replace(/(^|[^A-Za-z])(Arbor BayS*?)(?=[^A-Za-z]|$)/gi, "$1亚伯湾")
	data = data.replace(/(^|[^A-Za-z])(Krait SkinS*?)(?=[^A-Za-z]|$)/gi, "$1环蛇皮")
	data = data.replace(/(^|[^A-Za-z])(KraitS*?)(?=[^A-Za-z]|$)/gi, "$1环蛇")
	data = data.replace(/(^|[^A-Za-z])(The Granite CitadelS*?)(?=[^A-Za-z]|$)/gi, "$1花岗岩堡垒")
	data = data.replace(/(^|[^A-Za-z])(Tasca's DemiseS*?)(?=[^A-Za-z]|$)/gi, "$1塔斯加之死")
	data = data.replace(/(^|[^A-Za-z])(Stone Summit BadgeS*?)(?=[^A-Za-z]|$)/gi, "$1石峰标志")
	data = data.replace(/(^|[^A-Za-z])(Stone SummitS*?)(?=[^A-Za-z]|$)/gi, "$1石峰矮人")
	data = data.replace(/(^|[^A-Za-z])(Defend Droknar's ForgeS*?)(?=[^A-Za-z]|$)/gi, "$1保卫卓克纳熔炉")
	data = data.replace(/(^|[^A-Za-z])(Lutgardis ConservatoryS*?)(?=[^A-Za-z]|$)/gi, "$1路嘉蒂斯温室")
	data = data.replace(/(^|[^A-Za-z])(Melandru's HopeS*?)(?=[^A-Za-z]|$)/gi, "$1梅兰朵的盼望")
	data = data.replace(/(^|[^A-Za-z])(Echovald ForestS*?)(?=[^A-Za-z]|$)/gi, "$1科凡德森林")
	data = data.replace(/(^|[^A-Za-z])(Dredge IncisorS*?)(?=[^A-Za-z]|$)/gi, "$1挖掘者之牙")
	data = data.replace(/(^|[^A-Za-z])(DredgeS*?)(?=[^A-Za-z]|$)/gi, "$1挖掘者")
	data = data.replace(/(^|[^A-Za-z])(Grendich CourthouseS*?)(?=[^A-Za-z]|$)/gi, "$1葛兰迪法院")
	data = data.replace(/(^|[^A-Za-z])(Diessa LowlandsS*?)(?=[^A-Za-z]|$)/gi, "$1底耶沙低地")
	data = data.replace(/(^|[^A-Za-z])(GargoyleS*?)(?=[^A-Za-z]|$)/gi, "$1石像鬼")
	data = data.replace(/(^|[^A-Za-z])(Flash GargoyleS*?)(?=[^A-Za-z]|$)/gi, "$1迅速石像鬼")
	data = data.replace(/(^|[^A-Za-z])(Shatter GargoyleS*?)(?=[^A-Za-z]|$)/gi, "$1破碎石像鬼")
	data = data.replace(/(^|[^A-Za-z])(Resurrect GargoyleS*?)(?=[^A-Za-z]|$)/gi, "$1复活石像鬼")
	data = data.replace(/(^|[^A-Za-z])(Singed Gargoyle SkullS*?)(?=[^A-Za-z]|$)/gi, "$1烧焦的石像鬼头颅")
	data = data.replace(/(^|[^A-Za-z])(Pogahn PassageS*?)(?=[^A-Za-z]|$)/gi, "$1波甘驿站")
	data = data.replace(/(^|[^A-Za-z])(Gandara, the Moon FortressS*?)(?=[^A-Za-z]|$)/gi, "$1弦月要塞 干达拉")
	data = data.replace(/(^|[^A-Za-z])(Kournan militaryS*?)(?=[^A-Za-z]|$)/gi, "$1高楠士兵")
	data = data.replace(/(^|[^A-Za-z])(Kournan PendantS*?)(?=[^A-Za-z]|$)/gi, "$1高楠垂饰")
	data = data.replace(/(^|[^A-Za-z])(Sunji*?ang DistrictS*?)(?=[^A-Za-z]|$)/gi, "$1孙江行政区")
	data = data.replace(/(^|[^A-Za-z])(Shenzun TunnelsS*?)(?=[^A-Za-z]|$)/gi, "$1申赞通道")
	data = data.replace(/(^|[^A-Za-z])(Plant FiberS*?)(?=[^A-Za-z]|$)/gi, "$1植物纤维")
	data = data.replace(/(^|[^A-Za-z])(Tempered Glass VialS*?)(?=[^A-Za-z]|$)/gi, "$1调合后的玻璃瓶")
	data = data.replace(/(^|[^A-Za-z])(Kaineng CenterS*?)(?=[^A-Za-z]|$)/gi, "$1凯宁中心")
	data = data.replace(/(^|[^A-Za-z])(Vials*? of InkS*?)(?=[^A-Za-z]|$)/gi, "$1小瓶油水")
	data = data.replace(/(^|[^A-Za-z])(Camp RankorS*?)(?=[^A-Za-z]|$)/gi, "$1蓝口营地")
	data = data.replace(/(^|[^A-Za-z])(Talus ChuteS*?)(?=[^A-Za-z]|$)/gi, "$1碎石坡道")
	data = data.replace(/(^|[^A-Za-z])(Mountain TrollS*?)(?=[^A-Za-z]|$)/gi, "$1山巨魔")
	data = data.replace(/(^|[^A-Za-z])(Mountain Troll TuskS*?)(?=[^A-Za-z]|$)/gi, "$1山巨魔獠牙")
	data = data.replace(/(^|[^A-Za-z])(Kodonur CrossroadsS*?)(?=[^A-Za-z]|$)/gi, "$1科登诺路口")
	data = data.replace(/(^|[^A-Za-z])(Dejarin EstateS*?)(?=[^A-Za-z]|$)/gi, "$1达贾林庄")
	data = data.replace(/(^|[^A-Za-z])(Blue Tongue HeketS*?)(?=[^A-Za-z]|$)/gi, "$1蓝舌哈克蛙")
	data = data.replace(/(^|[^A-Za-z])(Beast Sworn HeketS*?)(?=[^A-Za-z]|$)/gi, "$1野性哈克蛙")
	data = data.replace(/(^|[^A-Za-z])(Blood Cowl HeketS*?)(?=[^A-Za-z]|$)/gi, "$1冷血哈克蛙")
	data = data.replace(/(^|[^A-Za-z])(Heket TongueS*?)(?=[^A-Za-z]|$)/gi, "$1哈克蛙舌")
	data = data.replace(/(^|[^A-Za-z])(Longeye's LedgeS*?)(?=[^A-Za-z]|$)/gi, "$1长眼岩脉")
	data = data.replace(/(^|[^A-Za-z])(Bjora MarchesS*?)(?=[^A-Za-z]|$)/gi, "$1碧拉边境")
	data = data.replace(/(^|[^A-Za-z])(Jotun SkullsmasherS*?)(?=[^A-Za-z]|$)/gi, "$1碎骨角顿")
	data = data.replace(/(^|[^A-Za-z])(Jotun MindbreakerS*?)(?=[^A-Za-z]|$)/gi, "$1断绪角顿")
	data = data.replace(/(^|[^A-Za-z])(Jotun BladeturnerS*?)(?=[^A-Za-z]|$)/gi, "$1转刃角顿")
	data = data.replace(/(^|[^A-Za-z])(Jotun PeltS*?)(?=[^A-Za-z]|$)/gi, "$1角顿皮毛")
	data = data.replace(/(^|[^A-Za-z])(Harvest TempleS*?)(?=[^A-Za-z]|$)/gi, "$1丰收神殿")
	data = data.replace(/(^|[^A-Za-z])(Unwaking WatersS*?)(?=[^A-Za-z]|$)/gi, "$1沉睡之水")
	data = data.replace(/(^|[^A-Za-z])(Saltspray DragonS*?)(?=[^A-Za-z]|$)/gi, "$1盐雾之龙")
	data = data.replace(/(^|[^A-Za-z])(Rockhide DragonS*?)(?=[^A-Za-z]|$)/gi, "$1岩皮之龙")
	data = data.replace(/(^|[^A-Za-z])(Azure CrestS*?)(?=[^A-Za-z]|$)/gi, "$1湛蓝羽冠")
	data = data.replace(/(^|[^A-Za-z])(Yak|YAKK*?I*?N*?G*?T*?O*?N*?)(?=[^A-Za-z]|$)/gi, "$1牦牛")
	data = data.replace(/(^|[^A-Za-z])(Ascalon FoothillsS*?)(?=[^A-Za-z]|$)/gi, "$1阿斯卡隆丘陵")
	data = data.replace(/(^|[^A-Za-z])(HydraS*?)(?=[^A-Za-z]|$)/gi, "$1三头龙")
	data = data.replace(/(^|[^A-Za-z])(Leathery ClawS*?)(?=[^A-Za-z]|$)/gi, "$1强韧的爪")
	data = data.replace(/(^|[^A-Za-z])(Grand Court of SebelkehS*?)(?=[^A-Za-z]|$)/gi, "$1希贝克大宫廷")
	data = data.replace(/(^|[^A-Za-z])(The Mirror of LyssS*?)(?=[^A-Za-z]|$)/gi, "$1丽之镜湖")
	data = data.replace(/(^|[^A-Za-z])(Roaring Ether HeartS*?)(?=[^A-Za-z]|$)/gi, "$1苍穹咆啸者之心")
	data = data.replace(/(^|[^A-Za-z])(Roaring EtherS*?)(?=[^A-Za-z]|$)/gi, "$1苍穹咆啸者")
	data = data.replace(/(^|[^A-Za-z])(Senji's CornerS*?)(?=[^A-Za-z]|$)/gi, "$1山吉之街")
	data = data.replace(/(^|[^A-Za-z])(Xaquang SkywayS*?)(?=[^A-Za-z]|$)/gi, "$1夏安便道")
	data = data.replace(/(^|[^A-Za-z])(Vermin HideS*?)(?=[^A-Za-z]|$)/gi, "$1寄生虫皮革")
	data = data.replace(/(^|[^A-Za-z])(VerminS*?)(?=[^A-Za-z]|$)/gi, "$1寄生虫")
	data = data.replace(/(^|[^A-Za-z])(Sunspear Great HallS*?)(?=[^A-Za-z]|$)/gi, "$1日戟大会堂")
	data = data.replace(/(^|[^A-Za-z])(Plains of JarinS*?)(?=[^A-Za-z]|$)/gi, "$1贾林平原")
	data = data.replace(/(^|[^A-Za-z])(Fanged IbogaS*?)(?=[^A-Za-z]|$)/gi, "$1尖牙伊波茄")
	data = data.replace(/(^|[^A-Za-z])(Iboga PetalS*?)(?=[^A-Za-z]|$)/gi, "$1伊波茄花瓣")
	data = data.replace(/(^|[^A-Za-z])(Champion's DawnS*?)(?=[^A-Za-z]|$)/gi, "$1勇士曙光")
	data = data.replace(/(^|[^A-Za-z])(Chef VolonS*?)(?=[^A-Za-z]|$)/gi, "$1大厨 瓦隆")
	data = data.replace(/(^|[^A-Za-z])(Pahnai SaladS*?|Panhai Salads*?)(?=[^A-Za-z]|$)/gi, "$1伊波茄沙拉")
	data = data.replace(/(^|[^A-Za-z])(Seitung HarborS*?)(?=[^A-Za-z]|$)/gi, "$1青函港")
	data = data.replace(/(^|[^A-Za-z])(Jaya BluffsS*?)(?=[^A-Za-z]|$)/gi, "$1蛇野断崖")
	data = data.replace(/(^|[^A-Za-z])(Mountain YetiS*?)(?=[^A-Za-z]|$)/gi, "$1山雪怪")
	data = data.replace(/(^|[^A-Za-z])(Longhair YetiS*?)(?=[^A-Za-z]|$)/gi, "$1长毛雪怪")
	data = data.replace(/(^|[^A-Za-z])(Red YetiS*?)(?=[^A-Za-z]|$)/gi, "$1红雪怪")
	data = data.replace(/(^|[^A-Za-z])(Stolen SuppliesS*?)(?=[^A-Za-z]|$)/gi, "$1失窃的补给品")
	data = data.replace(/(^|[^A-Za-z])(Aurora GladeS*?)(?=[^A-Za-z]|$)/gi, "$1欧若拉林地")
	data = data.replace(/(^|[^A-Za-z])(Ettin's BackS*?)(?=[^A-Za-z]|$)/gi, "$1双头怪隐匿地")
	data = data.replace(/(^|[^A-Za-z])(Dry TopS*?)(?=[^A-Za-z]|$)/gi, "$1干燥高地")
	data = data.replace(/(^|[^A-Za-z])(Nicholas the TravelerS*?)(?=[^A-Za-z]|$)/gi, "$1地图")
	data = data.replace(/(^|[^A-Za-z])(Thorn StalkerS*?)(?=[^A-Za-z]|$)/gi, "$1棘刺潜行者")
	data = data.replace(/(^|[^A-Za-z])(Tangled SeedS*?)(?=[^A-Za-z]|$)/gi, "$1纠结的种子")
	data = data.replace(/(^|[^A-Za-z])(Iron Mines of MoladuneS*?)(?=[^A-Za-z]|$)/gi, "$1莫拉登矿山")
	data = data.replace(/(^|[^A-Za-z])(Frozen ForestS*?)(?=[^A-Za-z]|$)/gi, "$1冰冻森林")
	data = data.replace(/(^|[^A-Za-z])(PinesoulS*?)(?=[^A-Za-z]|$)/gi, "$1松木怪")
	data = data.replace(/(^|[^A-Za-z])(Alpine SeedS*?)(?=[^A-Za-z]|$)/gi, "$1柏木种子")
	data = data.replace(/(^|[^A-Za-z])(Gadd's EncampmentS*?)(?=[^A-Za-z]|$)/gi, "$1盖德营区")
	data = data.replace(/(^|[^A-Za-z])(Sparkfly SwampS*?)(?=[^A-Za-z]|$)/gi, "$1火星蝇沼泽")
	data = data.replace(/(^|[^A-Za-z])(Bogroot GrowthsS*?)(?=[^A-Za-z]|$)/gi, "$1泥塘根源地")
	data = data.replace(/(^|[^A-Za-z])(HeketS*?)(?=[^A-Za-z]|$)/gi, "$1青蛙族群")
	data = data.replace(/(^|[^A-Za-z])(Rata SumS*?)(?=[^A-Za-z]|$)/gi, "$1洛达顶点")
	data = data.replace(/(^|[^A-Za-z])(Magus StonesS*?)(?=[^A-Za-z]|$)/gi, "$1马古斯之石")
	data = data.replace(/(^|[^A-Za-z])(Oola's LabS*?)(?=[^A-Za-z]|$)/gi, "$1呜拉实验室")
	data = data.replace(/(^|[^A-Za-z])(Hylek AminiS*?)(?=[^A-Za-z]|$)/gi, "$1海格克 阿纳尼")
	data = data.replace(/(^|[^A-Za-z])(Hylek NahualliS*?)(?=[^A-Za-z]|$)/gi, "$1海格克 纳猾里")
	data = data.replace(/(^|[^A-Za-z])(Hylek TlamatiniS*?)(?=[^A-Za-z]|$)/gi, "$1海格克 拉玛提尼")
	data = data.replace(/(^|[^A-Za-z])(Amphibian TongueS*?)(?=[^A-Za-z]|$)/gi, "$1双面人的舌头")
	data = data.replace(/(^|[^A-Za-z])(Kodonur CrossroadsS*?)(?=[^A-Za-z]|$)/gi, "$1科登诺路口")
	data = data.replace(/(^|[^A-Za-z])(The Floodplain of MahnkelonS*?)(?=[^A-Za-z]|$)/gi, "$1曼克隆泛滥平原")
	data = data.replace(/(^|[^A-Za-z])(Embark BeachS*?)(?=[^A-Za-z]|$)/gi, "$1征途海滩")
	data = data.replace(/(^|[^A-Za-z])(MerchantS*?)(?=[^A-Za-z]|$)/gi, "$1杂货商人")
	data = data.replace(/(^|[^A-Za-z])(Dwarven AleS*?)(?=[^A-Za-z]|$)/gi, "$1矮人啤酒")
	data = data.replace(/(^|[^A-Za-z])(Gunnar's HoldS*?)(?=[^A-Za-z]|$)/gi, "$1甘拿的占领地")
	data = data.replace(/(^|[^A-Za-z])(Kilroy StonekinS*?)(?=[^A-Za-z]|$)/gi, "$1基罗伊石族")
	data = data.replace(/(^|[^A-Za-z])(Fronis Irontoe's LairS*?)(?=[^A-Za-z]|$)/gi, "$1铁趾 佛朗尼的巢穴")
	data = data.replace(/(^|[^A-Za-z])(Irontoe'*?s*? ChestS*?)(?=[^A-Za-z]|$)/gi, "$1最终宝箱")
	data = data.replace(/(^|[^A-Za-z])(Eredon TerraceS*?)(?=[^A-Za-z]|$)/gi, "$1雷尔登平地")
	data = data.replace(/(^|[^A-Za-z])(Maishang HillsS*?)(?=[^A-Za-z]|$)/gi, "$1麦尚山丘")
	data = data.replace(/(^|[^A-Za-z])(Boreas SeabedS*?)(?=[^A-Za-z]|$)/gi, "$1风神海床")
	data = data.replace(/(^|[^A-Za-z])(Pongmei ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1朋美谷")
	data = data.replace(/(^|[^A-Za-z])(Islands*? GuardianS*?)(?=[^A-Za-z]|$)/gi, "$1岛屿守护者")
	data = data.replace(/(^|[^A-Za-z])(Guardian MossS*?)(?=[^A-Za-z]|$)/gi, "$1守护者苔")
	data = data.replace(/(^|[^A-Za-z])(Gate of DesolationS*?)(?=[^A-Za-z]|$)/gi, "$1荒芜之地入口")
	data = data.replace(/(^|[^A-Za-z])(Turai's ProcessionS*?)(?=[^A-Za-z]|$)/gi, "$1托雷长廊")
	//水巨灵精华已移上
	data = data.replace(/(^|[^A-Za-z])(Water\-*?\s*?Djii*?nnS*?)(?=[^A-Za-z]|$)/gi, "$1水巨灵")
	data = data.replace(/(^|[^A-Za-z])(Old AscalonS*?)(?=[^A-Za-z]|$)/gi, "$1旧阿斯卡隆")
	data = data.replace(/(^|[^A-Za-z])(Hulking Stone ElementalS*?)(?=[^A-Za-z]|$)/gi, "$1巨石元素")
	data = data.replace(/(^|[^A-Za-z])(Scorched LodestoneS*?)(?=[^A-Za-z]|$)/gi, "$1烧焦的磁石")
	data = data.replace(/(^|[^A-Za-z])(Amatz BasinS*?)(?=[^A-Za-z]|$)/gi, "$1亚马兹盆地")
	data = data.replace(/(^|[^A-Za-z])(Mourning Veil FallsS*?)(?=[^A-Za-z]|$)/gi, "$1哀伤之幕瀑布")
	data = data.replace(/(^|[^A-Za-z])(Rare material traderS*?)(?=[^A-Za-z]|$)/gi, "$1稀有材料商")
	data = data.replace(/(^|[^A-Za-z])(Tempered Glass VialS*?)(?=[^A-Za-z]|$)/gi, "$1调和后的玻璃瓶")
	data = data.replace(/(^|[^A-Za-z])(Bergen Hot SpringsS*?)(?=[^A-Za-z]|$)/gi, "$1卑尔根温泉")
	data = data.replace(/(^|[^A-Za-z])(Nebo TerraceS*?)(?=[^A-Za-z]|$)/gi, "$1尼伯山丘")
	data = data.replace(/(^|[^A-Za-z])(Cursed LandsS*?)(?=[^A-Za-z]|$)/gi, "$1诅咒之地")
	data = data.replace(/(^|[^A-Za-z])(Skeleton RangerS*?)(?=[^A-Za-z]|$)/gi, "$1骷髅游侠")
	data = data.replace(/(^|[^A-Za-z])(Skeleton SorcererS*?)(?=[^A-Za-z]|$)/gi, "$1骷髅巫师")
	data = data.replace(/(^|[^A-Za-z])(Grasping GhoulS*?)(?=[^A-Za-z]|$)/gi, "$1贪婪的食尸鬼")
	data = data.replace(/(^|[^A-Za-z])(Zombie WarlockS*?)(?=[^A-Za-z]|$)/gi, "$1僵尸法魔")
	data = data.replace(/(^|[^A-Za-z])(Skeleton BowmasterS*?)(?=[^A-Za-z]|$)/gi, "$1骷髅弓箭手")
	data = data.replace(/(^|[^A-Za-z])(Decayed Orr EmblemS*?)(?=[^A-Za-z]|$)/gi, "$1腐烂的欧尔纹章")
	data = data.replace(/(^|[^A-Za-z])(BeetletunS*?)(?=[^A-Za-z]|$)/gi, "$1甲虫镇")
	data = data.replace(/(^|[^A-Za-z])(Watchtower CoastS*?)(?=[^A-Za-z]|$)/gi, "$1瞭望塔海岸")
	data = data.replace(/(^|[^A-Za-z])(Gates of KrytaS*?)(?=[^A-Za-z]|$)/gi, "$1科瑞塔关所")
	data = data.replace(/(^|[^A-Za-z])(Scoundrel's RiseS*?)(?=[^A-Za-z]|$)/gi, "$1恶汉山丘")
	data = data.replace(/(^|[^A-Za-z])(Mergoyle WavebreakerS*?)(?=[^A-Za-z]|$)/gi, "$1碎浪石像魔")
	data = data.replace(/(^|[^A-Za-z])(Mergoyle SkullS*?)(?=[^A-Za-z]|$)/gi, "$1石像魔头颅")
	data = data.replace(/(^|[^A-Za-z])(Nundu BayS*?)(?=[^A-Za-z]|$)/gi, "$1纳度湾")
	data = data.replace(/(^|[^A-Za-z])(Marga CoastS*?)(?=[^A-Za-z]|$)/gi, "$1马加海岸")
	data = data.replace(/(^|[^A-Za-z])(Yohlon HavenS*?)(?=[^A-Za-z]|$)/gi, "$1犹朗避难所")
	data = data.replace(/(^|[^A-Za-z])(Arkjok WardS*?)(?=[^A-Za-z]|$)/gi, "$1阿尔科监禁区")
	data = data.replace(/(^|[^A-Za-z])(Bladed Veldt TermiteS*?)(?=[^A-Za-z]|$)/gi, "$1利刃草原蚁")
	data = data.replace(/(^|[^A-Za-z])(Veldt Beetle LanceS*?)(?=[^A-Za-z]|$)/gi, "$1草原尖刺甲虫")
	data = data.replace(/(^|[^A-Za-z])(Veldt Beetle QueenS*?)(?=[^A-Za-z]|$)/gi, "$1草原甲虫后")
	data = data.replace(/(^|[^A-Za-z])(Insect CarapaceS*?)(?=[^A-Za-z]|$)/gi, "$1甲虫壳")
	data = data.replace(/(^|[^A-Za-z])(CavalonS*?)(?=[^A-Za-z]|$)/gi, "$1卡瓦隆")
	data = data.replace(/(^|[^A-Za-z])(ArchipelagosS*?)(?=[^A-Za-z]|$)/gi, "$1群岛")
	data = data.replace(/(^|[^A-Za-z])(Creeping CarpS*?)(?=[^A-Za-z]|$)/gi, "$1爬行鲤鱼")
	data = data.replace(/(^|[^A-Za-z])(Scuttle FishS*?)(?=[^A-Za-z]|$)/gi, "$1甲板鱼")
	data = data.replace(/(^|[^A-Za-z])(IrukandjiS*?)(?=[^A-Za-z]|$)/gi, "$1毒水母")
	data = data.replace(/(^|[^A-Za-z])(Black PearlS*?)(?=[^A-Za-z]|$)/gi, "$1黑珍珠")
	data = data.replace(/(^|[^A-Za-z])(Bone PalaceS*?)(?=[^A-Za-z]|$)/gi, "$1白骨宫殿")
	data = data.replace(/(^|[^A-Za-z])(Joko's DomainS*?)(?=[^A-Za-z]|$)/gi, "$1杰格领地")
	data = data.replace(/(^|[^A-Za-z])(The Shattered RavinesS*?)(?=[^A-Za-z]|$)/gi, "$1碎裂沟谷")
	data = data.replace(/(^|[^A-Za-z])(Basalt GrottoS*?)(?=[^A-Za-z]|$)/gi, "$1玄武岩石穴")
	data = data.replace(/(^|[^A-Za-z])(Sandstorm CragS*?)(?=[^A-Za-z]|$)/gi, "$1沙风暴．克雷格")
	data = data.replace(/(^|[^A-Za-z])(Shambling MesaS*?)(?=[^A-Za-z]|$)/gi, "$1震颤者．梅萨")
	data = data.replace(/(^|[^A-Za-z])(Sandblasted LodestoneS*?)(?=[^A-Za-z]|$)/gi, "$1喷沙磁石")
	data = data.replace(/(^|[^A-Za-z])(Yak's(?: BendS*?)?)(?=[^A-Za-z]|$)/gi, "$1牦牛村")
	data = data.replace(/(^|[^A-Za-z])(Traveler's ValeS*?)(?=[^A-Za-z]|$)/gi, "$1旅人谷")
	data = data.replace(/(^|[^A-Za-z])(Iron Horse MineS*?)(?=[^A-Za-z]|$)/gi, "$1铁马矿山")
	data = data.replace(/(^|[^A-Za-z])(Beacon's PerchS*?)(?=[^A-Za-z]|$)/gi, "$1毕肯高地")
	data = data.replace(/(^|[^A-Za-z])(Deldrimor BowlS*?)(?=[^A-Za-z]|$)/gi, "$1戴尔迪摩盆地")
	data = data.replace(/(^|[^A-Za-z])(Griffon's MouthS*?)(?=[^A-Za-z]|$)/gi, "$1狮鹫兽隘口")
	data = data.replace(/(^|[^A-Za-z])(Snow EttinS*?)(?=[^A-Za-z]|$)/gi, "$1冰雪双头巨人")
	data = data.replace(/(^|[^A-Za-z])(Icy HumpS*?)(?=[^A-Za-z]|$)/gi, "$1冰雪瘤")
	data = data.replace(/(^|[^A-Za-z])(Ran Musu GardensS*?)(?=[^A-Za-z]|$)/gi, "$1岚穆苏花园")
	data = data.replace(/(^|[^A-Za-z])(Minister Cho's EstateS*?)(?=[^A-Za-z]|$)/gi, "$1周大臣庄园")
	data = data.replace(/(^|[^A-Za-z])(Sickened ServantS*?)(?=[^A-Za-z]|$)/gi, "$1病变的使者")
	data = data.replace(/(^|[^A-Za-z])(Sickened PeasantS*?)(?=[^A-Za-z]|$)/gi, "$1病变的书记")
	data = data.replace(/(^|[^A-Za-z])(Sickened Guard (warrior)S*?)(?=[^A-Za-z]|$)/gi, "$1病变的警卫")
	data = data.replace(/(^|[^A-Za-z])(Forgotten Trinket Boxe*?S*?)(?=[^A-Za-z]|$)/gi, "$1被遗忘的小箱子")
	data = data.replace(/(^|[^A-Za-z])(Ventari's RefugeS*?)(?=[^A-Za-z]|$)/gi, "$1凡特里庇护所")
	data = data.replace(/(^|[^A-Za-z])(Ettin's BackS*?)(?=[^A-Za-z]|$)/gi, "$1双头怪隐匿第")
	data = data.replace(/(^|[^A-Za-z])(Reed BogS*?)(?=[^A-Za-z]|$)/gi, "$1芦苇沼泽地")
	data = data.replace(/(^|[^A-Za-z])(The FallsS*?)(?=[^A-Za-z]|$)/gi, "$1陷落区")
	data = data.replace(/(^|[^A-Za-z])(Maguuma SpiderS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛蜘蛛")
	data = data.replace(/(^|[^A-Za-z])(Maguuma Spider WebS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛蜘蛛丝")
	data = data.replace(/(^|[^A-Za-z])(Jennur's HordeS*?)(?=[^A-Za-z]|$)/gi, "$1征纳群落")
	data = data.replace(/(^|[^A-Za-z])(Vehjin MinesS*?)(?=[^A-Za-z]|$)/gi, "$1威金矿坑")
	data = data.replace(/(^|[^A-Za-z])(Cobalt ScabaraS*?)(?=[^A-Za-z]|$)/gi, "$1深蓝斯卡巴拉")
	data = data.replace(/(^|[^A-Za-z])(Cobalt MokeleS*?)(?=[^A-Za-z]|$)/gi, "$1深蓝魔克雷")
	data = data.replace(/(^|[^A-Za-z])(Cobalt ShriekerS*?)(?=[^A-Za-z]|$)/gi, "$1深蓝尖啸者")
	data = data.replace(/(^|[^A-Za-z])(Cobalt TalonS*?)(?=[^A-Za-z]|$)/gi, "$1深蓝之爪")
	data = data.replace(/(^|[^A-Za-z])(Sunspear SanctuaryS*?)(?=[^A-Za-z]|$)/gi, "$1日戟避难所")
	data = data.replace(/(^|[^A-Za-z])(Command PostS*?)(?=[^A-Za-z]|$)/gi, "$1指挥所")
	data = data.replace(/(^|[^A-Za-z])(Jahai BluffsS*?)(?=[^A-Za-z]|$)/gi, "$1夏亥峭壁")
	data = data.replace(/(^|[^A-Za-z])(Rare material traderS*?)(?=[^A-Za-z]|$)/gi, "$1稀有材料商人")
	data = data.replace(/(^|[^A-Za-z])(Elonian Leathers*(?: SquareS*?)?)(?=[^A-Za-z]|$)/gi, "$1伊洛那皮革")
	data = data.replace(/(^|[^A-Za-z])(Deldrimor War CampS*?)(?=[^A-Za-z]|$)/gi, "$1戴尔狄摩兵营")
	data = data.replace(/(^|[^A-Za-z])(Grenth's FootprintS*?)(?=[^A-Za-z]|$)/gi, "$1古兰斯的足迹")
	data = data.replace(/(^|[^A-Za-z])(Sorrow's FurnaceS*?)(?=[^A-Za-z]|$)/gi, "$1哀伤熔炉")
	data = data.replace(/(^|[^A-Za-z])(Priest of SorrowsS*?)(?=[^A-Za-z]|$)/gi, "$1哀伤祭司")
	data = data.replace(/(^|[^A-Za-z])(Summit WardenS*?)(?=[^A-Za-z]|$)/gi, "$1石峰看守者")
	data = data.replace(/(^|[^A-Za-z])(Summit SurveyorS*?)(?=[^A-Za-z]|$)/gi, "$1石峰测量员")
	data = data.replace(/(^|[^A-Za-z])(Summit Dark BinderS*?)(?=[^A-Za-z]|$)/gi, "$1石峰黑暗束缚者")
	data = data.replace(/(^|[^A-Za-z])(Summit Deep KnightS*?)(?=[^A-Za-z]|$)/gi, "$1石峰深渊骑士")
	data = data.replace(/(^|[^A-Za-z])(Summit TaskmasterS*?)(?=[^A-Za-z]|$)/gi, "$1石峰工头")
	data = data.replace(/(^|[^A-Za-z])(Enslavement StoneS*?)(?=[^A-Za-z]|$)/gi, "$1奴隶石")
	data = data.replace(/(^|[^A-Za-z])(Ventari's RefugeS*?)(?=[^A-Za-z]|$)/gi, "$1凡特里避难所")
	data = data.replace(/(^|[^A-Za-z])(Ettin's BackS*?)(?=[^A-Za-z]|$)/gi, "$1双头怪隐匿地")
	data = data.replace(/(^|[^A-Za-z])(The WildsS*?)(?=[^A-Za-z]|$)/gi, "$1荒原")
	data = data.replace(/(^|[^A-Za-z])(Moss ScarabS*?)(?=[^A-Za-z]|$)/gi, "$1苔圣甲虫")
	data = data.replace(/(^|[^A-Za-z])(Mossy MandibleS*?)(?=[^A-Za-z]|$)/gi, "$1生苔下颚骨")
	data = data.replace(/(^|[^A-Za-z])(Ran Musu GardensS*?)(?=[^A-Za-z]|$)/gi, "$1岚穆苏花园")
	data = data.replace(/(^|[^A-Za-z])(Kinya ProvinceS*?)(?=[^A-Za-z]|$)/gi, "$1欣弥领地")
	data = data.replace(/(^|[^A-Za-z])(Panji*?ang PeninsulaS*?)(?=[^A-Za-z]|$)/gi, "$1班让半岛")
	data = data.replace(/(^|[^A-Za-z])(Crimson SkullS*?)(?=[^A-Za-z]|$)/gi, "$1红颅")
	data = data.replace(/(^|[^A-Za-z])(Copper Crimson Skull CoinS*?)(?=[^A-Za-z]|$)/gi, "$1红颅铜币")
	data = data.replace(/(^|[^A-Za-z])(Dunes of DespairS*?)(?=[^A-Za-z]|$)/gi, "$1绝望沙丘")
	data = data.replace(/(^|[^A-Za-z])(Vulture DriftsS*?)(?=[^A-Za-z]|$)/gi, "$1秃鹰沙丘")
	data = data.replace(/(^|[^A-Za-z])(Enchanted HammerS*?)(?=[^A-Za-z]|$)/gi, "$1附魔巨锤兵")
	data = data.replace(/(^|[^A-Za-z])(Enchanted SwordS*?)(?=[^A-Za-z]|$)/gi, "$1附魔长剑兵")
	data = data.replace(/(^|[^A-Za-z])(Enchanted BowS*?)(?=[^A-Za-z]|$)/gi, "$1附魔弓兵")
	data = data.replace(/(^|[^A-Za-z])(Forgotten SealS*?)(?=[^A-Za-z]|$)/gi, "$1遗忘者图章")
	data = data.replace(/(^|[^A-Za-z])(Dasha VestibuleS*?)(?=[^A-Za-z]|$)/gi, "$1达沙走廊")
	data = data.replace(/(^|[^A-Za-z])(The Hidden City of AhdashimS*?)(?=[^A-Za-z]|$)/gi, "$1隐藏之城 哈达辛")
	data = data.replace(/(^|[^A-Za-z])(Key of AhdashimS*?)(?=[^A-Za-z]|$)/gi, "$1哈达辛之钥")
	data = data.replace(/(^|[^A-Za-z])(Diamond Djii*?nn*? Essenc*?s*?e*?S*?)(?=[^A-Za-z]|$)/gi, "$1钻石巨灵精华")
	data = data.replace(/(^|[^A-Za-z])(Diamond Djii*?nn*?S*?)(?=[^A-Za-z]|$)/gi, "$1钻石巨灵")
	data = data.replace(/(^|[^A-Za-z])(DIAMONDS*?)(?=[^A-Za-z]|$)/gi, "$1金刚钻石")
	data = data.replace(/(^|[^A-Za-z])(BUS*?|ESSENC*?s*?ES*?(?: OF CELERITY)?)(?=[^A-Za-z]|$)/gi, "$1精华")
	data = data.replace(/(^|[^A-Za-z])(Temple of the AgesS*?)(?=[^A-Za-z]|$)/gi, "$1世纪神殿")
	data = data.replace(/(^|[^A-Za-z])(Talmark WildernessS*?)(?=[^A-Za-z]|$)/gi, "$1突马克荒地")
	data = data.replace(/(^|[^A-Za-z])(Bergen Hot SpringsS*?)(?=[^A-Za-z]|$)/gi, "$1卑尔根温泉")
	data = data.replace(/(^|[^A-Za-z])(Cursed LandsS*?)(?=[^A-Za-z]|$)/gi, "$1诅咒之地")
	data = data.replace(/(^|[^A-Za-z])(Ancient OakheartS*?)(?=[^A-Za-z]|$)/gi, "$1古老橡树妖")
	data = data.replace(/(^|[^A-Za-z])(OakheartS*?)(?=[^A-Za-z]|$)/gi, "$1橡树妖")
	data = data.replace(/(^|[^A-Za-z])(Spined AloeS*?)(?=[^A-Za-z]|$)/gi, "$1突刺芦荟")
	data = data.replace(/(^|[^A-Za-z])(Reed StalkerS*?)(?=[^A-Za-z]|$)/gi, "$1芦苇潜行者")
	data = data.replace(/(^|[^A-Za-z])(Abnormal SeedS*?)(?=[^A-Za-z]|$)/gi, "$1畸形的种子")
	data = data.replace(/(^|[^A-Za-z])(The Mouth of TormentS*?)(?=[^A-Za-z]|$)/gi, "$1苦痛之地隘口")
	data = data.replace(/(^|[^A-Za-z])(The Ruptured HeartS*?)(?=[^A-Za-z]|$)/gi, "$1破裂之心")
	data = data.replace(/(^|[^A-Za-z])(Gate of TormentS*?)(?=[^A-Za-z]|$)/gi, "$1苦痛之门")
	data = data.replace(/(^|[^A-Za-z])(Realm of TormentS*?)(?=[^A-Za-z]|$)/gi, "$1苦痛领域")
	data = data.replace(/(^|[^A-Za-z])(Nightfallen JahaiS*?)(?=[^A-Za-z]|$)/gi, "$1夜蚀暗殒 夏亥")
	data = data.replace(/(^|[^A-Za-z])(Arm of InsanityS*?)(?=[^A-Za-z]|$)/gi, "$1狂乱武装")
	data = data.replace(/(^|[^A-Za-z])(Scythe of ChaosS*?)(?=[^A-Za-z]|$)/gi, "$1混沌镰刀")
	data = data.replace(/(^|[^A-Za-z])(Blade of CorruptionS*?)(?=[^A-Za-z]|$)/gi, "$1堕落之刃")
	data = data.replace(/(^|[^A-Za-z])(Shadow of FearS*?)(?=[^A-Za-z]|$)/gi, "$1恐惧暗影")
	data = data.replace(/(^|[^A-Za-z])(Rain of TerrorS*?)(?=[^A-Za-z]|$)/gi, "$1惊骇之雨")
	data = data.replace(/(^|[^A-Za-z])(Herald of NightmaresS*?)(?=[^A-Za-z]|$)/gi, "$1梦靥使者")
	data = data.replace(/(^|[^A-Za-z])(Spear of TormentS*?)(?=[^A-Za-z]|$)/gi, "$1苦痛之矛")
	data = data.replace(/(^|[^A-Za-z])(Word of MadnessS*?)(?=[^A-Za-z]|$)/gi, "$1疯狂话语")
	data = data.replace(/(^|[^A-Za-z])(Demonic RelicS*?)(?=[^A-Za-z]|$)/gi, "$1恶魔残片")
	data = data.replace(/(^|[^A-Za-z])(Ice Tooth CaveS*?)(?=[^A-Za-z]|$)/gi, "$1冰牙洞穴")
	data = data.replace(/(^|[^A-Za-z])(Anvil RockS*?)(?=[^A-Za-z]|$)/gi, "$1铁砧石")
	data = data.replace(/(^|[^A-Za-z])(Frostfire DryderS*?)(?=[^A-Za-z]|$)/gi, "$1霜火蛛化精灵")
	data = data.replace(/(^|[^A-Za-z])(Frostfire FangS*?)(?=[^A-Za-z]|$)/gi, "$1霜火尖牙")
	data = data.replace(/(^|[^A-Za-z])(Boreas SeabedS*?)(?=[^A-Za-z]|$)/gi, "$1风神海床")
	data = data.replace(/(^|[^A-Za-z])(Pongmei ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1朋美谷")
	data = data.replace(/(^|[^A-Za-z])(Rot WallowS*?)(?=[^A-Za-z]|$)/gi, "$1腐败兽")
	data = data.replace(/(^|[^A-Za-z])(Rot Wallow TuskS*?)(?=[^A-Za-z]|$)/gi, "$1腐败兽獠牙")
	data = data.replace(/(^|[^A-Za-z])(Elona ReachS*?)(?=[^A-Za-z]|$)/gi, "$1伊洛那流域")
	data = data.replace(/(^|[^A-Za-z])(Diviner's AscentS*?)(?=[^A-Za-z]|$)/gi, "$1预言者之坡")
	data = data.replace(/(^|[^A-Za-z])(Sand DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1沙龙兽")
	data = data.replace(/(^|[^A-Za-z])(Topaz CrestS*?)(?=[^A-Za-z]|$)/gi, "$1黄宝石颈脊")
	data = data.replace(/(^|[^A-Za-z])(Rata SumS*?)(?=[^A-Za-z]|$)/gi, "$1洛达顶点")
	data = data.replace(/(^|[^A-Za-z])(Magus StonesS*?)(?=[^A-Za-z]|$)/gi, "$1玛古斯之石")
	data = data.replace(/(^|[^A-Za-z])(LifeweaverS*?)(?=[^A-Za-z]|$)/gi, "$1织命者")
	data = data.replace(/(^|[^A-Za-z])(BloodweaverS*?)(?=[^A-Za-z]|$)/gi, "$1织血者")
	data = data.replace(/(^|[^A-Za-z])(VenomweaverS*?)(?=[^A-Za-z]|$)/gi, "$1织恨者")
	data = data.replace(/(^|[^A-Za-z])(SpiderS*?)(?=[^A-Za-z]|$)/gi, "$1蜘蛛")
	data = data.replace(/(^|[^A-Za-z])(Weaver LegS*?)(?=[^A-Za-z]|$)/gi, "$1编织者的腿")
	data = data.replace(/(^|[^A-Za-z])(Yahnur MarketS*?)(?=[^A-Za-z]|$)/gi, "$1雅诺尔市集")
	data = data.replace(/(^|[^A-Za-z])(Vehtendi ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1巍天帝峡谷")
	data = data.replace(/(^|[^A-Za-z])(Storm JacarandaS*?)(?=[^A-Za-z]|$)/gi, "$1暴风荆棘")
	data = data.replace(/(^|[^A-Za-z])(Mirage IbogaS*?)(?=[^A-Za-z]|$)/gi, "$1幻象伊波枷")
	data = data.replace(/(^|[^A-Za-z])(Enchanted BramblesS*?)(?=[^A-Za-z]|$)/gi, "$1魔法树根")
	data = data.replace(/(^|[^A-Za-z])(Whistling ThornbrushS*?)(?=[^A-Za-z]|$)/gi, "$1荆棘之藤")
	data = data.replace(/(^|[^A-Za-z])(Sentient SporeS*?)(?=[^A-Za-z]|$)/gi, "$1知觉孢子")
	data = data.replace(/(^|[^A-Za-z])(AhojS*?)(?=[^A-Za-z]|$)/gi, "$1亚禾")
	data = data.replace(/(^|[^A-Za-z])(Bottle of Vabbian WineS*?)(?=[^A-Za-z]|$)/gi, "$1瓦贝红酒")
	data = data.replace(/(^|[^A-Za-z])(Jarimiya the UnmercifulS*?)(?=[^A-Za-z]|$)/gi, "$1残酷 贾米里")
	data = data.replace(/(^|[^A-Za-z])(Blacktide DenS*?)(?=[^A-Za-z]|$)/gi, "$1黑潮之穴")
	data = data.replace(/(^|[^A-Za-z])(Lahtenda BogS*?)(?=[^A-Za-z]|$)/gi, "$1洛天帝沼泽")
	data = data.replace(/(^|[^A-Za-z])(Mandragor ImpS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗恶魔")
	data = data.replace(/(^|[^A-Za-z])(Mandragor SlitherS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗之藤")
	data = data.replace(/(^|[^A-Za-z])(Stoneflesh MandragorS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗石根")
	data = data.replace(/(^|[^A-Za-z])(Mandragor SwamprootS*?)(?=[^A-Za-z]|$)/gi, "$1曼陀罗根")
	data = data.replace(/(^|[^A-Za-z])(Vasburg ArmoryS*?)(?=[^A-Za-z]|$)/gi, "$1维思柏兵营")
	data = data.replace(/(^|[^A-Za-z])(The Eternal GroveS*?)(?=[^A-Za-z]|$)/gi, "$1永恒之林")
	data = data.replace(/(^|[^A-Za-z])(Skill Hungry GakiS*?)(?=[^A-Za-z]|$)/gi, "$1灵巧的饿鬼")
	data = data.replace(/(^|[^A-Za-z])(Pain Hungry GakiS*?)(?=[^A-Za-z]|$)/gi, "$1痛苦的饿鬼")
	data = data.replace(/(^|[^A-Za-z])(Quarrel FallsS*?)(?=[^A-Za-z]|$)/gi, "$1怨言瀑布")
	data = data.replace(/(^|[^A-Za-z])(SilverwoodS*?)(?=[^A-Za-z]|$)/gi, "$1银树")
	data = data.replace(/(^|[^A-Za-z])(Maguuma WarriorS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛战士")
	data = data.replace(/(^|[^A-Za-z])(Maguuma HunterS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛猎人")
	data = data.replace(/(^|[^A-Za-z])(Maguuma ProtectorS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛守护者")
	data = data.replace(/(^|[^A-Za-z])(Maguuma ManeS*?)(?=[^A-Za-z]|$)/gi, "$1梅古玛鬃毛")
	data = data.replace(/(^|[^A-Za-z])(Seeker's PassageS*?)(?=[^A-Za-z]|$)/gi, "$1探索者通道")
	data = data.replace(/(^|[^A-Za-z])(Salt FlatsS*?)(?=[^A-Za-z]|$)/gi, "$1盐滩")
	data = data.replace(/(^|[^A-Za-z])(The Amnoon OasisS*?)(?=[^A-Za-z]|$)/gi, "$1安努绿洲")
	data = data.replace(/(^|[^A-Za-z])(Prophet's PathS*?)(?=[^A-Za-z]|$)/gi, "$1先知之路")
	data = data.replace(/(^|[^A-Za-z])(Jade ScarabS*?)(?=[^A-Za-z]|$)/gi, "$1翡翠圣甲虫")
	data = data.replace(/(^|[^A-Za-z])(Jade MandibleS*?)(?=[^A-Za-z]|$)/gi, "$1翡翠下颚骨")
	data = data.replace(/(^|[^A-Za-z])(Temple of the AgesS*?)(?=[^A-Za-z]|$)/gi, "$1辛库走廊")
	data = data.replace(/(^|[^A-Za-z])(Sunji*?ang DistrictS*?)(?=[^A-Za-z]|$)/gi, "$1孙江行政区")
	data = data.replace(/(^|[^A-Za-z])(Sunji*?ang DistrictS*?)(?=[^A-Za-z]|$)/gi, "$1孙江行政区")
	data = data.replace(/(^|[^A-Za-z])(Shenzun TunnelsS*?)(?=[^A-Za-z]|$)/gi, "$1申赞通道")
	data = data.replace(/(^|[^A-Za-z])(AfflictedS*?)(?=[^A-Za-z]|$)/gi, "$1被感染的")
	data = data.replace(/(^|[^A-Za-z])(Putrid CystS*?)(?=[^A-Za-z]|$)/gi, "$1腐败胞囊")
	data = data.replace(/(^|[^A-Za-z])(The AstralariumS*?)(?=[^A-Za-z]|$)/gi, "$1世纪神殿")
	data = data.replace(/(^|[^A-Za-z])(Zehlon ReachS*?)(?=[^A-Za-z]|$)/gi, "$1黑色帷幕")
	data = data.replace(/(^|[^A-Za-z])(Beknur HarborS*?)(?=[^A-Za-z]|$)/gi, "$1突马克荒地")
	data = data.replace(/(^|[^A-Za-z])(Skale BlighterS*?)(?=[^A-Za-z]|$)/gi, "$1森林牛头怪")
	data = data.replace(/(^|[^A-Za-z])(Skale FinS*?)(?=[^A-Za-z]|$)/gi, "$1森林牛头怪的角")
	data = data.replace(/(^|[^A-Za-z])(The AstralariumS*?)(?=[^A-Za-z]|$)/gi, "$1亚斯特拉利姆")
	data = data.replace(/(^|[^A-Za-z])(Zehlon ReachS*?)(?=[^A-Za-z]|$)/gi, "$1列隆流域")
	data = data.replace(/(^|[^A-Za-z])(Beknur HarborS*?)(?=[^A-Za-z]|$)/gi, "$1别克诺港")
	data = data.replace(/(^|[^A-Za-z])(Issnur IslesS*?)(?=[^A-Za-z]|$)/gi, "$1伊斯诺岛")
	data = data.replace(/(^|[^A-Za-z])(Skale BlighterS*?)(?=[^A-Za-z]|$)/gi, "$1黑暗鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Frigid SkaleS*?)(?=[^A-Za-z]|$)/gi, "$1寒冰鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Ridgeback SkaleS*?)(?=[^A-Za-z]|$)/gi, "$1脊背鳞怪")
	data = data.replace(/(^|[^A-Za-z])(Skale FinS*?)(?=[^A-Za-z]|$)/gi, "$1鳞怪鳍")
	data = data.replace(/(^|[^A-Za-z])(Chef PanjohS*?)(?=[^A-Za-z]|$)/gi, "$1大厨 潘乔")
	data = data.replace(/(^|[^A-Za-z])(Bowl of Skale*?fin SoupS*?)(?=[^A-Za-z]|$)/gi, "$1鳞怪鳍汤")
	data = data.replace(/(^|[^A-Za-z])(Sage LandsS*?)(?=[^A-Za-z]|$)/gi, "$1荒原")
	data = data.replace(/(^|[^A-Za-z])(Mamnoon LagoonS*?)(?=[^A-Za-z]|$)/gi, "$1玛奴泻湖")
	data = data.replace(/(^|[^A-Za-z])(Henge of DenraviS*?)(?=[^A-Za-z]|$)/gi, "$1丹拉维圣地")
	data = data.replace(/(^|[^A-Za-z])(Tangle RootS*?)(?=[^A-Za-z]|$)/gi, "$1纠结之根")
	data = data.replace(/(^|[^A-Za-z])(Dry TopS*?)(?=[^A-Za-z]|$)/gi, "$1干燥高地")
	data = data.replace(/(^|[^A-Za-z])(Behemoth JawS*?)(?=[^A-Za-z]|$)/gi, "$1巨兽颚")
	data = data.replace(/(^|[^A-Za-z])(Root BehemothS*?)(?=[^A-Za-z]|$)/gi, "$1根巨兽")
	data = data.replace(/(^|[^A-Za-z])(Brauer AcademyS*?)(?=[^A-Za-z]|$)/gi, "$1袭哈拉")
	data = data.replace(/(^|[^A-Za-z])(Jaga MoraineS*?)(?=[^A-Za-z]|$)/gi, "$1亚加摩瑞恩")
	data = data.replace(/(^|[^A-Za-z])(UndergrowthS*?)(?=[^A-Za-z]|$)/gi, "$1海冶克狂战士")
	data = data.replace(/(^|[^A-Za-z])(Dragon MossS*?)(?=[^A-Za-z]|$)/gi, "$1牛头怪狂战士")
	data = data.replace(/(^|[^A-Za-z])(Dragon MossS*?)(?=[^A-Za-z]|$)/gi, "$1狂战士 纹帝哥")
	data = data.replace(/(^|[^A-Za-z])(Dragon MossS*?)(?=[^A-Za-z]|$)/gi, "$1棘狼狂战士")
	data = data.replace(/(^|[^A-Za-z])(Berserker HornS*?)(?=[^A-Za-z]|$)/gi, "$1狂战士的角")
	data = data.replace(/(^|[^A-Za-z])(Brauer AcademyS*?)(?=[^A-Za-z]|$)/gi, "$1巴尔学院")
	data = data.replace(/(^|[^A-Za-z])(Drazach ThicketS*?)(?=[^A-Za-z]|$)/gi, "$1德瑞扎灌木林")
	data = data.replace(/(^|[^A-Za-z])(Tanglewood CopseS*?)(?=[^A-Za-z]|$)/gi, "$1谭格坞树林")
	data = data.replace(/(^|[^A-Za-z])(Pongmei ValleyS*?)(?=[^A-Za-z]|$)/gi, "$1朋美谷")
	data = data.replace(/(^|[^A-Za-z])(UndergrowthS*?)(?=[^A-Za-z]|$)/gi, "$1矮树丛")
	data = data.replace(/(^|[^A-Za-z])(Dragon MossS*?)(?=[^A-Za-z]|$)/gi, "$1龙苔")
	data = data.replace(/(^|[^A-Za-z])(Dragon RootS*?)(?=[^A-Za-z]|$)/gi, "$1龙根")
	data = data.replace(/(^|[^A-Za-z])(Fishermen's HavenS*?)(?=[^A-Za-z]|$)/gi, "$1渔人避风港")
	data = data.replace(/(^|[^A-Za-z])(Stingray StrandS*?)(?=[^A-Za-z]|$)/gi, "$1魟鱼湖滨")
	data = data.replace(/(^|[^A-Za-z])(Tears of the FallenS*?)(?=[^A-Za-z]|$)/gi, "$1战死者之泪")
	data = data.replace(/(^|[^A-Za-z])(Grand DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1强龙兽")
	data = data.replace(/(^|[^A-Za-z])(Sanctum CayS*?)(?=[^A-Za-z]|$)/gi, "$1神圣沙滩")
	data = data.replace(/(^|[^A-Za-z])(Lightning DrakeS*?)(?=[^A-Za-z]|$)/gi, "$1闪光龙兽")
	data = data.replace(/(^|[^A-Za-z])(Spiked CrestS*?)(?=[^A-Za-z]|$)/gi, "$1尖刺的颈脊")
	data = data.replace(/(^|[^A-Za-z])(Imperial SanctumS*?)(?=[^A-Za-z]|$)/gi, "$1帝国圣所")
	data = data.replace(/(^|[^A-Za-z])(Raisu PalaceS*?)(?=[^A-Za-z]|$)/gi, "$1莱苏皇宫")
	data = data.replace(/(^|[^A-Za-z])(Soul StoneS*?)(?=[^A-Za-z]|$)/gi, "$1灵魂石")
	data = data.replace(/(^|[^A-Za-z])(Tihark OrchardS*?)(?=[^A-Za-z]|$)/gi, "$1提亚克林地")
	data = data.replace(/(^|[^A-Za-z])(Forum HighlandsS*?)(?=[^A-Za-z]|$)/gi, "$1高地广场")
	data = data.replace(/(^|[^A-Za-z])(Skree WingS*?)(?=[^A-Za-z]|$)/gi, "$1鸟妖翅膀")
	data = data.replace(/(^|[^A-Za-z])(SkreeS*?)(?=[^A-Za-z]|$)/gi, "$1鸟妖")
	data = data.replace(/(^|[^A-Za-z])(Serenity TempleS*?)(?=[^A-Za-z]|$)/gi, "$1宁静神殿")
	data = data.replace(/(^|[^A-Za-z])(Pockmark FlatsS*?)(?=[^A-Za-z]|$)/gi, "$1麻点平原")
	data = data.replace(/(^|[^A-Za-z])(Storm RiderS*?)(?=[^A-Za-z]|$)/gi, "$1暴风驾驭者")
	data = data.replace(/(^|[^A-Za-z])(Stormy EyeS*?)(?=[^A-Za-z]|$)/gi, "$1暴风之眼")
	data = data.replace(/(^|[^A-Za-z])(Gates of KrytaS*?)(?=[^A-Za-z]|$)/gi, "$1科瑞塔之门")
	data = data.replace(/(^|[^A-Za-z])(Scoundrel's RiseS*?)(?=[^A-Za-z]|$)/gi, "$1恶汉山丘")
	data = data.replace(/(^|[^A-Za-z])(Griffon's MouthS*?)(?=[^A-Za-z]|$)/gi, "$1狮鹭兽隘口")
	data = data.replace(/(^|[^A-Za-z])(Spiritwood PlankS*?)(?=[^A-Za-z]|$)/gi, "$1心灵之板")
	data = data.replace(/(^|[^A-Za-z])(Tsumei VillageS*?)(?=[^A-Za-z]|$)/gi, "$1苏梅村")
	data = data.replace(/(^|[^A-Za-z])(Panji*?ang PeninsulaS*?)(?=[^A-Za-z]|$)/gi, "$1班让半岛")
	data = data.replace(/(^|[^A-Za-z])(NagaS*?)(?=[^A-Za-z]|$)/gi, "$1纳迦")
	data = data.replace(/(^|[^A-Za-z])(Naga HideS*?)(?=[^A-Za-z]|$)/gi, "$1纳迦皮")
	data = data.replace(/(^|[^A-Za-z])(SifhallaS*?)(?=[^A-Za-z]|$)/gi, "$1袭哈拉")
	data = data.replace(/(^|[^A-Za-z])(Drakkar LakeS*?)(?=[^A-Za-z]|$)/gi, "$1卓卡湖")
	data = data.replace(/(^|[^A-Za-z])(Frozen ElementalS*?)(?=[^A-Za-z]|$)/gi, "$1冰元素")
	data = data.replace(/(^|[^A-Za-z])(Pile of Elemental DustS*?)(?=[^A-Za-z]|$)/gi, "$1元素之土")
	data = data.replace(/(^|[^A-Za-z])(Bergen Hot SpringsS*?)(?=[^A-Za-z]|$)/gi, "$1卑尔根温泉")
	data = data.replace(/(^|[^A-Za-z])(Nebo TerraceS*?)(?=[^A-Za-z]|$)/gi, "$1尼伯山丘")
	data = data.replace(/(^|[^A-Za-z])(North Kryta ProvinceS*?)(?=[^A-Za-z]|$)/gi, "$1科瑞塔北部")
	data = data.replace(/(^|[^A-Za-z])(Gypsie EttinS*?)(?=[^A-Za-z]|$)/gi, "$1流浪双头巨人")
	data = data.replace(/(^|[^A-Za-z])(Hardened HumpS*?)(?=[^A-Za-z]|$)/gi, "$1硬瘤")
	data = data.replace(/(^|[^A-Za-z])(Leviathan PitsS*?)(?=[^A-Za-z]|$)/gi, "$1利拜亚森矿场")
	data = data.replace(/(^|[^A-Za-z])(Silent SurfS*?)(?=[^A-Za-z]|$)/gi, "$1寂静之浪")
	data = data.replace(/(^|[^A-Za-z])(Seafarer's RestS*?)(?=[^A-Za-z]|$)/gi, "$1航海者休憩处")
	data = data.replace(/(^|[^A-Za-z])(OniS*?)(?=[^A-Za-z]|$)/gi, "$1鬼")
	data = data.replace(/(^|[^A-Za-z])(Keen Oni TalonS*?)(?=[^A-Za-z]|$)/gi, "$1锐利细鬼爪")
	data = data.replace(/(^|[^A-Za-z])(Ice Caves of SorrowS*?)(?=[^A-Za-z]|$)/gi, "$1悲伤冰谷")
	data = data.replace(/(^|[^A-Za-z])(IcedomeS*?)(?=[^A-Za-z]|$)/gi, "$1冰点")
	data = data.replace(/(^|[^A-Za-z])(Ice ElementalS*?)(?=[^A-Za-z]|$)/gi, "$1冰元素")
	data = data.replace(/(^|[^A-Za-z])(Ice GolemS*?)(?=[^A-Za-z]|$)/gi, "$1冰高仑")
	data = data.replace(/(^|[^A-Za-z])(Icy LodestoneS*?)(?=[^A-Za-z]|$)/gi, "$1冰磁石")
	data = data.replace(/(^|[^A-Za-z])(Augury RockS*?)(?=[^A-Za-z]|$)/gi, "$1占卜之石")
	data = data.replace(/(^|[^A-Za-z])(Skyward ReachS*?)(?=[^A-Za-z]|$)/gi, "$1天际流域")
	data = data.replace(/(^|[^A-Za-z])(Destiny's GorgeS*?)(?=[^A-Za-z]|$)/gi, "$1命运峡谷")
	data = data.replace(/(^|[^A-Za-z])(Prophet's PathS*?)(?=[^A-Za-z]|$)/gi, "$1探索者通道")
	data = data.replace(/(^|[^A-Za-z])(Salt FlatsS*?)(?=[^A-Za-z]|$)/gi, "$1盐滩")
	data = data.replace(/(^|[^A-Za-z])(Storm KinS*?)(?=[^A-Za-z]|$)/gi, "$1风暴魔")
	data = data.replace(/(^|[^A-Za-z])(Shriveled EyeS*?)(?=[^A-Za-z]|$)/gi, "$1干枯的眼睛")
	data = data.replace(/(^|[^A-Za-z])(Skull JujuS*?)(?=[^A-Za-z]|$)/gi, "$1头骨土符")
	data = data.replace(/(^|[^A-Za-z])(Skull JujuS*?)(?=[^A-Za-z]|$)/gi, "$1颅骨土符")
	data = data.replace(/(^|[^A-Za-z])(Bone CharmS*?)(?=[^A-Za-z]|$)/gi, "$1骨制护符")

	data = data.replace(/(^|[^A-Za-z])((EVER*?\s*?LAS*?TING*?|EVERLA*?S*?T*?I*?N*?G*?\.*?|EL)+?\s*?(TONICS*?|TONCIS)+?)(?=[^A-Za-z]|$)/gi, "$1永久变身")
	data = data.replace(/(^|[^A-Za-z])(EVER*?\s*?LAS*?TING*?|EL)(?=[^A-Za-z]|$)/gi, "$1永久") //EL 修改
	data = data.replace(/(^|[^A-Za-z])(TONICS*?|TONCIS)(?=[^A-Za-z]|$)/gi, "$1变身")
	if (样式) {
		data = data.replace(/(^|[^A-Za-z])(永久 CHAMPI*?O*?N*?S*?(?: OF )?(BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?)?)(?=[^A-Za-z]|$)/gi, "$1永久变身 <a href=\"http://wiki.guildwars.com/wiki/Everlasting_Balthazar%27s_Champion_Tonic\" style=\"font-weight:900;\" title=\"Everlasting_Balthazar_Champion_Tonic\">巴萨泽拥护者</a> [<a href=\"http://wiki.guildwars.com/wiki/Champion_of_Balthazar\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")

		data = data.replace(/(^|[^A-Za-z])(CHAMPI*?O*?N*?S*? (?:OF )?BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?|BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*? CHAMPIONS*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Balthazar%27s_Champion_Tonic\" style=\"font-weight:900;\" title=\"Everlasting_Balthazar_Champion_Tonic\">巴萨泽拥护者</a> [<a href=\"http://wiki.guildwars.com/wiki/Champion_of_Balthazar\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
		data = data.replace(/(^|[^A-Za-z])(PRIESTS*? (?:OF )?BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Priest_of_Balthazar_Tonic\" style=\"font-weight:900;\" title=\"Everlasting_Priest_of_Balthazar_Tonic\">巴萨泽的祭司</a> [<a href=\"http://wiki.guildwars.com/wiki/Priest_of_Balthazar\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
		data = data.replace(/(^|[^A-Za-z])(AVATARS*? (?:OF )?BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Avatar_of_Balthazar_Tonic\" style=\"font-weight:900;\" title=\"Everlasting_Avatar_of_Balthazar_Tonic\">巴萨泽化身</a> [<a href=\"http://wiki.guildwars.com/wiki/Avatar_of_Balthazar_Form\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
		data = data.replace(/(^|[^A-Za-z])(GH*?OSTLY HEROE*?S*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Ghostly_Hero_Tonic\" style=\"font-weight:900;\" title=\"Everlasting_Ghostly_Hero_Tonic\">英雄之魂</a> [<a href=\"http://wiki.guildwars.com/wiki/Ghostly_Hero_Form\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
		data = data.replace(/(^|[^A-Za-z])(GH*?OSTLY PRIESTS*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Ghostly_Priest_Tonic\" style=\"font-weight:900;\" title=\"Everlasting_Ghostly_Priest_Tonic\">游魂祭司</a> [<a href=\"http://wiki.guildwars.com/wiki/Ghostly_Priest\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
		data = data.replace(/(^|[^A-Za-z])(GUILD LORDS*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Guild_Lord_Tonic\" style=\"font-weight:900;\" title=\"Everlasting_Guild_Lord_Tonic\">公会领主</a> [<a href=\"http://wiki.guildwars.com/wiki/Guild_Lord_Form\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
		data = data.replace(/(^|[^A-Za-z])(SINISTER AUTOMATONICS*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Sinister_Automatonic\" style=\"font-weight:900;\" title=\"Everlasting_Sinister_Automatonic_Tonic\">黑高仑</a> [<a href=\"http://wiki.guildwars.com/wiki/Sinister_Golem_Form\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
		data = data.replace(/(^|[^A-Za-z\_])(AUTOMATONICS*?)(?=[^A-Za-z]|$)/gi, "$1<a href=\"http://wiki.guildwars.com/wiki/Everlasting_Automatonic\" style=\"font-weight:900;\" title=\"Everlasting_Automatonic_Tonic\">高仑</a> [<a href=\"http://wiki.guildwars.com/wiki/Golem_Form\" style=\"font-weight:900;text-decoration:underline;\">图</a>]")
	} else {
		data = data.replace(/(^|[^A-Za-z])(永久 CHAMPI*?O*?N*?S*?(?: OF )?(BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?)?)(?=[^A-Za-z]|$)/gi, "$1永久变身 巴萨泽拥护者")

		data = data.replace(/(^|[^A-Za-z])(CHAMPI*?O*?N*?S*? (?:OF )?BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?|BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*? CHAMPIONS*?)(?=[^A-Za-z]|$)/gi, "$1巴萨泽拥护者")
		data = data.replace(/(^|[^A-Za-z])(PRIESTS*? (?:OF )?BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?)(?=[^A-Za-z]|$)/gi, "$1巴萨泽的祭司")
		data = data.replace(/(^|[^A-Za-z])(AVATARS*? (?:OF )?BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?)(?=[^A-Za-z]|$)/gi, "$1巴萨泽化身")
		data = data.replace(/(^|[^A-Za-z])(GH*?OSTLY HEROE*?S*?)(?=[^A-Za-z]|$)/gi, "$1英雄之魂")
		data = data.replace(/(^|[^A-Za-z])(GH*?OSTLY PRIESTS*?)(?=[^A-Za-z]|$)/gi, "$1游魂祭司")
		data = data.replace(/(^|[^A-Za-z])(GUILD LORDS*?)(?=[^A-Za-z]|$)/gi, "$1公会领主")
		data = data.replace(/(^|[^A-Za-z])(SINISTER AUTOMATONICS*?)(?=[^A-Za-z]|$)/gi, "$1黑高仑")
		data = data.replace(/(^|[^A-Za-z\_])(AUTOMATONICS*?)(?=[^A-Za-z]|$)/gi, "$1高仑")
	}
	data = data.replace(/(^|[^A-Za-z_])(BAL*?THA*?Z*?R*?A*?R*?D*?'?s*?Z*?|BALTHA*?'*?S*?|BALTA'*?S*?)(?=[^A-Za-z]|$)/gi, "$1巴萨泽")
	data = data.replace(/(^|[^A-Za-z_])(HEROE*?S*?)(?=[^A-Za-z]|$)/gi, "$1英雄")
	data = data.replace(/(^|[^A-Za-z])(AR)(?=[^A-Za-z]|$)/gi, "$1防御")
	data = data.replace(/(^|[^A-Za-z])(FIRE\s*?MAGIC|FIRE)(?=[^A-Za-z]|$)/gi, "$1火系") //魔法
	data = data.replace(/(^|[^A-Za-z])(WATER\s*?MAGIC|WATER)(?=[^A-Za-z]|$)/gi, "$1水系") //魔法
	data = data.replace(/(^|[^A-Za-z])(HSR)(?=[^A-Za-z]|$)/gi, "$1半恢复时间")
	data = data.replace(/(^|[^A-Za-z])(HCT)(?=[^A-Za-z]|$)/gi, "$1半施法时间")
	data = data.replace(/(^|[^A-Za-z])(DRACONIC)(?=[^A-Za-z]|$)/gi, "$1严龙")
	data = data.replace(/(^|[^A-Za-z])(DJII*?NN*S*)(?=[^A-Za-z]|$)/gi, "$1巨灵")
	data = data.replace(/(^|[^A-Za-z])(DEEP\s?RUNNER'*S*)(?=[^A-Za-z]|$)/gi, "$1深奔")
	data = data.replace(/(^|[^A-Za-z])(Artifacts*?)(?=[^A-Za-z]|$)/gi, "$1神器")
	data = data.replace(/(^|[^A-Za-z])(Phantoms*?)(?=[^A-Za-z]|$)/gi, "$1幽灵")
	data = data.replace(/(^|[^A-Za-z])(STACKS*?\s*?LEFT)(?=[^A-Za-z]|$)/gi, "$1组 剩下")
	data = data.replace(/(^|[^A-Za-z])(Brotherhoods*?)(?=[^A-Za-z]|$)/gi, "$1修士")
	data = data.replace(/(^|[^A-Za-z])(Sunspears*?)(?=[^A-Za-z]|$)/gi, "$1日戟")

	for (var counter = 0; counter < 5; counter++) {
		data = data.replace(/(^|[^A-Za-z])(stac*?k*?s*? of)(\s.*?)(?=\s|[A-Za-z]|$|\\|'|!|"|#|\$|%|&|\(|\)|\*|\+|,|\-|\.|\/|:|;|<|=|>|\?|@|\[|\]|\^|_|`|\{|\||\}|~)/gi, "$1$3 组")
	}

	data = data.replace(/(^|[^A-Za-z])(ALL)(?=[^A-Za-z]|$)/gi, "$1所有的")
	data = data.replace(/(^|[^A-Za-z])(NON)(?=[^A-Za-z]|$)/gi, "$1非")
	data = data.replace(/(^|[^A-Za-z])(TYPO)(?=[^A-Za-z]|$)/gi, "$1写错")
	////////////////
	//data=data.replace(/(\d)E(?![A-Za-z])/gi,'$1玉');
	data = data.replace(/(\+\d+)(\s*?)E(?![A-Za-z])/gi, "$1$2能量")
	data = data.replace(/(^|\s)(\-\d+)E(?![A-Za-z])/gi, "$1$2能量") //HM-9玉|5-9玉 E前无空格时才认为是能量， $3?
	data = data.replace(/(\d)(\s*?)E(?![A-Za-z])/gi, "$1$2玉")
	//data=data.replace(/(\d)A(?![A-Za-z])/gi,'$1真理');
	data = data.replace(/(\d)(\s*?)A(?![A-Za-z])/gi, "$1$2真理")
	data = data.replace(/(\d+)(W\.?E\.?|W\/E*N*C*H*A*N*T*E*D*)(?![A-Za-z])/gi, "$1(加持下)")
	data = data.replace(/W\/ENCHA*N*T*(?![A-Za-z])/gi, "(加持下)")

	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF DEFENSE)(?=[^A-Za-z]|$)/gi, "$1 [防卫] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF SHELTER)(?=[^A-Za-z]|$)/gi, "$1 [庇护] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF WARDING)(?=[^A-Za-z]|$)/gi, "$1 [结界] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF EN*?CHANTI*?N*?G*?|OF ENCHANTM*?E*?N*?T*?|OF ENCH)(?=[^A-Za-z]|$)/gi, "$1 [附魔] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF SWIF*?TNESS)(?=[^A-Za-z]|$)/gi, "$1 [迅捷] $2")
	data = data.replace(/(^|[^A-Za-z])(FOCUS OF APP*?TT*?ITUT*?D*?E|APP*?TT*?ITUT*?D*?E FOCUS)(?=[^A-Za-z]|$)/gi, "$1[天赋] 聚能器")
	data = data.replace(/(^|[^A-Za-z])(FOCUS CORES*? OF APP*?TT*?ITUT*?D*?E|APP*?TT*?ITUT*?D*?E FOCUS CORES*?)(?=[^A-Za-z]|$)/gi, "$1[天赋] 聚能器核心")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF APP*?TT*?ITUT*?D*?E)(?=[^A-Za-z]|$)/gi, "$1 [天赋] $2")
	data = data.replace(/(^|[^A-Za-z])(FOCUS CORES*?)(?=[^A-Za-z]|$)/gi, "$1聚能器核心")
	data = data.replace(/(^|[^A-Za-z])(FOCUS)(?=[^A-Za-z]|$)/gi, "$1聚能器")
	data = data.replace(/(^|[^A-Za-z])(CORES*?)(?=[^A-Za-z]|$)/gi, "$1核心")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF FORT(?:ITUD*?T*?ES*?)?)(?=[^A-Za-z]|$)/gi, "$1 [坚忍] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF DEVOTION)(?=[^A-Za-z]|$)/gi, "$1 [奉献] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF ENDURANCE)(?=[^A-Za-z]|$)/gi, "$1 [忍耐] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF VALOR)(?=[^A-Za-z]|$)/gi, "$1 [英勇] $2")
	//data=data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF ATTRIBUTE)(?=[^A-Za-z]|$)/gi, '$1 [___] $2'); //
	//data=data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF MASTERY)(?=[^A-Za-z]|$)/gi, '$1 [___] $2'); //
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF QUICKENI*?N*?G*?)(?=[^A-Za-z]|$)/gi, "$1 [复苏] $2")
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF MEMORY)(?=[^A-Za-z]|$)/gi, "$1 [记忆] $2")
	//data=data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF SLAYING)(?=[^A-Za-z]|$)/gi, '$1 [___] $2'); //
	data = data.replace(/(^|[^A-Za-z])([^A-Za-z,'"!\\#\$%\(\)\*\+\-\.\/:;<=>\?@\[\]\^_`\{\}~\|]*?)(OF DEATHBANE)(?=[^A-Za-z]|$)/gi, "$1 [不死族克星] $2")

	data = data.replace(/(^|[^A-Za-z])(DEFENSE)(?=[^A-Za-z]|$)/gi, "$1[防卫]")
	data = data.replace(/(^|[^A-Za-z])(SHELTER)(?=[^A-Za-z]|$)/gi, "$1[庇护]")
	data = data.replace(/(^|[^A-Za-z])(WARDING)(?=[^A-Za-z]|$)/gi, "$1[结界]")
	data = data.replace(/(^|[^A-Za-z])(ENCHN*?T*?|ENCHANTS|ENCHED|ENCHTED|ENCHANTE*?D*?|ENCHANTMENTS*?)(?=[^A-Za-z]|$)/gi, "$1加持")
	data = data.replace(/(^|[^A-Za-z])(EN*?CHANTI*?N*?G*?|EN*?CHANTM*?E*?N*?T*?)(?=[^A-Za-z]|$)/gi, "$1[附魔]")
	data = data.replace(/(^|[^A-Za-z])(SWIF*?TNESS)(?=[^A-Za-z]|$)/gi, "$1[迅捷]")
	//data=data.replace(/(^|[^A-Za-z])(APP*?TITUDE)(?=[^A-Za-z]|$)/gi, '$1[___]');
	data = data.replace(/(^|[^A-Za-z])(FORTITUD*?T*?ES*?|FORT)(?=[^A-Za-z]|$)/gi, "$1[坚忍]")
	data = data.replace(/(^|[^A-Za-z])(DEVOTION)(?=[^A-Za-z]|$)/gi, "$1[奉献]")
	data = data.replace(/(^|[^A-Za-z])(ENDURANCE)(?=[^A-Za-z]|$)/gi, "$1[忍耐]")
	data = data.replace(/(^|[^A-Za-z])(VALOR)(?=[^A-Za-z]|$)/gi, "$1[英勇]")
	//data=data.replace(/(^|[^A-Za-z])(ATTRIBUTE)(?=[^A-Za-z]|$)/gi, '$1[___]'); //
	data = data.replace(/(^|[^A-Za-z])(MASTERY)(?=[^A-Za-z]|$)/gi, "$1[技术]") //
	data = data.replace(/(^|[^A-Za-z])(QUICKENI*?N*?G*?)(?=[^A-Za-z]|$)/gi, "$1[复苏]")
	data = data.replace(/(^|[^A-Za-z])(MEMORY)(?=[^A-Za-z]|$)/gi, "$1[记忆]")
	//data=data.replace(/(^|[^A-Za-z])(SLAYING)(?=[^A-Za-z]|$)/gi, '$1[___]'); //
	data = data.replace(/(^|[^A-Za-z])(DEATHBANE)(?=[^A-Za-z]|$)/gi, "$1[不死族克星]")

	data = data.replace(/(^|[^A-Za-z])(AND)(?=[^A-Za-z]|$)/gi, "$1和")
	//data=data.replace(/(^|[^A-Za-z])(MORE)(?=[^A-Za-z]|$)/gi, '$1更多');
	data = data.replace(/(^|[^A-Za-z])(OR)(?=[^A-Za-z]|$)/gi, "$1或")
	data = data.replace(/(^|[^A-Za-z])(IRONS*?(?: IN*?GN*?OTS*?)?)(?=[^A-Za-z]|$)/gi, "$1铁矿石")
	data = data.replace(/(^|[^A-Za-z])(GRANITE SLABS*?|GRANITES*?)(?=[^A-Za-z]|$)/gi, "$1花岗岩石板")
	data = data.replace(/(^|[^A-Za-z])(BONEE*?S*?)(?=[^A-Za-z]|$)/gi, "$1骨头")

	data = data.replace(/(^|[^A-Za-z])(APP*?TITUDES*?)(?=[^A-Za-z]|$)/gi, "$1\"能力\"")

	//组
	data = data.replace(/(^|[^A-Za-z])(A+?\s+(STA*?C*?KS*?|STKS|STK|STAX|STACS*?)+?)(?=[^A-Za-z]|$)/gi, "$1一组")
	data = data.replace(/(^|[^A-Za-z])(STA*?C*?KS*?|STKS|STK|STAX|STACS*?)(?=[^A-Za-z]|$)/gi, "$1组")

	data = data.replace(/(\d)Z(?![A-Za-z])/gi, "$1战承钥匙") //(\s*?)
	//报结果
	return data
}