if (settings.mode === 'omok') {
    if (checkOmokWin()) {
      gameActive = false;
      alert('축하합니다! 당신이 승리했습니다.');
      setCtrlsEnabled(true);
      return;
    }
  }
  
  
  if (settings.mode === 'omok') {
      aiPlayOmok();
    } else 
		
	
if (settings.mode === 'omok' && gameActive) {
    if (checkOmokWin()) {
      gameActive = false;
      syncCaptured(); // Draw result
      updateStatusBar();
      alert('백(AI)이 승리했습니다.');
      isAiThinking = false;
      showThinking(false);
      setCtrlsEnabled(true);
      return;
    }
  }



/** Omok Win Condition (5 in a row) */
function checkOmokWin() {
  const s = settings.size;
  const IS = s + 2;
  const pos = goban.position();
  const lastMove = goban.history().slice(-1)[0]?.move;
  if (!lastMove) return false;

  const color = pos[lastMove] & 3;
  const dirs = [1, IS, IS + 1, IS - 1]; // Horiz, Vert, Diag1, Diag2

  for (const d of dirs) {
    let count = 1;
    // one direction
    for (let i = 1; i < 5; i++) {
      if ((pos[lastMove + d * i] & 3) === color) count++;
      else break;
    }
    // other direction
    for (let i = 1; i < 5; i++) {
      if ((pos[lastMove - d * i] & 3) === color) count++;
      else break;
    }
    if (count >= 5) return true;
  }
  return false;
}

/** Heuristic Omok AI */
function aiPlayOmok() {
  const s = settings.size;
  const IS = s + 2;
  const side = goban.side();
  const opp = 3 - side;
  const pos = goban.position();

  let empties = [];
  for (let r = 1; r <= s; r++) {
    for (let c = 1; c <= s; c++) {
      if ((pos[r * IS + c] & 3) === 0) empties.push(r * IS + c);
    }
  }

  const scored = empties.map(sq => {
    let score = 0;
    const dirs = [1, IS, IS + 1, IS - 1];
    
    for (const d of dirs) {
      score += evaluateOmokDir(pos, sq, d, side, opp);
    }
    
    // Slight preference for center
    const row = Math.floor(sq / IS);
    const col = sq % IS;
    const centerDist = Math.abs(row - s/2) + Math.abs(col - s/2);
    score += (s - centerDist) * 0.1;
    
    return { sq, score };
  }).sort((a,b) => b.score - a.score);

  if (scored.length > 0) {
    // If we have highly rated moves (threatening 4 or 5), take the best
    // Otherwise add a bit of randomness to top moves
    const threshold = scored[0].score * 0.9;
    const candidates = scored.filter(m => m.score >= threshold).slice(0, 3);
    const best = candidates[Math.floor(Math.random() * candidates.length)].sq;
    
    goban.play(best, side, false);
    goban.refresh();
  } else {
    goban.pass();
    goban.refresh();
  }
}

function evaluateOmokDir(pos, sq, d, side, opp) {
  let score = 0;

  const check = (color) => {
    let count = 0;
    let openEnds = 0;
    
    // Check both ways
    for (const step of [d, -d]) {
      let currentIdx = sq + step;
      let foundWall = false;
      for (let i = 0; i < 4; i++) {
        const val = pos[currentIdx] & 3;
        if (val === color) count++;
        else if (val === 0) { openEnds++; break; }
        else { foundWall = true; break; }
        currentIdx += step;
      }
    }

    if (count >= 4) return 10000; // Win/Block win
    if (count === 3 && openEnds >= 1) return color === side ? 1000 : 800;
    if (count === 2 && openEnds >= 1) return color === side ? 100 : 80;
    if (count === 1 && openEnds >= 1) return 10;
    return 0;
  };

  score += check(side); // Attack
  score += check(opp) * 1.5; // Defense (prioritize blocking)
  return score;
}
  