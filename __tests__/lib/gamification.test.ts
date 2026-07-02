import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  levelFromXp,
  minXpForLevel,
  xpProgressInLevel,
  xpToNextLevel,
  checkinRiskLevel,
  DAILY_LOG_XP,
  WEEKLY_CHECKIN_XP,
  HABIT_HIT_XP,
} from '../../lib/gamification'

// ─── levelFromXp ─────────────────────────────────────────────────────────────
// Espelha calculate_level(xp) = FLOOR(xp / 500) + 1 (supabase/schema_core.sql)
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

  it('returns level 2 at 999 XP (boundary)', () => {
    assert.equal(levelFromXp(999), 2)
  })

  it('returns level 3 at exactly 1000 XP', () => {
    assert.equal(levelFromXp(1000), 3)
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
  it('level 3 starts at 1000', () => assert.equal(minXpForLevel(3), 1000))
  it('level 4 starts at 1500', () => assert.equal(minXpForLevel(4), 1500))

  it('gap between levels is always exactly 500 XP', () => {
    for (let n = 1; n <= 8; n++) {
      assert.equal(minXpForLevel(n + 1) - minXpForLevel(n), 500, `gap at level ${n}`)
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
    assert.ok(Math.abs(xpProgressInLevel(750) - 0.5) < 0.01)
  })

  it('is always between 0 and 1', () => {
    for (const xp of [0, 499, 500, 999, 1000, 1499, 1500]) {
      const p = xpProgressInLevel(xp)
      assert.ok(p >= 0 && p < 1, `progress=${p} for xp=${xp}`)
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

  it('needs 500 XP from start of level 2', () => {
    assert.equal(xpToNextLevel(500), 500)
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

// ─── Constantes de XP (espelham os valores reais gravados no banco) ──────────
describe('DAILY_LOG_XP', () => {
  it('matches update_gamification_after_log() in schema_core.sql', () => {
    assert.equal(DAILY_LOG_XP.water_check, 10)
    assert.equal(DAILY_LOG_XP.workout_check, 20)
    assert.equal(DAILY_LOG_XP.sleep_check, 10)
    assert.equal(DAILY_LOG_XP.meal_plan_check, 30)
    assert.equal(DAILY_LOG_XP.daily_victory, 10)
    assert.equal(DAILY_LOG_XP.proof_photo, 10)
  })
})

describe('WEEKLY_CHECKIN_XP', () => {
  it('is 20 XP', () => assert.equal(WEEKLY_CHECKIN_XP, 20))
})

describe('HABIT_HIT_XP', () => {
  it('simple hit gives 10 XP', () => assert.equal(HABIT_HIT_XP.simple, 10))
  it('gallery hit gives 15 XP', () => assert.equal(HABIT_HIT_XP.gallery, 15))
  it('camera hit gives 20 XP', () => assert.equal(HABIT_HIT_XP.camera, 20))
})
