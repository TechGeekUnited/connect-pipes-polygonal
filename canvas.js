const canvas = document.getElementById("c"), ctx = canvas.getContext("2d");

function renderPolygon(polygon) {
	if (currentCanvasUpdate - polygon.lastCanvasUpdate > 2) return;
	ctx.fillStyle = polygon.locked ? "#888" : "#bbb";
	ctx.strokeStyle = "#000";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(polygon.vertices[0][0], polygon.vertices[0][1]);
	for (let i = 1; i <= polygon.sides; i++) {
		ctx.lineTo(polygon.vertices[i % polygon.sides][0], polygon.vertices[i % polygon.sides][1]);
	}
	ctx.fill();
	ctx.stroke();
	let connections = 0;
	for (let i = 0; i < polygon.sides; i++) {
		if ((polygon.pipes & (1 << i)) === 0) continue;
		connections++;
	}
	ctx.fillStyle = "#000";
	ctx.beginPath();
	const circleSize = polygon === game.source ? 10 : (connections > 1 ? 2 : 7);
	ctx.arc(polygon.position[0], polygon.position[1], circleSize, 0, 2 * Math.PI);
	ctx.fill();
	ctx.strokeStyle = "#000";
	ctx.lineWidth = 4;
	ctx.beginPath();
	const [x, y] = polygon.position;
	for (let i = 0; i < polygon.sides; i++) {
		if ((polygon.pipes & (1 << i)) === 0) continue;
		ctx.moveTo(x, y);
		let v = [polygon.midpts[i][0] - x, polygon.midpts[i][1] - y];
		// Rotation matrix
		const ang = -polygon.pipesRotationDisplay * 2 * Math.PI / polygon.sides;
		const cosang = Math.cos(ang), sinang = Math.sin(ang);
		v = [v[0] * cosang - v[1] * sinang, v[0] * sinang + v[1] * cosang];
		ctx.lineTo(v[0] + x, v[1] + y);
	}
	ctx.stroke();
	if (polygon.hasLight) {
		ctx.beginPath();
		ctx.lineWidth = 2;
		ctx.strokeStyle = polygon.hasCycle ? "#f00" : "#0f0";
		for (let i = 0; i < polygon.sides; i++) {
			if ((polygon.pipes & (1 << i)) === 0) continue;
			ctx.moveTo(x, y);
			let v = [polygon.midpts[i][0] - x, polygon.midpts[i][1] - y];
			// Rotation matrix
			const ang = -polygon.pipesRotationDisplay * 2 * Math.PI / polygon.sides;
			const cosang = Math.cos(ang), sinang = Math.sin(ang);
			v = [v[0] * cosang - v[1] * sinang, v[0] * sinang + v[1] * cosang];
			ctx.lineTo(v[0] + x, v[1] + y);
		}
		ctx.stroke();
	}
	if (polygon === game.source) {
		ctx.fillStyle = "#000";
		ctx.beginPath();
		ctx.arc(polygon.position[0], polygon.position[1], 10, 0, 2 * Math.PI);
		ctx.fill();
		ctx.strokeStyle = "#0f0";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(polygon.position[0], polygon.position[1], 6, 0, 2 * Math.PI);
		ctx.stroke();
	} else if (polygon.hasLight) {
		ctx.fillStyle = polygon.hasCycle ? "#f00" : "#0f0";
		ctx.beginPath();
		ctx.arc(polygon.position[0], polygon.position[1], circleSize - 1, 0, 2 * Math.PI);
		ctx.fill();
	}
}

let currentCanvasUpdate = 0;
let init = false;
let boardTransform = [5, 5];
function initBoard() {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const [_key, poly] of game.board) {
		poly.computeVertices();
		for (let vertex of poly.vertices) {
			maxX = Math.max(maxX, vertex[0]);
			maxY = Math.max(maxY, vertex[1]);
			minX = Math.min(minX, vertex[0]);
			minY = Math.min(minY, vertex[1]);
		}
	}
	canvas.width = (maxX - minX) + 10;
	canvas.height = (maxY - minY) + 10;
	ctx.resetTransform();
	ctx.translate(5 - minX, 5 - minY);
	boardTransform = [5 - minX, 5 - minY];
	if (!init) renderBoard();
	init = true;
}
function renderBoard() {
	if (canvas.width > window.innerWidth) canvas.style.alignSelf = "flex-start";
	else canvas.style.alignSelf = "center";
	currentCanvasUpdate++;
	for (const [_key, poly] of game.board) {
		poly.updatePipesRotationDisplay();
		renderPolygon(poly);
	}
	requestAnimationFrame(renderBoard);
}

let eventsStack = [], eventsStackPtr = 0;
canvas.addEventListener("click", (ev) => {
	const x = ev.offsetX - boardTransform[0], y = ev.offsetY - boardTransform[1];
	for (const [_, poly] of game.board) {
		if (poly.isClicked(x, y)) {
			if (ev.shiftKey) {
				poly.pipesRotateAnticlockwise();
				eventsStack[eventsStackPtr] = ["cc", _];
			} else {
				poly.pipesRotateClockwise();
				eventsStack[eventsStackPtr] = ["c", _];
			}
			eventsStackPtr++;
			if (eventsStack.length > eventsStackPtr) eventsStack.length = eventsStackPtr;
			break;
		}
	}
});

canvas.addEventListener("contextmenu", (ev) => {
	if (game.won) return;
	const x = ev.offsetX - boardTransform[0], y = ev.offsetY - boardTransform[1];
	for (const [_, poly] of game.board) {
		if (poly.isClicked(x, y)) {
			poly.locked = !poly.locked;
			eventsStack.push(["l", _]);
			eventsStackPtr++;
			if (eventsStack.length > eventsStackPtr) eventsStack.length = eventsStackPtr;
			poly.lastCanvasUpdate = currentCanvasUpdate;
			break;
		}
	}
	ev.preventDefault();
});

document.addEventListener("keydown", (ev) => {
	if (game.won || !ev.ctrlKey) return;
	if (ev.key === "z") {
		if (!eventsStackPtr) return;
		eventsStackPtr--;
		const [e, k] = eventsStack[eventsStackPtr];
		const poly = game.board.get(k);
		switch (e) {
			case "l": {
				poly.locked = !poly.locked;
				break;
			}
			case "cc": {
				poly.pipesRotateClockwise();
				break;
			}
			case "c": {
				poly.pipesRotateAnticlockwise();
				break;
			}
		}
		poly.lastCanvasUpdate = currentCanvasUpdate;
	} else if (ev.key === "y") {
		if (!eventsStack[eventsStackPtr]) return;
		const [e, k] = eventsStack[eventsStackPtr];
		eventsStackPtr++;
		const poly = game.board.get(k);
		switch (e) {
			case "l": {
				poly.locked = !poly.locked;
				break;
			}
			case "cc": {
				poly.pipesRotateAnticlockwise();
				break;
			}
			case "c": {
				poly.pipesRotateClockwise();
				break;
			}
		}
		poly.lastCanvasUpdate = currentCanvasUpdate;
	}
});