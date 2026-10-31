import { useId } from "react";

export const TEAM_AVATARS = [
  ["nova", "نُوا"], ["fox", "روباه نئونی"], ["astro", "فضانورد"], ["cat", "گربه سایبری"],
  ["panda", "پاندای کیهانی"], ["bolt", "ربات برق"], ["bunny", "خرگوش فضایی"], ["ninja", "نینجای شب"]
] as const;
export const TEAM_COLORS = ["violet", "cyan", "orange", "green", "rose", "blue", "amber", "mint"];
export const COLOR_VALUES: Record<string, string> = { violet: "#8268f3", cyan: "#36aeca", orange: "#e98b43", green: "#4eae77", rose: "#dd6f8e", blue: "#568ae5", amber: "#d4a13c", mint: "#50ae9b" };
export const COLOR_NAMES = ["بنفش", "فیروزه‌ای", "نارنجی", "سبز", "صورتی", "آبی", "طلایی", "نعنایی"];

// Original scalable collectible mascots: layered glass, metallic rim, neon eyes.
export function TeamAvatar({ avatarId, colorKey = "violet", size = 44 }: { avatarId?: string; colorKey?: string; size?: number }) {
  const id = useId().replaceAll(":", "");
  const kind = TEAM_AVATARS.some(([key]) => key === avatarId) ? avatarId : "nova";
  const color = COLOR_VALUES[colorKey] ?? COLOR_VALUES.violet;
  return <svg className="team-avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-bg`} x2="1" y2="1"><stop stopColor={color}/><stop offset="1" stopColor="#10152f"/></linearGradient>
      <linearGradient id={`${id}-shell`} x2=".7" y2="1"><stop stopColor="#fff"/><stop offset=".45" stopColor="#cbd5f5"/><stop offset="1" stopColor={color}/></linearGradient>
      <linearGradient id={`${id}-visor`} x2="0" y2="1"><stop stopColor="#253958"/><stop offset="1" stopColor="#090e25"/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#fff" stopOpacity=".55"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
    </defs>
    <rect x="2" y="2" width="96" height="96" rx="29" fill={`url(#${id}-bg)`}/>
    <circle cx="25" cy="17" r="42" fill={`url(#${id}-glow)`}/>
    <path d="M12 73L74 11M26 90L91 25" stroke="#fff" strokeOpacity=".09" strokeWidth="2"/>
    <ellipse cx="50" cy="87" rx="27" ry="5" fill="#080c24" opacity=".35"/>
    {(kind === "fox" || kind === "cat") && <path d="M23 46L19 15L42 31M58 31L81 15L77 46" fill={kind === "fox" ? "#ffc281" : "#c9baff"} stroke="#fff" strokeWidth="2"/>}
    {kind === "bunny" && <><rect x="29" y="9" width="14" height="38" rx="7" fill="#f4d5fa" transform="rotate(-12 36 28)"/><rect x="58" y="7" width="14" height="40" rx="7" fill="#f4d5fa" transform="rotate(12 65 27)"/></>}
    {kind === "panda" && <><circle cx="26" cy="32" r="13" fill="#202c48"/><circle cx="74" cy="32" r="13" fill="#202c48"/></>}
    {(kind === "nova" || kind === "bolt") && <><path d="M50 32V16" stroke="#dceaff" strokeWidth="4"/><circle cx="50" cy="15" r="5" fill="#a8fff4"/><rect x="14" y="47" width="12" height="22" rx="5" fill={color}/><rect x="74" y="47" width="12" height="22" rx="5" fill={color}/></>}
    <path d="M26 88Q27 72 40 71H60Q73 72 74 88" fill={`url(#${id}-shell)`}/>
    <rect x="22" y="29" width="56" height="49" rx={kind === "bolt" ? 15 : 25} fill={`url(#${id}-shell)`} stroke="#fff" strokeOpacity=".65" strokeWidth="1.5"/>
    {kind === "astro" && <circle cx="50" cy="53" r="33" fill="none" stroke="#e9f5ff" strokeWidth="5"/>}
    <rect x="27" y="40" width="46" height="28" rx="13" fill={`url(#${id}-visor)`}/>
    <path d="M32 45Q47 40 65 45" stroke="#fff" strokeOpacity=".22" strokeWidth="2" fill="none"/>
    {kind === "ninja" ? <><path d="M22 43H78V52H22Z" fill={color}/><path d="M72 45L88 38L84 51Z" fill={color}/><path d="M34 55L43 58M57 58L66 55" stroke="#b3fff5" strokeWidth="3.5" strokeLinecap="round"/></> : <><rect x="35" y="51" width="7" height={kind === "fox" ? 5 : 9} rx="3" fill="#b3fff5"/><rect x="58" y="51" width="7" height={kind === "fox" ? 5 : 9} rx="3" fill="#b3fff5"/></>}
    {kind === "fox" && <path d="M46 64L50 68L54 64" fill="#ffbc91"/>}
    {kind === "cat" && <path d="M29 62L19 59M29 66L18 67M71 62L81 59M71 66L82 67" stroke="#e9ceff" strokeWidth="2" strokeLinecap="round"/>}
    {kind === "bolt" && <path d="M52 72L44 82H50L47 90L58 79H52Z" fill="#fff6a3"/>}
    <path d="M82 17V25M78 21H86" stroke="#fff" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round"/>
    <rect x="2" y="2" width="96" height="96" rx="29" fill="none" stroke="#fff" strokeOpacity=".25"/>
  </svg>;
}
