// scripts/test-match-algo.js
const mockPlayers = [
  { id: '1', name: 'Pro 1', skill_level: 5 },
  { id: '2', name: 'Pro 2', skill_level: 5 },
  { id: '3', name: 'Mid 1', skill_level: 3 },
  { id: '4', name: 'Mid 2', skill_level: 3 },
  { id: '5', name: 'Beg 1', skill_level: 1 },
  { id: '6', name: 'Beg 2', skill_level: 1 },
];

function scoreMatchInternal(t1, t2, justPlayed, history) {
  let score = 1000;
  const t1Skill = t1[0].skill_level + t1[1].skill_level;
  const t2Skill = t2[0].skill_level + t2[1].skill_level;
  const diff = Math.abs(t1Skill - t2Skill);
  const allPlayers = [...t1, ...t2];
  
  // 1. Anti-Back-to-Back (Massive Penalty)
  for (const p of allPlayers) if (justPlayed.has(p.id)) score -= 2000;
  
  // 2. Team Balance
  score -= (diff * 100);
  
  // 3. Sanity Check
  const skills = allPlayers.map(p => p.skill_level);
  for (let i = 0; i < 4; i++) {
    const others = skills.filter((_, idx) => idx !== i);
    const avgOthers = others.reduce((a, b) => a + b, 0) / 3;
    if (Math.abs(skills[i] - avgOthers) > 2.5) score -= 1000; // Increased penalty for isolated player
  }
  return score;
}

function test() {
  console.log('--- Testing Match Scoring Logic ---');

  // Case 1: Balanced vs Unbalanced
  const balancedT1 = [mockPlayers[0], mockPlayers[4]]; // 5 + 1 = 6
  const balancedT2 = [mockPlayers[1], mockPlayers[5]]; // 5 + 1 = 6
  const score1 = scoreMatchInternal(balancedT1, balancedT2, new Set(), []);
  
  const unbalancedT1 = [mockPlayers[0], mockPlayers[1]]; // 5 + 5 = 10
  const unbalancedT2 = [mockPlayers[4], mockPlayers[5]]; // 1 + 1 = 2
  const score2 = scoreMatchInternal(unbalancedT1, unbalancedT2, new Set(), []);

  console.log(`Balanced (6v6) Score: ${score1}`);
  console.log(`Unbalanced (10v2) Score: ${score2}`);
  if (score1 > score2) console.log('✅ Balance rule working');

  // Case 2: Back-to-Back
  const score3 = scoreMatchInternal(balancedT1, balancedT2, new Set(['1']), []);
  const score4 = scoreMatchInternal(balancedT1, balancedT2, new Set(), []);

  console.log(`B2B Penalty Score: ${score3}`);
  console.log(`Fresh Player Score: ${score4}`);
  if (score3 < score4) console.log('✅ Anti-Back-to-Back rule working');

  // Case 3: Dumb Arrangement (3 Pros vs 1 Beginner)
  // Teams: [5, 5] vs [5, 1]. Total skill: 10 vs 6. Diff: 4.
  const dumbT1 = [mockPlayers[0], mockPlayers[1]]; // 5, 5
  const dumbT2 = [mockPlayers[1], mockPlayers[4]]; // 5, 1
  const score5 = scoreMatchInternal(dumbT1, dumbT2, new Set(), []);
  console.log(`Dumb lineup (5,5,5,1) Score: ${score5}`);
  if (score5 < score1) console.log('✅ Sanity check working');
}

test();
