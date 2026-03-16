const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const posSep = location.host.indexOf(':')
const connectUrl = posSep > 0 ? location.host.substring(0, posSep) : location.host
const socket = io('http://' + connectUrl + ':8082')

const scoreEl = document.querySelector('#scoreEl')

const devicePixelRatio = window.devicePixelRatio || 1

canvas.width = 1024 * devicePixelRatio
canvas.height = 576 * devicePixelRatio

c.scale(devicePixelRatio, devicePixelRatio)

const x = canvas.width / 2
const y = canvas.height / 2

const frontEndPlayers = {}
const frontEndProjectiles = {}
const frontEndBombs = {}
const particles = []
const friction = 0.99

const playerImages = {
  circle: new Image(),
  square: new Image(),
  triangle: new Image(),
  star: new Image()
}
playerImages.circle.src = './img/spaceship_guardian.png'
playerImages.square.src = './img/spaceship_titan.png'
playerImages.triangle.src = './img/spaceship_striker.png'
playerImages.star.src = './img/spaceship_celestial.png'

class Particle {
  constructor(x, y, radius, color, velocity) {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.velocity = velocity
    this.alpha = 1
  }

  draw() {
    c.save()
    c.globalAlpha = this.alpha
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
    c.restore()
  }

  update() {
    this.draw()
    this.velocity.x *= friction
    this.velocity.y *= friction
    this.x = this.x + this.velocity.x
    this.y = this.y + this.velocity.y
    this.alpha -= 0.01
  }
}

class Projectile {
  constructor({ x, y, radius, color = 'white', velocity }) {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.velocity = velocity
  }

  draw() {
    c.save()
    c.shadowColor = this.color
    c.shadowBlur = 15
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
    
    // Add a core glow
    c.beginPath()
    c.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2, false)
    c.fillStyle = 'white'
    c.fill()
    c.restore()
  }

  update() {
    this.draw()
    this.x = this.x + this.velocity.x
    this.y = this.y + this.velocity.y
  }
}

class Bomb {
  constructor({ x, y, color }) {
    this.x = x
    this.y = y
    this.radius = 15
    this.color = color
    this.pulse = 0
  }

  draw() {
    this.pulse += 0.1
    const size = this.radius + Math.sin(this.pulse) * 3
    
    c.save()
    c.shadowColor = 'red'
    c.shadowBlur = 20
    c.beginPath()
    c.arc(this.x, this.y, size, 0, Math.PI * 2)
    c.fillStyle = '#1e293b'
    c.strokeStyle = 'red'
    c.lineWidth = 3
    c.fill()
    c.stroke()
    
    // Fuse
    c.beginPath()
    c.moveTo(this.x, this.y - size)
    c.lineTo(this.x + 5, this.y - size - 10)
    c.strokeStyle = '#92400e'
    c.lineWidth = 2
    c.stroke()
    
    // Spark
    c.beginPath()
    c.arc(this.x + 5, this.y - size - 10, 3 + Math.random() * 2, 0, Math.PI * 2)
    c.fillStyle = 'orange'
    c.fill()
    
    c.restore()
  }
}



class Player {
  constructor({ x, y, radius, color, username, character, angle }) {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.username = username
    this.character = character || 'circle'
    this.angle = angle || 0
  }

  draw() {
    c.save()
    
    // Label
    c.font = 'bold 14px sans-serif'
    c.fillStyle = 'rgba(255, 255, 255, 0.8)'
    c.textAlign = 'center'
    c.fillText(this.username, this.x, this.y + this.radius + 25)
    
    // Rotate and Draw Sprite
    c.translate(this.x, this.y)
    // The sprites face up by default (usually), but atan2(dy, dx) considers 0 to be right.
    // If original sprite faces up, we add PI/2. Let's assume they face right for now or adjust.
    // Most top-down game sprites face right (0 rad).
    c.rotate(this.angle)
    
    const img = playerImages[this.character]
    if (img.complete) {
      const size = this.radius * 4 // Adjust size as needed
      c.drawImage(img, -size/2, -size/2, size, size)
    } else {
      // Fallback to shapes if image not loaded
      c.shadowColor = this.color
      c.shadowBlur = 15
      c.fillStyle = this.color
      c.beginPath()
      c.arc(0, 0, this.radius, 0, Math.PI * 2)
      c.fill()
    }
    
    c.restore()
  }
}

class Enemy {
  constructor(x, y, radius, color, velocity) {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.velocity = velocity
  }

  draw() {
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
  }

  update() {
    this.draw()
    this.x = this.x + this.velocity.x
    this.y = this.y + this.velocity.y
  }
}

socket.on('updateProjectiles', (backEndProjectiles) => {
  for (const id in backEndProjectiles) {
    const backEndProjectile = backEndProjectiles[id]

    if (!frontEndProjectiles[id]) {
      frontEndProjectiles[id] = new Projectile({
        x: backEndProjectile.x,
        y: backEndProjectile.y,
        radius: 5,
        color: frontEndPlayers[backEndProjectile.playerId]?.color,
        velocity: backEndProjectile.velocity
      })
    } else {
      frontEndProjectiles[id].x += backEndProjectiles[id].velocity.x
      frontEndProjectiles[id].y += backEndProjectiles[id].velocity.y
    }
  }

  for (const frontEndProjectileId in frontEndProjectiles) {
    if (!backEndProjectiles[frontEndProjectileId]) {
      delete frontEndProjectiles[frontEndProjectileId]
    }
  }
})

socket.on('updatePlayers', (backEndPlayers) => {
  for (const id in backEndPlayers) {
    const backEndPlayer = backEndPlayers[id]

    if (!frontEndPlayers[id]) {
      frontEndPlayers[id] = new Player({
        x: backEndPlayer.x,
        y: backEndPlayer.y,
        radius: 10,
        color: backEndPlayer.color,
        username: backEndPlayer.username,
        character: backEndPlayer.character,
        angle: backEndPlayer.angle || 0
      })

      document.querySelector(
        '#playerLabels'
      ).innerHTML += `<div data-id="${id}" data-score="${backEndPlayer.score}">${backEndPlayer.username}: ${backEndPlayer.score}</div>`
    } else {
      document.querySelector(
        `div[data-id="${id}"]`
      ).innerHTML = `${backEndPlayer.username}: ${backEndPlayer.score}`

      document
        .querySelector(`div[data-id="${id}"]`)
        .setAttribute('data-score', backEndPlayer.score)

      // sorts the players divs
      const parentDiv = document.querySelector('#playerLabels')
      const childDivs = Array.from(parentDiv.querySelectorAll('div'))

      childDivs.sort((a, b) => {
        const scoreA = Number(a.getAttribute('data-score'))
        const scoreB = Number(b.getAttribute('data-score'))

        return scoreB - scoreA
      })

      // removes old elements
      childDivs.forEach((div) => {
        parentDiv.removeChild(div)
      })

      // adds sorted elements
      childDivs.forEach((div) => {
        parentDiv.appendChild(div)
      })

      frontEndPlayers[id].target = {
        x: backEndPlayer.x,
        y: backEndPlayer.y,
        angle: backEndPlayer.angle || 0
      }

      if (id === socket.id) {
        const lastBackendInputIndex = playerInputs.findIndex((input) => {
          return backEndPlayer.sequenceNumber === input.sequenceNumber
        })

        if (lastBackendInputIndex > -1)
          playerInputs.splice(0, lastBackendInputIndex + 1)

        playerInputs.forEach((input) => {
          frontEndPlayers[id].target.x += input.dx
          frontEndPlayers[id].target.y += input.dy
        })
      }
    }
  }

  // this is where we delete frontend players
  for (const id in frontEndPlayers) {
    if (!backEndPlayers[id]) {
      const divToDelete = document.querySelector(`div[data-id="${id}"]`)
      divToDelete.parentNode.removeChild(divToDelete)

      if (id === socket.id) {
        document.querySelector('#loginModal').style.display = 'flex'
      }

      delete frontEndPlayers[id]
    }
  }
})

socket.on('updateBombs', (backEndBombs) => {
  for (const id in backEndBombs) {
    const backEndBomb = backEndBombs[id]
    if (!frontEndBombs[id]) {
      frontEndBombs[id] = new Bomb({
        x: backEndBomb.x,
        y: backEndBomb.y,
        color: frontEndPlayers[backEndBomb.playerId]?.color || 'white'
      })
    }
  }

  for (const id in frontEndBombs) {
    if (!backEndBombs[id]) {
      // Explosion effect
      const bomb = frontEndBombs[id]
      for (let i = 0; i < 30; i++) {
        particles.push(new Particle(
          bomb.x, 
          bomb.y, 
          Math.random() * 5, 
          '#ef4444', 
          { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 }
        ))
      }
      delete frontEndBombs[id]
    }
  }
})

socket.on('gameOver', ({ winner, ranking }) => {
  document.querySelector('#resultModal').style.display = 'flex'
  document.querySelector('#resultTitle').innerText = winner === frontEndPlayers[socket.id]?.username ? 'VICTORY!' : 'YOU DIED!'
  document.querySelector('#resultTitle').style.color = winner === frontEndPlayers[socket.id]?.username ? '#4ade80' : '#fbbf24'
  
  const rankingList = document.querySelector('#rankingList')
  rankingList.innerHTML = `<h3 style="margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px">Winner: ${winner}</h3>`
  ranking.forEach((entry, index) => {
    rankingList.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:16px;">
      <span>${index + 1}. ${entry.username}</span>
      <span style="color:#60a5fa">${entry.score} pts</span>
    </div>`
  })
})

let animationId
function animate() {
  animationId = requestAnimationFrame(animate)
  // c.fillStyle = 'rgba(0, 0, 0, 0.1)'
  c.clearRect(0, 0, canvas.width, canvas.height)

  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id]

    // linear interpolation
    if (frontEndPlayer.target) {
      frontEndPlayers[id].x +=
        (frontEndPlayers[id].target.x - frontEndPlayers[id].x) * 0.5
      frontEndPlayers[id].y +=
        (frontEndPlayers[id].target.y - frontEndPlayers[id].y) * 0.5
      
      // Interpolate angle
      let angleDiff = frontEndPlayers[id].target.angle - frontEndPlayers[id].angle
      // Normalize angle difference to [-PI, PI] for shortest rotation
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      frontEndPlayers[id].angle += angleDiff * 0.5
    }

    frontEndPlayer.draw()
  }

  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id]
    frontEndProjectile.draw()
    
    // Add trial effect
    if (Math.random() > 0.5) {
      particles.push(new Particle(
        frontEndProjectile.x, 
        frontEndProjectile.y, 
        Math.random() * 2, 
        frontEndProjectile.color, 
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 }
      ))
    }
  }

  for (const id in frontEndBombs) {
    frontEndBombs[id].draw()
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i]
    if (particle.alpha <= 0) {
      particles.splice(i, 1)
    } else {
      particle.update()
    }
  }
}

animate()

const keys = {
  w: { pressed: false },
  a: { pressed: false },
  s: { pressed: false },
  d: { pressed: false },
  ArrowUp: { pressed: false },
  ArrowLeft: { pressed: false },
  ArrowDown: { pressed: false },
  ArrowRight: { pressed: false }
}

const SPEED = 5
const playerInputs = []
let sequenceNumber = 0
let lastAngle = 0 // Track the last movement direction

setInterval(() => {
  let dx = 0
  let dy = 0

  if (keys.w.pressed || keys.ArrowUp.pressed) dy -= SPEED
  if (keys.s.pressed || keys.ArrowDown.pressed) dy += SPEED
  if (keys.a.pressed || keys.ArrowLeft.pressed) dx -= SPEED
  if (keys.d.pressed || keys.ArrowRight.pressed) dx += SPEED

  if (dx !== 0 || dy !== 0) {
    sequenceNumber++
    playerInputs.push({ sequenceNumber, dx, dy })
    
    // Update lastAngle based on current movement vector
    lastAngle = Math.atan2(dy, dx)
    
    // Emit for server syncing
    if (dy < 0) socket.emit('keydown', { keycode: 'ArrowUp', sequenceNumber })
    else if (dy > 0) socket.emit('keydown', { keycode: 'ArrowDown', sequenceNumber })
    
    if (dx < 0) socket.emit('keydown', { keycode: 'ArrowLeft', sequenceNumber })
    else if (dx > 0) socket.emit('keydown', { keycode: 'ArrowRight', sequenceNumber })
  }
}, 15)

window.addEventListener('keydown', (event) => {
  if (!frontEndPlayers[socket.id]) return

  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.w.pressed = true
      keys.ArrowUp.pressed = true
      break

    case 'KeyA':
    case 'ArrowLeft':
      keys.a.pressed = true
      keys.ArrowLeft.pressed = true
      break

    case 'KeyS':
    case 'ArrowDown':
      keys.s.pressed = true
      keys.ArrowDown.pressed = true
      break

    case 'KeyD':
    case 'ArrowRight':
      keys.d.pressed = true
      keys.ArrowRight.pressed = true
      break
    
    case 'Space':
      shootInDirection()
      break

    case 'KeyB':
      dropBomb()
      break
  }
})

function dropBomb() {
  if (!frontEndPlayers[socket.id]) return
  socket.emit('dropBomb', {
    x: frontEndPlayers[socket.id].x,
    y: frontEndPlayers[socket.id].y
  })
}

function shootInDirection() {
  if (!frontEndPlayers[socket.id]) return
  
  let dx = 0
  let dy = 0
  if (keys.w.pressed || keys.ArrowUp.pressed) dy -= 1
  if (keys.s.pressed || keys.ArrowDown.pressed) dy += 1
  if (keys.a.pressed || keys.ArrowLeft.pressed) dx -= 1
  if (keys.d.pressed || keys.ArrowRight.pressed) dx += 1

  const currentAngle = (dx !== 0 || dy !== 0) ? Math.atan2(dy, dx) : lastAngle
  
  // Add randomness
  const angle = currentAngle + (Math.random() - 0.5) * 0.2

  socket.emit('shoot', {
    x: frontEndPlayers[socket.id].x,
    y: frontEndPlayers[socket.id].y,
    angle
  })
}

window.addEventListener('keyup', (event) => {
  if (!frontEndPlayers[socket.id]) return

  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.w.pressed = false
      keys.ArrowUp.pressed = false
      break

    case 'KeyA':
    case 'ArrowLeft':
      keys.a.pressed = false
      keys.ArrowLeft.pressed = false
      break

    case 'KeyS':
    case 'ArrowDown':
      keys.s.pressed = false
      keys.ArrowDown.pressed = false
      break

    case 'KeyD':
    case 'ArrowRight':
      keys.d.pressed = false
      keys.ArrowRight.pressed = false
      break
  }
})

document.querySelector('#usernameForm').addEventListener('submit', (event) => {
  event.preventDefault()
  document.querySelector('#loginModal').style.display = 'none'
  socket.emit('initGame', {
    width: canvas.width,
    height: canvas.height,
    devicePixelRatio,
    username: document.querySelector('#usernameInput').value,
    character: document.querySelector('#characterSelect').value
  })
})



addEventListener('click', (event) => {
  const canvas = document.querySelector('canvas')
  const { top, left } = canvas.getBoundingClientRect()
  const playerPosition = {
    x: frontEndPlayers[socket.id].x,
    y: frontEndPlayers[socket.id].y
  }

  const angle = Math.atan2(
    event.clientY - top - playerPosition.y,
    event.clientX - left - playerPosition.x
  )

  // const velocity = {
  //   x: Math.cos(angle) * 5,
  //   y: Math.sin(angle) * 5
  // }

  socket.emit('shoot', {
    x: playerPosition.x,
    y: playerPosition.y,
    angle
  })
  // frontEndProjectiles.push(
  //   new Projectile({
  //     x: playerPosition.x,
  //     y: playerPosition.y,
  //     radius: 5,
  //     color: 'white',
  //     velocity
  //   })
  // )

  console.log(frontEndProjectiles)
})
