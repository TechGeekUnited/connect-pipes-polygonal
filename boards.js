function shuffle(array) {
	let currentIndex = array.length,  randomIndex;
	while (currentIndex != 0) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}

	return array;
}

const game = {
	board: new Map(),
	source: null,
	won: false,
	makeWin() {
		game.won = true;
		document.getElementById("win-text").style.visibility = "visible";
		for (const [_, poly] of game.board) {
			poly.locked = true;
			poly.lastCanvasUpdate = currentCanvasUpdate;
		}
	},
	calcLight() {
		const hasLight = new Map();
		const hasCycle = new Map();
		for (const [key, poly] of game.board) {
			poly.search.visited = 0;
			hasLight.set(key, poly.hasLight);
			hasCycle.set(key, poly.hasCycle);
			poly.hasLight = false;
			poly.hasCycle = false;
		}
		function DFS(u, parent) {
			u.search.visited = true;
			for (let i = 0; i < u.sides; i++) {
				const v = u.connections[i];
				if (v === parent) continue;
				if (!v || !u.hasConnection(i)) continue;
				if (!v.hasConnection(v.connections.indexOf(u))) continue;
				if (v.search.visited) {
					v.hasCycle = true;
					u.hasCycle = true;
				} else {
					v.hasLight = true;
					DFS(v, u);
				}
			}
		}
		game.source.hasLight = 1;
		DFS(game.source, game.source);
		let allLit = true;
		for (const [key, poly] of game.board) {
			if (!poly.hasLight || poly.hasCycle) allLit = false;
			if (hasLight.get(key) !== poly.hasLight) poly.lastCanvasUpdate = currentCanvasUpdate;
		}
		if (allLit) game.makeWin();
	},
	generateFromBoard() {
		game.won = false;
		document.getElementById("win-text").style.visibility = "hidden";
		const NODE_PROBABILITY = 0.07;
		const EDGE_PROBABILITY = 0.11;
		const queue = new Queue();
		for (const [_key, poly] of game.board) {
			if (Math.random() < NODE_PROBABILITY || poly === game.source) queue.push(poly);
		}
		for (const [_key, poly] of game.board) {
			if (poly.dsu.root !== poly || poly.dsu.size > 1) continue;
			queue.push(poly);
			while (queue.length()) {
				const top = queue.pop();
				let validCons = top.connections.map((other, idx) => [other, idx])
					.filter(con => con[0] && con[0].dsu_find() !== top.dsu_find());
				if (!validCons.length) continue;
				if (queue.length === 0 || top === poly) { 
					let rng = Math.floor(Math.random() * validCons.length);
					top.addConnection(validCons[rng][1]);
					validCons[rng][0].addConnection(validCons[rng][0].connections.indexOf(top));
					top.dsu_union(validCons[rng][0]);
					queue.push(validCons[rng][0]);
				}
				for (const con of validCons) {
					if (Math.random() < EDGE_PROBABILITY && con[0].dsu_find() !== top.dsu_find()) {
						top.addConnection(con[1]);
						con[0].addConnection(con[0].connections.indexOf(top));
						top.dsu_union(con[0]);
						queue.push(con[0]);
					}
				}
			}
		}
		if (game.source.dsu.size === game.board.size) return;
		function DFS(u) {
			u.search.visited = true;
			const order = shuffle(Array.from(Array(u.sides), (_, i) => i));
			for (const i of order) {
				if (u.connections[i] && !u.connections[i].search.visited) {
					DFS(u.connections[i]);
					if (u.dsu_find() !== u.connections[i].dsu_find()) {
						u.addConnection(i);
						u.connections[i].addConnection(u.connections[i].connections.indexOf(u));
						u.dsu_union(u.connections[i]);
					}
				}
			}
		}
		DFS(game.source);
	},
	generateGame(type, x, y) {
		game.board = new Map();
		BOARD_TYPES[type].generate(x, y);
		game.generateFromBoard();
		for (const [_, poly] of game.board) {
			poly.pipesRotation = Math.floor(Math.random() * poly.sides);
			poly.pipesRotationDisplay = poly.pipesRotation;
		}
		game.calcLight();
		initBoard();
	}
};

const BOARD_TYPES = {
	square: {
		generate(x, y) {
			for (let i = 0; i < x; i++) {
				for (let j = 0; j < y; j++) {
					game.board.set(i * 1e7 + j, new Polygon(4, 32, [i * 32 + 16, j * 32 + 16]));
				}
			}
			game.source = game.board.get(Math.floor(x / 2) * 1e7 + Math.floor(y / 2));
			for (let i = 0; i < x; i++) {
				for (let j = 0; j < y; j++) {
					const poly = game.board.get(i * 1e7 + j);
					poly.connections[0] = game.board.get((i + 1) * 1e7 + j);
					poly.connections[1] = game.board.get(i * 1e7 + (j - 1));
					poly.connections[2] = game.board.get((i - 1) * 1e7 + j);
					poly.connections[3] = game.board.get(i * 1e7 + (j + 1));
				}
			}
		}
	},
	triangle: {
		generate(x, y) {
			const keyFrom = (x, y) => x.toString() + "_" + y.toString();
			const sideLen = 50;
			const midptR = sideLen / Math.sqrt(3) / 2;
			const diam = sideLen * Math.sqrt(3) / 2;
			for (let j = 0; j < y; j++) {
				const subtr = ((j === y - 1) && (y % 2 === 1)) ? 1 : 0;
				for (let i = 0 + subtr; i < 2 * x - 1 - subtr; i++) {
					game.board.set(
						keyFrom(i, j),
						new Polygon(3, sideLen,
							[(i + 1) * sideLen / 2, j * diam + midptR * (2 - (i + j) % 2)],
							(i + j) % 2 === 0 ? Math.PI / 6 : -Math.PI * 5 / 6
						)
					);
				}
			}
			game.source = game.board.get(keyFrom(x - 1, Math.floor(y / 2)));
			for (const [key, poly] of game.board) {
				let [x1, y1] = key.split("_");
				x1 = parseInt(x1, 10);
				y1 = parseInt(y1, 10);
				const type = (y1 + x1) % 2;
				poly.connections[type] = game.board.get(keyFrom(x1 + 1, y1));
				poly.connections[1 - type] = game.board.get(keyFrom(x1 - 1, y1));
				poly.connections[2] = game.board.get(keyFrom(x1, y1 + (type === 0 ? 1 : -1)));
			}
		}
	},
	hexagon: {
		generate(x, y) {
			const keyFrom = (x, y) => x.toString() + "_" + y.toString();
			const sideLen = 24;
			const midptR = sideLen / 2 / Math.tan(Math.PI / 6);
			for (let i = 0; i < y; i++) {
				for (let j = -Math.min(i, y - 1 - i); j < x + Math.min(i, y - 1 - i); j++) {
					game.board.set(
						keyFrom(i * 2, j * 2 + 1), 
						new Polygon(6, sideLen, [(j + 1) * midptR * 2, i * sideLen * 3 + sideLen])
					);
				}
			}
			for (let i = 0; i < y - 1; i++) {
				for (let j = -Math.min(i, y - 2 - i); j < x + 1 + Math.min(i, y - 2 - i); j++) {
					game.board.set(
						keyFrom(i * 2 + 1, j * 2), 
						new Polygon(6, sideLen, [j * midptR * 2 + midptR, i * sideLen * 3 + sideLen * 2.5])
					);
				}
			}
			for (const [key, poly] of game.board) {
				let [y1, x1] = key.split("_");
				x1 = parseInt(x1, 10);
				y1 = parseInt(y1, 10);
				poly.connections[0] = game.board.get(keyFrom(y1, x1 + 2));
				poly.connections[1] = game.board.get(keyFrom(y1 - 1, x1 + 1));
				poly.connections[2] = game.board.get(keyFrom(y1 - 1, x1 - 1));
				poly.connections[3] = game.board.get(keyFrom(y1, x1 - 2));
				poly.connections[4] = game.board.get(keyFrom(y1 + 1, x1 - 1));
				poly.connections[5] = game.board.get(keyFrom(y1 + 1, x1 + 1));
			}
			game.source = game.board.get(keyFrom(y - 1, Math.ceil(x / 2) * 2 - ((y % 2 === 1) ? 1 : 0)));
		}
	}
}

window.onload = () => requestAnimationFrame(() => game.generateGame("square", 5, 5));
