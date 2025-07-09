import { supabase } from "../services/supabase";

// Award a badge to a user if not already earned
export async function awardBadge(userId: string, badgeName: string) {
  // Get badge id
  const { data: badge, error: badgeError } = await supabase
    .from("badges")
    .select("id")
    .eq("name", badgeName)
    .maybeSingle();
  if (badgeError || !badge) return;

  // Check if user already has this badge
  const { data: existing, error: existingError } = await supabase
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_id", badge.id)
    .maybeSingle();
  if (existingError || existing) return;

  // Award badge
  await supabase.from("user_badges").insert({
    user_id: userId,
    badge_id: badge.id,
  });
} 