import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  levelFromXp,
  minXpForLevel,
  xpProgressInLevel,
  xpToNextLevel,
  streakBonus,
  checkinRiskLevel,
  XP_REWARDS,
} from '../../lib/gamification'

// ─── levelFromXp ─────────────────────────────────────────────────────────────
describe('levelFromXp', () => {
  it('returns level 1 for 0 XP', () => {
    assert.equal(levelFromXp(0), 1)
  })

  it('returns level 1 at 499 XP (boundary)', () => {
    assert.equal(levelFromXp(499), 1)
  })

  it('returns level 2 at exactly 500 XP', () => {
    assert.equal(levelFromXp(500), 2)
  })

  it('returns level 2 at 1499 XP (boundary)', () => {
    assert.equal(levelFromXp(1499), 2)
  })

  it('returns level 3 at exactly 1500 XP', () => {
    assert.equal(levelFromXp(1500), 3)
  })

  it('returns level 3 at 2999 XP (boundary)', () => {
    assert.equal(levelFromXp(2999), 3)
  })

  it('returns level 4 at exactly 3000 XP', () => {
    assert.equal(levelFromXp(3000), 4)
  })

  it('returns level 1 for negative XP', () => {
    assert.equal(levelFromXp(-100), 1)
  })

  it('is consistent with minXpForLevel', () => {
    for (let level = 1; level <= 10; level++) {
      const minXp = minXpForLevel(level)
      assert.equal(levelFromXp(minXp), level, `level ${level} at min XP ${minXp}`)
      if (level > 1) {
        assert.equal(levelFromXp(minXp - 1), level - 1, `one below min XP of level ${level}`)
      }
    }
  })
})

// ─── minXpForLevel ───────────────────────────────────────────────────────────
describe('minXpForLevel', () => {
  it('level 1 starts at 0', () => assert.equal(minXpForLevel(1), 0))
  it('level 2 starts at 500', () => assert.equal(minXpForLevel(2), 500))
  it('level 3 starts at 1500', () => assert.equal(minXpForLevel(3), 1500))
  it('level 4 starts at 3000', () => assert.equal(minXpForLevel(4), 3000))
  it('level 5 starts at 5000', () => assert.equal(minXpForLevel(5), 5000))

  it('gap between levels increases by 500 each time', () => {
    for (let n = 2; n <= 8; n++) {
      const gap = minXpForLevel(n + 1) - minXpForLevel(n)
      const prevGap = minXpForLevel(n) - minXpForLevel(n - 1)
      assert.equal(gap - prevGap, 500, `gap increment at level ${n}`)
    }
  })
})

// ─── xpProgressInLevel ───────────────────────────────────────────────────────
describe('xpProgressInLevel', () => {
  it('returns 0 at the start of level 1', () => {
    assert.equal(xpProgressInLevel(0), 0)
  })

  it('returns 0 at the start of level 2', () => {
    assert.equal(xpProgressInLevel(500), 0)
  })

  it('returns 0.5 at the midpoint of level 2 (750 XP)', () => {
    // L2: 500–1499 (gap=1000), midpoint=500+500=1000
    assert.ok(Math.abs(xpProgressInLevel(1000) - 0.5) < 0.01)
  })

  it('is always between 0 and 1', () => {
    for (const xp of [0, 499, 500, 999, 1499, 1500, 2999, 3000]) {
      const p = xpProgressInLevel(xp)
      assert.ok(p >= 0 && p <= 1, `progress=${p} for xp=${xp}`)
    }
  })
})

// ─── xpToNextLevel ───────────────────────────────────────────────────────────
describe('xpToNextLevel', () => {
  it('needs 500 XP from level 1 start', () => {
    assert.equal(xpToNextLevel(0), 500)
  })

  it('needs 1 XP when at 499 (end of level 1)', () => {
    assert.equal(xpToNextLevel(499), 1)
  })

  it('needs 1000 XP from start of level 2', () => {
    assert.equal(xpToNextLevel(500), 1000)
  })
})

// ─── streakBonus ─────────────────────────────────────────────────────────────
describe('streakBonus', () => {
  it('returns 0 for streaks below 7', () => {
    for (const s of [0, 1, 3, 6]) {
      assert.equal(streakBonus(s), 0, `streak=${s}`)
    }
  })

  it('returns 50 at exactly 7 days', () => {
    assert.equal(streakBonus(7), 50)
  })

  it('returns 50 between 7 and 13 days', () => {
    assert.equal(streakBonus(13), 50)
  })

  it('returns 75 at exactly 14 days', () => {
    assert.equal(streakBonus(14), 75)
  })

  it('returns 100 at exactly 21 days', () => {
    assert.equal(streakBonus(21), 100)
  })

  it('returns 150 at exactly 30 days', () => {
    assert.equal(streakBonus(30), 150)
  })

  it('returns 200 at exactly 60 days', () => {
    assert.equal(streakBonus(60), 200)
  })

  it('returns 300 at exactly 100 days', () => {
    assert.equal(streakBonus(100), 300)
  })

  it('returns 300 beyond 100 days', () => {
    assert.equal(streakBonus(365), 300)
  })
})

// ─── checkinRiskLevel ────────────────────────────────────────────────────────
describe('checkinRiskLevel', () => {
  it('returns high for diet score 0–4', () => {
    for (const s of [0, 1, 2, 3, 4]) {
      assert.equal(checkinRiskLevel(s), 'high', `score=${s}`)
    }
  })

  it('returns medium for diet score 5–6', () => {
    for (const s of [5, 6]) {
      assert.equal(checkinRiskLevel(s), 'medium', `score=${s}`)
    }
  })

  it('returns low for diet score 7–10', () => {
    for (const s of [7, 8, 9, 10]) {
      assert.equal(checkinRiskLevel(s), 'low', `score=${s}`)
    }
  })
})

// ─── XP_REWARDS constants ────────────────────────────────────────────────────
describe('XP_REWARDS', () => {
  it('daily checkin gives 30 XP', () => assert.equal(XP_REWARDS.daily_checkin, 30))
  it('hydration goal gives 10 XP', () => assert.equal(XP_REWARDS.hydration_goal, 10))
  it('exercise logged gives 20 XP', () => assert.equal(XP_REWARDS.exercise_logged, 20))
  it('weekly checkin gives 20 XP', () => assert.equal(XP_REWARDS.weekly_checkin, 20))
  it('challenge complete gives 100 XP', () => assert.equal(XP_REWARDS.challenge_complete, 100))
})
