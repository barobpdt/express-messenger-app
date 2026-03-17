import player from './player.js'

const canvasStyle = `
	position:absolute;
	top:0;
	left:0;
	width:100%;
	height:100%;
`
const imgInfo = {
	player: './images/sprite/player.png',
	dog: './images/sprite/shadow_dog.png'
}

class gameMain {
	constructor(el, style) {
		const c = $('<canvas style="' + style + '"/>').appendTo(getJq(el))
		this.canvas = c[0]
		this.ctx = this.canvas.getContext('2d')
		this.canvas.width = c.width()
		this.canvas.height = c.height()
		this.width = this.canvas.width
		this.height = this.canvas.height
		this.imageMap = {}
		this.player = null
		this.keydownTick = 0
		this.keyupTick = 0
		this.fps = 30
		this.particles = {
			dust: [],
			splash: [],
		}
		this.keys = []
		this.initGame()
		clog('@@gameMain', this)
	}
	initGame() {
		this.loadImages().then(() => {
			this.player = new player(this, this.imageMap.player)
			this.gameLoop()
		})
		window.addEventListener('keydown', (e) => {
			if (this.isKeys(e.key)) {
				if (this.keys.includes(e.key)) return
				this.keys.push(e.key)
				this.keydownTick = Date.now()
				clog("@@keydown", e.key, this.keys)
			}
		})
		window.addEventListener('keyup', (e) => {
			if (this.isKeys(e.key)) {
				this.keys.splice(this.keys.indexOf(e.key), 1)
				this.keyupTick = Date.now()
				clog("@@keyup", e.key, this.keys)
			}
		})
	}
	isKeys(key) {
		return key == 'ArrowLeft' || key == 'ArrowRight' ||
			key == 'ArrowDown' || key == 'ArrowUp' ||
			key == ' ' || key == 'Enter'
	}
	gameLoop(timeStemp) {
		this.update()
		requestAnimationFrame(this.gameLoop.bind(this))
	}
	loadImages() {
		for (const key in imgInfo) {
			const img = new Image()
			img.src = imgInfo[key]
			this.imageMap[key] = img
		}
		const imageMap = this.imageMap
		const imageList = Object.values(imageMap)
		const imageCount = imageList.length
		let loadedCount = 0
		return new Promise((resolve) => {
			imageList.forEach(image => {
				image.onload = () => {
					loadedCount++
					if (loadedCount === imageCount) {
						resolve()
					}
				}
				image.onerror = () => {
					loadedCount++
					if (loadedCount === imageCount) {
						resolve()
					}
				}
			})
		})
	}
	update() {
		this.ctx.clearRect(0, 0, this.width, this.height)
		this.player.update(this.ctx)
		this.updateParticles()
	}
	drawParticle(ctx, type, particle) {
		const { x, y, size, alpha } = particle
		ctx.save()
		ctx.globalAlpha = alpha
		if (type == 'dust') {
			ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
			ctx.beginPath()
			ctx.arc(x, y, size, 0, Math.PI * 2)
			ctx.fill()
		} else if (type == 'splash') {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
			ctx.beginPath()
			ctx.arc(x, y, size, 0, Math.PI * 2)
			ctx.fill()
		}
		ctx.restore()
	}
	addParticle(type, x, y) {
		const particle = {
			x,
			y,
			size: 5,
			life: 100,
			alpha: 1,
			dx: Math.random() * 2 - 1,
			dy: Math.random() * 2 - 1,
		}
		clog('@@addParticle', type, x, y, particle)
		this.particles[type].push(particle)
	}
	updateParticles() {
		this.particles.dust.forEach((particle, index) => {
			const { dx, dy } = particle
			particle.x += dx
			particle.y += dy
			particle.size *= 0.95
			particle.life -= 1
			particle.alpha -= 0.02
			this.drawParticle(this.ctx, 'dust', particle)
			if (particle.life <= 0) {
				this.particles.dust.splice(index, 1)
			}
		})
		this.particles.splash.forEach(particle => {
			particle.x += particle.dx
			particle.y += particle.dy
			particle.size *= 0.95
			particle.life -= 1
			particle.alpha -= 0.02
			this.drawParticle(this.ctx, 'splash', particle)
			if (particle.life <= 0) {
				this.particles.splash.splice(index, 1)
			}
		})
	}



}

$(document).ready(function () {
	pageInfo.game = new gameMain('app', canvasStyle)
})


