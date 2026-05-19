import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Called by cron every 30 minutes — fires due reminders
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get current time in HH:MM for Brazil (UTC-3)
  const now = new Date()
  const brazilHour = (now.getUTCHours() - 3 + 24) % 24
  const brazilMinute = now.getUTCMinutes()
  // Match reminders within a 30-min window
  const timeStr = `${String(brazilHour).padStart(2, '0')}:${String(Math.floor(brazilMinute / 30) * 30).padStart(2, '0')}`

  const dayOfWeek = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCDay()

  const { data: reminders } = await supabase
    .from('patient_reminders')
    .select('*, profiles!inner(onesignal_player_id)')
    .eq('is_active', true)
    .eq('time_local', timeStr)
    .contains('days_of_week', [dayOfWeek])

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID
  const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY
  let sent = 0

  for (const reminder of reminders) {
    const playerId = (reminder.profiles as any)?.onesignal_player_id
    if (!playerId || !ONESIGNAL_APP_ID || !ONESIGNAL_KEY) continue

    try {
      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${ONESIGNAL_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: [playerId],
          headings: { en: reminder.label, pt: reminder.label },
          contents: { en: reminder.message, pt: reminder.message },
          data: { type: 'reminder', reminder_type: reminder.reminder_type },
        }),
      })
      sent++
    } catch (e) {
      console.error('[reminders cron]', e)
    }
  }

  return NextResponse.json({ sent, total: reminders.length })
}
