"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Mascot } from "@/components/game/Mascot";
import { TimerRing } from "@/components/game/TimerRing";
import { GameAudio, type MusicTrack, type GameSound } from "@/components/game/GameAudio";
import { TeamAvatar, TEAM_AVATARS, TEAM_COLORS, COLOR_VALUES, COLOR_NAMES } from "@/components/game/TeamAvatar";
import { apiGet, apiPost, enqueueAndFlush, flushOutbox } from "@/lib/game/client-sync";
import { loadCatalogPack, pickCatalogWords, refreshOnlinePack } from "@/lib/game/catalog-client";
import type { CatalogPackDTO, CategoryDTO, GameChoiceDTO, GameDTO, RoundSummary, RuntimeMode, TeamDTO, WordDTO } from "@/types/game";

type Screen =
  | "HOME"
  | "SETUP"
  | "LIBRARY"
  | "READY"
  | "CATEGORY"
  | "REVEAL"
  | "PLAYING"
  | "ROUND_RESULT"
  | "SCOREBOARD"
  | "WINNER";

type ThemePreference = "light" | "dark" | "system";
type ModalKind = "rules" | "settings" | "score" | "new-game" | "team-style" | null;
type PlayFeedback = "success" | "failure" | null;

type GameConfig = {
  teamNames: string[];
  teamStyles?: { colorKey: string; avatarId: string }[];
  roundCount: number;
  roundDuration: number;
  categoryIds: number[];
};

type PersistedSnapshot = {
  version: 1;
  screen: Screen;
  game: GameDTO;
  config: GameConfig;
  selectedCategoryId?: number | null;
  activeCategoryIds?: number[];
  usedChoices?: GameChoiceDTO[];
  selectedPoints: 2 | 4 | 6 | 30 | null;
  queue: WordDTO[];
  currentWord: WordDTO | null;
  turnId: string | null;
  timerEndAt: number | null;
  roundStats: RoundSummary;
  lastRoundSummary: RoundSummary | null;
  lastTeamName: string | null;
  changeUsed?: boolean;
  gameRuntimeMode?: RuntimeMode;
  usedWordIds?: number[];
  pausedRemainingMs?: number | null;
  resolutionReason?: "correct" | "timeout" | null;
};

const SNAPSHOT_KEY = "pantomin-active-game-v1";
const SETUP_KEY = "pantomin-setup-v1";
const SOUND_KEY = "pantomin-sound-v1";
const THEME_KEY = "pantomin-theme";
const CATEGORY_PREF_KEY = "pantomin-category-preferences-v1";
const RANDOM_CATEGORY_KEY = "pantomin-random-category-v1";
const CONTINUOUS_MODE_KEY = "pantomin-continuous-mode-v1";
const RUNTIME_MODE_KEY = "pantomin-runtime-mode-v1";
const MUSIC_KEY = "pantomin-music-v1";
const AUDIO_LEVELS_KEY = "pantomin-audio-levels-v1";
const teamStyle = (config: GameConfig, index: number) => ({
  colorKey: TEAM_COLORS.includes(config.teamStyles?.[index]?.colorKey ?? "") ? config.teamStyles![index].colorKey : TEAM_COLORS[index % TEAM_COLORS.length],
  avatarId: TEAM_AVATARS.some(([id]) => id === config.teamStyles?.[index]?.avatarId) ? config.teamStyles![index].avatarId : TEAM_AVATARS[index % TEAM_AVATARS.length][0]
});

const initialConfig: GameConfig = {
  teamNames: ["تیم آبی", "تیم نارنجی"],
  roundCount: 3,
  roundDuration: 60,
  categoryIds: []
};

const emptyStats: RoundSummary = { score: 0, correctCount: 0, skippedCount: 0 };

function sortScoreboard(teams: TeamDTO[]) {
  return [...teams].sort((a, b) => Number(a.forfeited) - Number(b.forfeited) || b.score - a.score || a.position - b.position);
}

function currentTeam(game: GameDTO | null) {
  return game?.teams.find((team) => team.id === game.currentTeamId) ?? null;
}

function preferredCategoryIds(available: CategoryDTO[]) {
  const allIds = available.map((item) => item.id);
  if (typeof window === "undefined") return allIds;
  try {
    const stored = JSON.parse(localStorage.getItem(CATEGORY_PREF_KEY) || "[]") as number[];
    const allowed = new Set(allIds);
    const valid = stored.filter((id) => Number.isInteger(id) && allowed.has(id));
    return valid.length ? valid : allIds;
  } catch {
    return allIds;
  }
}

function advanceGameLocally(game: GameDTO): GameDTO {
  const ordered = [...game.teams].sort((a, b) => a.position - b.position);
  const active = ordered.filter((team) => !team.forfeited);
  if (active.length <= 1) return { ...game, status: "FINISHED", currentTeamId: null };
  const current = ordered.find((team) => team.id === game.currentTeamId);
  if (!current) return game;
  const later = active.find((team) => team.position > current.position);
  if (later) return { ...game, currentTeamId: later.id };
  const nextRound = game.currentRound + 1;
  if (nextRound > game.roundCount) return { ...game, status: "FINISHED", currentTeamId: null };
  return { ...game, currentRound: nextRound, currentTeamId: active[0].id };
}

function localSpeedBonus(basePoints: number, elapsedMs: number, roundDurationSeconds: number) {
  if (![2, 4, 6].includes(basePoints)) return 0;
  const bonusWindowMs = Math.max(1000, (roundDurationSeconds * 1000) / 3);
  if (elapsedMs >= bonusWindowMs) return 0;
  const ratio = Math.max(0, Math.min(1, (bonusWindowMs - elapsedMs) / bonusWindowMs));
  return Math.max(1, Math.min(3, Math.ceil(ratio * 3)));
}

function icon(name: "back" | "settings" | "sound" | "moon" | "score" | "home") {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-7h6v7" /></>,
    back: <path d="M15 18l-6-6 6-6" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15.4a1.7 1.7 0 0 0-1.56-1.03H5v-3h.08A1.7 1.7 0 0 0 6.64 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.36 5.94l.06.06A1.7 1.7 0 0 0 10.3 6.34a1.7 1.7 0 0 0 1.03-1.56V4h3v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 9.3a1.7 1.7 0 0 0 1.56 1.03H21v3h-.08A1.7 1.7 0 0 0 19.4 15z" /></>,
    sound: <><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></>,
    moon: <path d="M20 15.4A8 8 0 0 1 8.6 4 8 8 0 1 0 20 15.4z" />,
    score: <><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></>
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function GameApp({ renderPersonalLibrary }: { renderPersonalLibrary?: (onClose: () => void) => ReactNode } = {}) {
  const [screen, setScreen] = useState<Screen>("HOME");
  const [suspendedScreen, setSuspendedScreen] = useState<Screen | null>(null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState<number | null>(null);
  const [wordVisible, setWordVisible] = useState(false);
  const [durationInput, setDurationInput] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [config, setConfig] = useState<GameConfig>(initialConfig);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [game, setGame] = useState<GameDTO | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [activeCategoryIds, setActiveCategoryIds] = useState<number[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<2 | 4 | 6 | 30 | null>(null);
  const [queue, setQueue] = useState<WordDTO[]>([]);
  const [currentWord, setCurrentWord] = useState<WordDTO | null>(null);
  const [turnId, setTurnId] = useState<string | null>(null);
  const [roundStats, setRoundStats] = useState<RoundSummary>(emptyStats);
  const [lastRoundSummary, setLastRoundSummary] = useState<RoundSummary | null>(null);
  const [lastTeamName, setLastTeamName] = useState<string | null>(null);
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicTrack, setMusicTrack] = useState<MusicTrack>("neon");
  const [effectsVolume, setEffectsVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(.55);
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [hasResume, setHasResume] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [randomCategoryEnabled, setRandomCategoryEnabled] = useState(false);
  const [usedChoices, setUsedChoices] = useState<GameChoiceDTO[]>([]);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [continuousModeEnabled, setContinuousModeEnabled] = useState(false);
  const [changeUsed, setChangeUsed] = useState(false);
  const [playFeedback, setPlayFeedback] = useState<PlayFeedback>(null);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("online");
  const [gameRuntimeMode, setGameRuntimeMode] = useState<RuntimeMode>("online");
  const [catalogPack, setCatalogPack] = useState<CatalogPackDTO | null>(null);
  const [catalogMode, setCatalogMode] = useState<RuntimeMode | null>(null);
  const [usedWordIds, setUsedWordIds] = useState<number[]>([]);
  const [online, setOnline] = useState(true);

  const roundEndingRef = useRef(false);
  const actionLockRef = useRef(false);
  const flowLockRef = useRef(false);
  const gameAudioRef = useRef<GameAudio | null>(null);
  const roundDragStartRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const roundStatsRef = useRef<RoundSummary>(emptyStats);
  const gameRef = useRef<GameDTO | null>(null);
  const resolutionTimerRef = useRef<number | null>(null);

  const team = currentTeam(game);
  const leaderboard = useMemo(() => sortScoreboard(game?.teams ?? []), [game?.teams]);
  const availableWords = useMemo(() => {
    const used = new Set(usedWordIds);
    return (catalogPack?.words ?? []).filter(word => !used.has(word.id));
  }, [catalogPack, usedWordIds]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 2600);
  }, []);

  const getAudio = useCallback(() => gameAudioRef.current ??= new GameAudio(), []);
  const playTone = useCallback((kind: GameSound) => {
    const audio = getAudio();
    audio.configure(soundEnabled, effectsVolume, musicVolume);
    void audio.play(kind);
  }, [getAudio, soundEnabled, effectsVolume, musicVolume]);

  useEffect(() => {
    const unlock = () => getAudio().unlock();
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      gameAudioRef.current?.dispose();
      gameAudioRef.current = null;
    };
  }, [getAudio]);

  useEffect(() => {
    const audio = getAudio();
    const sync = () => {
      audio.configure(soundEnabled, effectsVolume, musicVolume);
      if (document.hidden) { audio.suspend(); return; }
      if (screen === "PLAYING" && timerEndAt && Date.now() < timerEndAt && !playFeedback) void audio.startMusic(musicTrack);
      else audio.stopMusic();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [getAudio, soundEnabled, effectsVolume, musicVolume, musicTrack, screen, timerEndAt, playFeedback]);

  useEffect(() => { getAudio().setUrgent(remaining <= 10); }, [getAudio, remaining]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(MUSIC_KEY, musicTrack);
    localStorage.setItem(AUDIO_LEVELS_KEY, JSON.stringify({ effectsVolume, musicVolume }));
  }, [preferencesReady, musicTrack, effectsVolume, musicVolume]);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  }, []);

  const loadCategories = useCallback(async (mode: RuntimeMode = game ? gameRuntimeMode : runtimeMode) => {
    setCategoriesLoading(true);
    try {
      const pack = await loadCatalogPack(mode);
      const data = pack.categories;
      const available = new Set(data.map((item) => item.id));
      setCatalogPack(pack);
      setCatalogMode(mode);
      setCategories(data);
      if (mode === "online") {
        void refreshOnlinePack().then((fresh) => {
          setCatalogPack(fresh);
          setCatalogMode("online");
          setCategories(fresh.categories);
        }).catch(() => undefined);
      }
      setConfig((current) => {
        const currentValid = current.categoryIds.filter((id) => available.has(id));
        return { ...current, categoryIds: currentValid.length ? currentValid : preferredCategoryIds(data) };
      });
      return data;
    } catch (error) {
      showToast(mode === "online" ? "اتصال به دیتابیس آماده نیست؛ حالت Local رو انتخاب کن." : error instanceof Error ? error.message : "دسته‌بندی‌ها بارگذاری نشدن.");
      return [] as CategoryDTO[];
    } finally {
      setCategoriesLoading(false);
    }
  }, [game, gameRuntimeMode, runtimeMode, showToast]);

  const openSettings = useCallback(() => {
    setModal("settings");
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setHasResume(Boolean(localStorage.getItem(SNAPSHOT_KEY) || localStorage.getItem(SETUP_KEY)));
    setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "off");
    const storedMusic = localStorage.getItem(MUSIC_KEY);
    setMusicTrack(storedMusic === "playful" || storedMusic === "off" ? storedMusic : "neon");
    try {
      const levels = JSON.parse(localStorage.getItem(AUDIO_LEVELS_KEY) || "null");
      if (typeof levels?.effectsVolume === "number") setEffectsVolume(Math.max(0, Math.min(1, levels.effectsVolume)));
      if (typeof levels?.musicVolume === "number") setMusicVolume(Math.max(0, Math.min(1, levels.musicVolume)));
    } catch { /* Use balanced defaults for old installations. */ }
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemePreference | null;
    setTheme(storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system");
    setRandomCategoryEnabled(localStorage.getItem(RANDOM_CATEGORY_KEY) === "on");
    setContinuousModeEnabled(localStorage.getItem(CONTINUOUS_MODE_KEY) === "on");
    const storedRuntime = localStorage.getItem(RUNTIME_MODE_KEY);
    setRuntimeMode(storedRuntime === "local" ? "local" : "online");
    setOnline(navigator.onLine);
    setPreferencesReady(true);
    void flushOutbox();
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!game?.id || gameRuntimeMode === "local") return;
    const syncAndRefresh = async () => {
      const remaining = await flushOutbox();
      if (remaining > 0) return;
      try {
        const fresh = await apiGet<GameDTO>(`/api/games/${game.id}`);
        setGame(fresh);
      } catch { /* keep resilient local state */ }
    };
    window.addEventListener("online", syncAndRefresh);
    return () => window.removeEventListener("online", syncAndRefresh);
  }, [game?.id, gameRuntimeMode]);


  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(RUNTIME_MODE_KEY, runtimeMode);
    if (!game) {
      setCategories([]);
      setCatalogPack(null);
      setCatalogMode(null);
      void loadCategories(runtimeMode);
    }
  }, [runtimeMode, preferencesReady, game, loadCategories]);
  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
  }, [soundEnabled, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(RANDOM_CATEGORY_KEY, randomCategoryEnabled ? "on" : "off");
  }, [randomCategoryEnabled, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(CONTINUOUS_MODE_KEY, continuousModeEnabled ? "on" : "off");
  }, [continuousModeEnabled, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.themePreference = theme;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady || !categories.length || !config.categoryIds.length) return;
    localStorage.setItem(CATEGORY_PREF_KEY, JSON.stringify(config.categoryIds));
  }, [config.categoryIds, categories.length, preferencesReady]);

  useEffect(() => {
    const savedScreen = screen === "HOME" || screen === "LIBRARY" ? suspendedScreen : screen;
    if (!game || !savedScreen || savedScreen === "SETUP") return;
    const snapshot: PersistedSnapshot = {
      version: 1,
      screen: savedScreen,
      game,
      config,
      selectedCategoryId,
      activeCategoryIds,
      usedChoices,
      selectedPoints,
      queue,
      currentWord,
      turnId,
      timerEndAt,
      roundStats,
      lastRoundSummary,
      lastTeamName,
      changeUsed,
      gameRuntimeMode,
      usedWordIds,
      pausedRemainingMs,
      resolutionReason: playFeedback && !timerEndAt ? (playFeedback === "success" ? "correct" : "timeout") : null
    };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    setHasResume(true);
  }, [screen, suspendedScreen, pausedRemainingMs, playFeedback, game, config, selectedCategoryId, activeCategoryIds, usedChoices, selectedPoints, queue, currentWord, turnId, timerEndAt, roundStats, lastRoundSummary, lastTeamName, changeUsed, gameRuntimeMode, usedWordIds]);

  useEffect(() => {
    if (screen !== "SETUP") return;
    localStorage.setItem(SETUP_KEY, JSON.stringify({ config, setupStep }));
    setHasResume(true);
  }, [screen, config, setupStep]);

  useEffect(() => { roundStatsRef.current = roundStats; }, [roundStats]);
  useEffect(() => { gameRef.current = game; }, [game]);

  const releaseUnusedWords = useCallback((words: WordDTO[]) => {
    if (!game?.id || !words.length) return Promise.resolve();
    const wordIds = [...new Set(words.map((word) => word.id))];
    setUsedWordIds((current) => current.filter((id) => !wordIds.includes(id)));
    if (gameRuntimeMode === "online") enqueueAndFlush(`/api/games/${game.id}/words/release`, { wordIds });
    return Promise.resolve();
  }, [game?.id, gameRuntimeMode]);

  const syncFinish = useCallback((gameId: string, completedTurnId: string) => {
    if (gameRuntimeMode === "online") enqueueAndFlush(`/api/games/${gameId}/turns/${completedTurnId}/finish`, {});
  }, [gameRuntimeMode]);

  const finishRound = useCallback((reason: "timeout" | "correct" = "timeout") => {
    const activeGame = gameRef.current;
    if (roundEndingRef.current || !activeGame || !turnId) return;
    roundEndingRef.current = true;
    const completedTurnId = turnId;
    const summary = { ...roundStatsRef.current };
    const specialFailure = reason === "timeout" && selectedPoints === 30 && summary.correctCount === 0;
    const gameForAdvance = specialFailure && activeGame.currentTeamId
      ? {
          ...activeGame,
          teams: activeGame.teams.map((item) => item.id === activeGame.currentTeamId ? { ...item, forfeited: true } : item)
        }
      : activeGame;
    const nextGame = advanceGameLocally(gameForAdvance);
    void releaseUnusedWords(queue);

    setRemaining(0);
    setQueue([]);
    setTimerEndAt(null);
    setPausedRemainingMs(null);
    setLastRoundSummary({ ...summary, specialThirty: selectedPoints === 30, forfeited: specialFailure });
    setLastTeamName(currentTeam(activeGame)?.name ?? null);
    setTurnId(null);
    setGame(nextGame);
    setPlayFeedback(null);
    setScreen("ROUND_RESULT");
    if (reason === "timeout") vibrate([70, 45, 90]);
    void syncFinish(activeGame.id, completedTurnId);
  }, [turnId, selectedPoints, queue, releaseUnusedWords, vibrate, syncFinish]);

  const beginTimeoutResolution = useCallback(() => {
    if (roundEndingRef.current || playFeedback || !turnId) return;
    setTimerEndAt(null);
    setRemaining(0);
    setPlayFeedback("failure");
    playTone("end");
    vibrate([55, 35, 70]);
  }, [playFeedback, turnId, playTone, vibrate, finishRound]);

  useEffect(() => {
    if (screen !== "PLAYING" || !playFeedback || timerEndAt) return;
    resolutionTimerRef.current = window.setTimeout(() => finishRound(playFeedback === "success" ? "correct" : "timeout"), 620);
    return () => { if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current); };
  }, [screen, playFeedback, timerEndAt, finishRound]);

  useEffect(() => {
    if (screen !== "PLAYING" || !timerEndAt || !game || playFeedback) return;
    const tick = () => {
      const value = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
      setRemaining(value);
      if (value > 0 && value <= 10 && lastTickRef.current !== value) {
        lastTickRef.current = value;
        playTone("tick");
      }
      if (value <= 0) beginTimeoutResolution();
    };
    tick();
    const timer = window.setInterval(tick, 120);
    return () => window.clearInterval(timer);
  }, [screen, timerEndAt, game, playFeedback, playTone, beginTimeoutResolution]);

  useEffect(() => {
    if (screen === "WINNER") playTone("win");
  }, [screen, playTone]);

  const resetForNewGame = useCallback(() => {
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem(SETUP_KEY);
    setModal(null);
    setSuspendedScreen(null);
    setPausedRemainingMs(null);
    setWordVisible(false);
    setDurationInput(null);
    setHasResume(false);
    setGame(null);
    setScreen("SETUP");
    setSetupStep(0);
    setConfig({ ...initialConfig, categoryIds: preferredCategoryIds(categories) });
    setActiveCategoryIds([]);
    setSelectedCategoryId(null);
    setSelectedPoints(null);
    setQueue([]);
    setCurrentWord(null);
    setTurnId(null);
    setRoundStats(emptyStats);
    setLastRoundSummary(null);
    setLastTeamName(null);
    setChangeUsed(false);
    setPlayFeedback(null);
    setUsedWordIds([]);
    setGameRuntimeMode(runtimeMode);
    setTimerEndAt(null);
    setRemaining(0);
    roundEndingRef.current = false;
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
    resolutionTimerRef.current = null;
    void loadCategories(runtimeMode);
  }, [loadCategories, categories, runtimeMode]);

  const resumeGame = useCallback(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) {
        const draft = JSON.parse(localStorage.getItem(SETUP_KEY) || "null");
        if (!draft?.config || !Array.isArray(draft.config.teamNames)) throw new Error();
        setConfig({ ...draft.config, categoryIds: preferredCategoryIds(categories) });
        setSetupStep(Math.max(0, Math.min(3, draft.setupStep || 0)));
        setScreen("SETUP");
        void loadCategories(runtimeMode);
        return;
      }
      const snapshot = JSON.parse(raw) as PersistedSnapshot;
      if (snapshot.version !== 1 || !snapshot.game) throw new Error();
      const restoredMode = snapshot.gameRuntimeMode ?? "online";
      const restoredScreen = (snapshot.screen as string) === "DIFFICULTY" ? "CATEGORY" : snapshot.screen;
      const paused = restoredMode === "local" ? snapshot.pausedRemainingMs ?? (restoredScreen === "PLAYING" && snapshot.timerEndAt ? Math.max(0, snapshot.timerEndAt - Date.now()) : null) : null;
      const resolution = snapshot.resolutionReason ?? (restoredScreen === "PLAYING" && !snapshot.timerEndAt && paused === null && snapshot.turnId ? (snapshot.game.playMode === "SINGLE" && snapshot.roundStats.correctCount > 0 ? "correct" : "timeout") : null);
      setScreen(restoredScreen === "PLAYING" && paused !== null && paused > 0 && !resolution ? "REVEAL" : restoredScreen as Screen);
      setSuspendedScreen(null);
      setPausedRemainingMs(paused);
      setWordVisible(false);
      setGame(snapshot.game);
      setConfig(snapshot.config);
      setActiveCategoryIds(snapshot.activeCategoryIds?.length ? snapshot.activeCategoryIds : snapshot.config.categoryIds);
      setSelectedCategoryId(snapshot.selectedCategoryId ?? null);
      setUsedChoices(snapshot.usedChoices ?? []);
      setSelectedPoints(snapshot.selectedPoints);
      setQueue(snapshot.queue || []);
      setCurrentWord(snapshot.currentWord);
      setTurnId(snapshot.turnId);
      setTimerEndAt(paused !== null && paused > 0 ? null : snapshot.timerEndAt);
      setRemaining(Math.ceil((paused ?? 0) / 1000));
      setRoundStats(snapshot.roundStats || emptyStats);
      setLastRoundSummary(snapshot.lastRoundSummary);
      setLastTeamName(snapshot.lastTeamName ?? null);
      setChangeUsed(snapshot.changeUsed ?? false);
      setGameRuntimeMode(restoredMode);
      setUsedWordIds(snapshot.usedWordIds ?? []);
      setPlayFeedback(resolution === "correct" ? "success" : resolution === "timeout" ? "failure" : null);
      roundStatsRef.current = snapshot.roundStats || emptyStats;
      roundEndingRef.current = false;
      actionLockRef.current = false;
      void loadCategories(snapshot.gameRuntimeMode ?? "online");
      if ((snapshot.gameRuntimeMode ?? "online") === "online") void flushOutbox().then((remaining) => {
        if (remaining > 0) return null;
        return apiGet<GameDTO>(`/api/games/${snapshot.game.id}`);
      }).then((fresh) => { if (fresh) setGame(fresh); }).catch(() => undefined);
      if ((snapshot.gameRuntimeMode ?? "online") === "online") void apiGet<{ choices: GameChoiceDTO[] }>(`/api/games/${snapshot.game.id}/choices`).then((data) => setUsedChoices(data.choices)).catch(() => undefined);
    } catch {
      localStorage.removeItem(SNAPSHOT_KEY);
      localStorage.removeItem(SETUP_KEY);
      setHasResume(false);
      showToast("بازی قبلی قابل بازیابی نبود.");
    }
  }, [loadCategories, showToast, categories, runtimeMode]);

  const goHome = useCallback(() => {
    if (busy || flowLockRef.current || (screen === "PLAYING" && playFeedback)) return;
    if (screen === "PLAYING" && timerEndAt && gameRuntimeMode === "local") {
      const timeLeft = Math.max(0, timerEndAt - Date.now());
      if (!timeLeft) { beginTimeoutResolution(); return; }
      setPausedRemainingMs(timeLeft);
      setTimerEndAt(null);
    }
    if (game && screen !== "HOME" && screen !== "LIBRARY" && screen !== "SETUP") setSuspendedScreen(screen);
    setWordVisible(false);
    setModal(null);
    setScreen("HOME");
  }, [busy, screen, playFeedback, timerEndAt, game, gameRuntimeMode, beginTimeoutResolution]);

  useLayoutEffect(() => {
    const handleBack = (event: Event) => {
      if (event.defaultPrevented) return;
      // The library owns its nested confirmations and unsaved editor state.
      if (screen === "LIBRARY") return;
      if (modal) { setModal(null); return; }
      if (screen !== "HOME") { goHome(); return; }
      window.dispatchEvent(new Event("pantomime:native-exit"));
    };
    window.addEventListener("pantomime:native-back", handleBack);
    return () => window.removeEventListener("pantomime:native-back", handleBack);
  }, [modal, screen, goHome]);

  const requestNewGame = () => hasResume && game?.status !== "FINISHED" ? setModal("new-game") : resetForNewGame();

  const updateTeamCount = (delta: number) => {
    setConfig((current) => {
      const nextCount = Math.max(2, Math.min(8, current.teamNames.length + delta));
      const names = [...current.teamNames];
      while (names.length < nextCount) names.push(`تیم ${names.length + 1}`);
      return { ...current, teamNames: names.slice(0, nextCount) };
    });
  };

  const adjustRoundCount = (delta: number) => {
    setConfig((current) => ({ ...current, roundCount: Math.max(1, Math.min(20, current.roundCount + delta)) }));
    vibrate(12);
  };

  const finishRoundDrag = (clientY: number) => {
    const start = roundDragStartRef.current;
    roundDragStartRef.current = null;
    if (start === null) return;
    const delta = clientY - start;
    if (Math.abs(delta) < 18) return;
    adjustRoundCount(delta < 0 ? 1 : -1);
  };

  const createGame = async () => {
    if (!config.categoryIds.length) return showToast("حداقل یک دسته رو انتخاب کن.");
    if (config.teamNames.some((name) => !name.trim())) return showToast("اسم همه تیم‌ها رو وارد کن.");
    const availableCombinations = categories
      .filter((category) => config.categoryIds.includes(category.id))
      .reduce((sum, category) => sum + ([2, 4, 6] as const).filter((points) => category.counts[`points${points}` as keyof typeof category.counts] > 0).length, 0);
    if (categories.length && availableCombinations < config.roundCount) return showToast(`برای هر تیم ${config.roundCount} انتخاب متفاوت لازم داری.`);
    if (flowLockRef.current) return;
    flowLockRef.current = true;
    setBusy(true);
    try {
      await loadCategories(runtimeMode);
      const created = runtimeMode === "local"
        ? (() => {
            const teams = config.teamNames.map((name, index) => ({ id: `local-team-${crypto.randomUUID()}`, name: name.trim(), ...teamStyle(config, index), score: 0, position: index, forfeited: false }));
            return { id: `local-game-${crypto.randomUUID()}`, roundCount: config.roundCount, roundDuration: config.roundDuration, currentRound: 1, currentTeamId: teams[0].id, playMode: continuousModeEnabled ? "CONTINUOUS" as const : "SINGLE" as const, status: "ACTIVE" as const, teams };
          })()
        : await apiPost<GameDTO>("/api/games", {
            roundCount: config.roundCount,
            roundDuration: config.roundDuration,
            categoryIds: config.categoryIds,
            playMode: continuousModeEnabled ? "CONTINUOUS" : "SINGLE",
            teams: config.teamNames.map((name, index) => ({ name: name.trim(), colorKey: teamStyle(config, index).colorKey }))
          });
      setGameRuntimeMode(runtimeMode);
      localStorage.removeItem(SETUP_KEY);
      setSuspendedScreen(null);
      setPausedRemainingMs(null);
      setGame({ ...created, teams: created.teams.map((item, index) => ({ ...item, avatarId: teamStyle(config, index).avatarId })) });
      setUsedWordIds([]);
      setActiveCategoryIds([...config.categoryIds]);
      setUsedChoices([]);
      setSelectedCategoryId(null);
      setSelectedPoints(null);
      setQueue([]);
      setCurrentWord(null);
      setTurnId(null);
      setRoundStats(emptyStats);
      setLastRoundSummary(null);
      setLastTeamName(null);
      setChangeUsed(false);
      setPlayFeedback(null);
      roundStatsRef.current = emptyStats;
      setTimerEndAt(null);
      setScreen("READY");
      roundEndingRef.current = false;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "شروع بازی انجام نشد.");
    } finally {
      flowLockRef.current = false;
      setBusy(false);
    }
  };

  const loadChoices = useCallback(async () => {
    if (!game) return [] as GameChoiceDTO[];
    if (gameRuntimeMode === "local") return usedChoices;
    setChoicesLoading(true);
    try {
      const data = await apiGet<{ choices: GameChoiceDTO[] }>(`/api/games/${game.id}/choices`);
      setUsedChoices(data.choices);
      return data.choices;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "انتخاب‌های بازی آماده نشدن.");
      return [] as GameChoiceDTO[];
    } finally {
      setChoicesLoading(false);
    }
  }, [game, gameRuntimeMode, usedChoices, showToast]);

  const choiceKey = useCallback((categoryId: number, points: 2 | 4 | 6) => `${categoryId}:${points}`, []);

  const openCategorySelection = useCallback(async () => {
    if (!game) return;
    const choices = usedChoices;
    setSelectedCategoryId(null);
    setSelectedPoints(null);
    setChangeUsed(false);
    setPlayFeedback(null);

    const catalog = categories.length ? categories : await loadCategories();
    if (!catalog.length) return;

    if (randomCategoryEnabled) {
      const used = new Set(choices
        .filter((item): item is GameChoiceDTO & { categoryId: number; points: 2 | 4 | 6 } => item.teamId === game.currentTeamId && item.categoryId !== null && item.points !== 30)
        .map((item) => choiceKey(item.categoryId, item.points)));
      const availableCategories = catalog.filter((category) => {
        if (!activeCategoryIds.includes(category.id)) return false;
        return ([2, 4, 6] as const).some((points) => availableWords.some(word => word.categoryId === category.id && word.points === points) && !used.has(choiceKey(category.id, points)));
      });
      if (!availableCategories.length) {
        setScreen("CATEGORY");
        return;
      }
      const picked = availableCategories[Math.floor(Math.random() * availableCategories.length)];
      setSelectedCategoryId(picked.id);
    }
    setScreen("CATEGORY");
  }, [game, usedChoices, randomCategoryEnabled, categories, activeCategoryIds, availableWords, choiceKey, showToast, loadCategories]);

  const fetchQueue = useCallback(async (categoryId: number | null, points: 2 | 4 | 6 | 30, count = 1) => {
    if (!game || !team) return [] as WordDTO[];
    const pack = catalogPack && catalogMode === gameRuntimeMode ? catalogPack : await loadCatalogPack(gameRuntimeMode);
    if (!catalogPack || catalogMode !== gameRuntimeMode) {
      setCatalogPack(pack);
      setCatalogMode(gameRuntimeMode);
      setCategories(pack.categories);
    }
    const selected = pickCatalogWords(pack, activeCategoryIds, categoryId, points, usedWordIds, count);
    if (!selected.length) return [] as WordDTO[];
    const words: WordDTO[] = selected.map((word) => ({ id: word.id, title: word.title, points: word.points, categoryName: word.categoryName }));
    const choice: GameChoiceDTO = { categoryId, points, teamId: team.id, roundNumber: game.currentRound };
    setUsedWordIds((current) => [...new Set([...current, ...selected.map((word) => word.id)])]);
    setUsedChoices((current) => current.some((item) => item.teamId === team.id && item.roundNumber === game.currentRound)
      ? current
      : [...current, choice]);
    if (gameRuntimeMode === "online") {
      enqueueAndFlush(`/api/games/${game.id}/choices`, {
        teamId: team.id,
        roundNumber: game.currentRound,
        categoryId,
        points,
        wordIds: selected.map((word) => word.id)
      });
    }
    return words;
  }, [game, team, catalogPack, catalogMode, gameRuntimeMode, activeCategoryIds, usedWordIds]);

  const chooseCategoryPoints = async (categoryId: number | null, points: 2 | 4 | 6 | 30) => {
    if (flowLockRef.current || !game) return;
    flowLockRef.current = true;
    setBusy(true);
    try {
      const count = game.playMode === "CONTINUOUS" && points !== 30 ? 8 : 1;
      const words = await fetchQueue(categoryId, points, count);
      if (!words.length) {
        showToast("برای این انتخاب کلمه‌ای باقی نمونده.");
        return;
      }
      setSelectedCategoryId(categoryId);
      setSelectedPoints(points);
      setCurrentWord(words[0]);
      setWordVisible(false);
      setPausedRemainingMs(null);
      setQueue(words.slice(1));
      setChangeUsed(false);
      setPlayFeedback(null);
      const freshStats: RoundSummary = { ...emptyStats, specialThirty: points === 30, faultCount: 0, speedBonus: 0, basePoints: points };
      roundStatsRef.current = freshStats;
      setRoundStats(freshStats);
      setScreen("REVEAL");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "کلمه آماده نشد.");
      void loadChoices();
    } finally {
      flowLockRef.current = false;
      setBusy(false);
    }
  };

  const changeWord = async () => {
    if (!game || !team || !currentWord || !selectedPoints || changeUsed || flowLockRef.current) return;
    flowLockRef.current = true;
    setBusy(true);
    try {
      const pack = catalogPack && catalogMode === gameRuntimeMode ? catalogPack : await loadCatalogPack(gameRuntimeMode);
      const queuedReplacement = queue[0];
      const replacement = queuedReplacement ?? pickCatalogWords(pack, activeCategoryIds, selectedCategoryId, selectedPoints, [...usedWordIds, currentWord.id], 1)[0];
      if (!replacement) return showToast("کلمه جایگزین دیگه‌ای باقی نمونده.");
      const nextWord: WordDTO = { id: replacement.id, title: replacement.title, points: replacement.points, categoryName: replacement.categoryName };
      setCurrentWord(nextWord);
      if (queuedReplacement) setQueue(items => items.slice(1));
      setUsedWordIds((current) => [...new Set([...current, replacement.id])]);
      setChangeUsed(true);
      const nextStats = { ...roundStatsRef.current, score: roundStatsRef.current.score - 1, changePenalty: 1 };
      roundStatsRef.current = nextStats;
      setRoundStats(nextStats);
      setGame((current) => current ? { ...current, teams: current.teams.map((item) => item.id === team.id ? { ...item, score: item.score - 1 } : item) } : current);
      if (gameRuntimeMode === "online") {
        enqueueAndFlush(`/api/games/${game.id}/words/change`, {
          clientEventId: crypto.randomUUID(), teamId: team.id, wordId: currentWord.id, replacementWordId: replacement.id
        });
      }
      vibrate(20);
      showToast("کلمه عوض شد؛ ۱ امتیاز کم شد.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعویض کلمه انجام نشد.");
    } finally {
      flowLockRef.current = false;
      setBusy(false);
    }
  };

  const startTimer = () => {
    if (!wordVisible || !game || !team || !currentWord || flowLockRef.current) return;
    const startedAtMs = Date.now();
    const resuming = turnId !== null && pausedRemainingMs !== null;
    const clientTurnId = resuming ? turnId : `t-${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
    setTurnId(clientTurnId);
    if (gameRuntimeMode === "online" && !resuming) {
      enqueueAndFlush(`/api/games/${game.id}/turns/start`, { teamId: team.id, turnId: clientTurnId, startedAtMs });
    }
    const durationMs = resuming ? pausedRemainingMs : game.roundDuration * 1000;
    const endAt = startedAtMs + durationMs;
    setPausedRemainingMs(null);
    setTimerEndAt(endAt);
    setRemaining(Math.ceil(durationMs / 1000));
    lastTickRef.current = null;
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
    resolutionTimerRef.current = null;
    roundEndingRef.current = false;
    actionLockRef.current = false;
    setPlayFeedback(null);
    playTone("start");
    vibrate(35);
    setScreen("PLAYING");
  };

  const registerFault = () => {
    if (actionLockRef.current || roundEndingRef.current || playFeedback || !game || !team || !turnId) return;
    if (timerEndAt && Date.now() >= timerEndAt) { beginTimeoutResolution(); return; }
    actionLockRef.current = true;
    window.setTimeout(() => { actionLockRef.current = false; }, 140);
    const nextStats: RoundSummary = { ...roundStatsRef.current, score: roundStatsRef.current.score - 1, faultCount: (roundStatsRef.current.faultCount ?? 0) + 1 };
    roundStatsRef.current = nextStats;
    setRoundStats(nextStats);
    setGame((current) => current ? { ...current, teams: current.teams.map((item) => item.id === team.id ? { ...item, score: item.score - 1 } : item) } : current);
    vibrate(18);
    if (gameRuntimeMode === "online") {
      enqueueAndFlush(`/api/games/${game.id}/turns/${turnId}/fault`, { clientEventId: crypto.randomUUID(), turnId, teamId: team.id, occurredAtMs: Date.now() });
    }
  };

  const registerAnswer = (result: "CORRECT" | "SKIPPED") => {
    if (actionLockRef.current || roundEndingRef.current || playFeedback || !game || !team || !turnId || !currentWord || !selectedPoints) return;
    if (timerEndAt && Date.now() >= timerEndAt) { beginTimeoutResolution(); return; }
    const singleTurn = game.playMode === "SINGLE" || selectedPoints === 30;
    if (singleTurn && result === "SKIPPED") return;
    actionLockRef.current = true;
    window.setTimeout(() => { if (!singleTurn) actionLockRef.current = false; }, 170);

    const answeredWord = currentWord;
    const answeredAtMs = Date.now();
    const basePoints = result === "CORRECT" ? selectedPoints : 0;
    const elapsedMs = timerEndAt ? Math.max(0, game.roundDuration * 1000 - Math.max(0, timerEndAt - answeredAtMs)) : game.roundDuration * 1000;
    const bonus = result === "CORRECT" && singleTurn && selectedPoints !== 30 ? localSpeedBonus(basePoints, elapsedMs, game.roundDuration) : 0;
    const optimisticPoints = result === "CORRECT" ? basePoints + bonus : 0;

    if (result === "CORRECT") {
      playTone("correct");
      vibrate(25);
      setPlayFeedback("success");
      if (singleTurn) setTimerEndAt(null);
      else window.setTimeout(() => setPlayFeedback((current) => current === "success" ? null : current), 260);
    }

    const nextStats: RoundSummary = {
      ...roundStatsRef.current,
      score: roundStatsRef.current.score + optimisticPoints,
      correctCount: roundStatsRef.current.correctCount + (result === "CORRECT" ? 1 : 0),
      skippedCount: roundStatsRef.current.skippedCount + (result === "SKIPPED" ? 1 : 0),
      speedBonus: result === "CORRECT" ? bonus : roundStatsRef.current.speedBonus,
      basePoints: selectedPoints
    };
    roundStatsRef.current = nextStats;
    setRoundStats(nextStats);
    if (optimisticPoints) setGame((current) => current ? { ...current, teams: current.teams.map((item) => item.id === team.id ? { ...item, score: item.score + optimisticPoints } : item) } : current);

    if (gameRuntimeMode === "online") {
      enqueueAndFlush(`/api/games/${game.id}/answers`, {
        clientEventId: crypto.randomUUID(), turnId, teamId: team.id, wordId: answeredWord.id, result, answeredAtMs
      });
    }

    if (singleTurn && result === "CORRECT") {
      return;
    }
    if (queue.length) {
      setCurrentWord(queue[0]);
      setQueue((items) => items.slice(1));
      return;
    }
    setCurrentWord(null);
    // Catalog selection is local and immediate. Refill in batches when needed;
    // never schedule navigation or other state updates inside a state updater.
    void fetchQueue(selectedCategoryId, selectedPoints, 8).then(words => {
      if (roundEndingRef.current) return;
      if (words.length) {
        setCurrentWord(words[0]);
        setQueue(words.slice(1));
      } else {
        showToast("کلمه‌های این سطح تموم شد؛ این نوبت رو می‌بندیم.");
        finishRound("timeout");
      }
    }).catch(() => {
      showToast("کلمه بعدی آماده نشد؛ امتیاز این نوبت حفظ شد.");
      finishRound("timeout");
    });
  };

  const continueAfterResult = () => setScreen("SCOREBOARD");

  const continueAfterScoreboard = () => {
    if (!game) return;
    if (game.status === "FINISHED" || !game.currentTeamId) setScreen("WINNER");
    else {
      setSelectedCategoryId(null);
      setSelectedPoints(null);
      setQueue([]);
      setCurrentWord(null);
      setRoundStats(emptyStats);
      setLastRoundSummary(null);
      setLastTeamName(null);
      setChangeUsed(false);
      setPlayFeedback(null);
      roundStatsRef.current = emptyStats;
      roundEndingRef.current = false;
      setScreen("READY");
    }
  };

  const scorePeekButton = game && screen !== "SCOREBOARD" && screen !== "WINNER" ? (
    <button className="icon-btn score-peek-icon" onClick={() => setModal("score")} aria-label="دیدن امتیازها">{icon("score")}</button>
  ) : null;

  const header = (title?: string, back?: () => void) => (
    <div className="topbar">
      <div className="brand-mini"><img className="brand-icon" src="/brand/adazi-mascot-96.webp" srcSet="/brand/adazi-mascot-96.webp 96w, /brand/adazi-mascot-192.webp 192w" sizes="36px" width={36} height={36} alt="" /><span>{title || "ادازی"}</span></div>
      <div className="topbar-actions">
        {screen !== "HOME" && <button className="icon-btn" onClick={goHome} disabled={busy} aria-label="خانه و ذخیره بازی">{icon("home")}</button>}
        {scorePeekButton}
        {back
          ? <button className="icon-btn" onClick={back} aria-label="برگشت">{icon("back")}</button>
          : <button className="icon-btn" onClick={openSettings} aria-label="تنظیمات">{icon("settings")}</button>}
      </div>
    </div>
  );

  const renderSetup = () => {
    const stepTitles = [
      ["تیم‌ها", "اسم‌ها رو همون‌جوری بنویس که صداشون می‌کنید."],
      ["چند دور؟", "با غلتک انتخابش کن؛ هر دور یعنی یک نوبت برای همه تیم‌ها."],
      ["چقدر وقت؟", "زمانی رو بگیر که بازی ریتمش رو از دست نده."],
      ["آماده‌ایم", "یه نگاه آخر؛ دسته‌های بازی از تنظیمات قابل تغییرن."]
    ] as const;

    return <div className="screen" key="SETUP">
      {header("تنظیم بازی", setupStep === 0 ? () => setScreen("HOME") : () => setSetupStep((step) => Math.max(0, step - 1)))}
      <div className="progress-dots">{stepTitles.map((_, index) => <i key={index} className={`progress-dot ${index === setupStep ? "active" : ""}`} />)}</div>
      <div className="setup-head"><div className="eyebrow">مرحله {setupStep + 1} از {stepTitles.length}</div><h1 className="title-lg">{stepTitles[setupStep][0]}</h1><p className="copy hint-copy">{stepTitles[setupStep][1]}</p></div>
      <div className="setup-body">
        <div className="setup-panel" key={setupStep}>
          {setupStep === 0 && <>
            <div className="team-count">
              <button className="count-btn" onClick={() => updateTeamCount(1)} disabled={config.teamNames.length >= 8} aria-label="اضافه کردن تیم">+</button>
              <div className="count-display"><strong className="number">{config.teamNames.length}</strong><span>تیم</span></div>
              <button className="count-btn" onClick={() => updateTeamCount(-1)} disabled={config.teamNames.length <= 2} aria-label="کم کردن تیم">−</button>
            </div>
            <div className="team-inputs">{config.teamNames.map((name, index) => {
              const style = teamStyle(config, index);
              return <div className="team-input" key={index}>
                <button className="team-style-trigger" aria-label={`ظاهر تیم ${index + 1}`} onClick={() => { setEditingTeam(index); setModal("team-style"); }}><TeamAvatar {...style} size={48} /><span>ویرایش</span></button>
                <input value={name} maxLength={50} aria-label={`نام تیم ${index + 1}`} onChange={(event) => setConfig((current) => ({ ...current, teamNames: current.teamNames.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
                <button className="team-color-trigger" style={{ background: COLOR_VALUES[style.colorKey] }} aria-label={`رنگ تیم ${index + 1}`} onClick={() => { setEditingTeam(index); setModal("team-style"); }} />
              </div>;
            })}</div>
            <p className="team-style-hint">روی آواتار یا رنگ بزن و تیم خودت رو بساز.</p>
          </>}

          {setupStep === 1 && <>
            <div className="round-wheel-shell">
              <button className="round-wheel-control" onClick={() => adjustRoundCount(-1)} disabled={config.roundCount <= 1} aria-label="کم کردن تعداد دور">−</button>
              <div
                className="round-wheel"
                role="spinbutton"
                tabIndex={0}
                aria-label="تعداد دور"
                aria-valuemin={1}
                aria-valuemax={20}
                aria-valuenow={config.roundCount}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowRight") adjustRoundCount(1);
                  if (event.key === "ArrowDown" || event.key === "ArrowLeft") adjustRoundCount(-1);
                }}
                onPointerDown={(event) => { roundDragStartRef.current = event.clientY; }}
                onPointerUp={(event) => finishRoundDrag(event.clientY)}
                onPointerCancel={() => { roundDragStartRef.current = null; }}
              >
                <span className="round-wheel-fade round-wheel-prev number">{Math.max(1, config.roundCount - 1)}</span>
                <div className="round-wheel-current" key={config.roundCount}><strong className="number">{config.roundCount}</strong><small>دور</small></div>
                <span className="round-wheel-fade round-wheel-next number">{Math.min(20, config.roundCount + 1)}</span>
              </div>
              <button className="round-wheel-control" onClick={() => adjustRoundCount(1)} disabled={config.roundCount >= 20} aria-label="اضافه کردن تعداد دور">+</button>
            </div>
            <div className="round-preset-row">{[3,5,7,10].map((value) => <button key={value} className={config.roundCount === value ? "selected" : ""} onClick={() => setConfig((current) => ({ ...current, roundCount: value }))}><span className="number">{value}</span> دور</button>)}</div>
            <p className="gesture-hint">روی غلتک بالا/پایین بکش</p>
          </>}

          {setupStep === 2 && <>
            <div className="preset-grid time-presets">{[30,45,60,90,120].map((value) => <button key={value} className={`preset-card ${config.roundDuration === value ? "selected" : ""}`} onClick={() => { setDurationInput(null); setConfig((current) => ({ ...current, roundDuration: value })); }}><strong className="number">{value}</strong><small>ثانیه</small></button>)}</div>
            <label className="custom-number"><span>زمان دلخواه</span><input aria-label="زمان دلخواه" className="number" type="number" inputMode="numeric" min={15} max={300} value={durationInput ?? config.roundDuration} onChange={(event) => { const value = event.target.value; setDurationInput(value); const seconds = Number(value); if (Number.isInteger(seconds) && seconds >= 15 && seconds <= 300) setConfig(current => ({ ...current, roundDuration: seconds })); }} onBlur={() => { if (durationInput === null) return; const seconds = Math.max(15, Math.min(300, Math.round(Number(durationInput) || 15))); setConfig(current => ({ ...current, roundDuration: seconds })); setDurationInput(null); }} /></label>
            <p className="hint-copy">بین ۱۵ تا ۳۰۰ ثانیه</p>
          </>}

          {setupStep === 3 && <div className="overview-list">
            <div className="overview-row"><span>تیم‌ها</span><strong>{config.teamNames.join("، ")}</strong></div>
            <div className="overview-row"><span>تعداد دور</span><strong>{config.roundCount} دور</strong></div>
            <div className="overview-row"><span>زمان هر نوبت</span><strong>{config.roundDuration} ثانیه</strong></div>
            <button className="overview-row overview-action" onClick={openSettings}><span>دسته‌های بازی</span><strong>{categoriesLoading ? "در حال بارگذاری…" : `${config.categoryIds.length} دسته · تغییر`}</strong></button>
            <div className="overview-row"><span>انتخاب موضوع</span><strong>{randomCategoryEnabled ? "تصادفی" : "دستی"}</strong></div>
            {!renderPersonalLibrary && <div className="overview-row"><span>حالت اجرا</span><strong>{runtimeMode === "local" ? "Local · بدون اینترنت" : "Online · همگام"}</strong></div>}
            <div className="overview-row"><span>حالت بازی</span><strong>{continuousModeEnabled ? "چندکلمه‌ای" : "یک کلمه‌ای"}</strong></div>
            <div className="overview-row"><span>امتیازها</span><strong>۲ / ۴ / ۶ + ریسک ۳۰</strong></div>
          </div>}
        </div>
      </div>
      <div className="setup-footer">
        {setupStep < stepTitles.length - 1
          ? <Button onClick={() => setSetupStep((step) => Math.min(stepTitles.length - 1, step + 1))} disabled={(setupStep === 0 && config.teamNames.some((name) => !name.trim())) || (setupStep === 2 && durationInput !== null && (!Number.isInteger(Number(durationInput)) || Number(durationInput) < 15 || Number(durationInput) > 300))}>ادامه</Button>
          : <Button onClick={createGame} disabled={busy || categoriesLoading || !config.categoryIds.length}>{busy ? "داریم آماده می‌کنیم…" : categoriesLoading ? "دسته‌ها دارن آماده می‌شن…" : "شروع بازی"}</Button>}
        <Button tone="ghost" wide={false} onClick={setupStep === 0 ? () => setScreen("HOME") : () => setSetupStep((step) => step - 1)}>برگشت</Button>
      </div>
    </div>;
  };

  const renderHome = () => <div className="screen" key="HOME">
    <div className="topbar"><div className="brand-mini"><img className="brand-icon" src="/brand/adazi-mascot-96.webp" srcSet="/brand/adazi-mascot-96.webp 96w, /brand/adazi-mascot-192.webp 192w" sizes="36px" width={36} height={36} alt="" /><span>ادازی</span></div><button className="icon-btn" onClick={openSettings} aria-label="تنظیمات">{icon("settings")}</button></div>
    <div className="hero">
      <h1 className="home-brand"><img className="brand-lockup" src="/brand/adazi-lockup-480.webp" srcSet="/brand/adazi-lockup-480.webp 480w, /brand/adazi-lockup-960.webp 960w, /brand/adazi-lockup-1440.webp 1440w" sizes="(max-width: 560px) 90vw, 440px" width={960} height={720} alt="ادازی؛ بازی گروهی حدس و اجرا" fetchPriority="high" decoding="async" /></h1>
      <p className="logo-sub">ادابازی و پانتومیم برای دورهمی‌های شما</p>
    </div>
      <div className="home-actions screen-footer">
        <Button onClick={requestNewGame}>{hasResume ? "بازی جدید" : "شروع بازی"}</Button>
        <Button tone="secondary" onClick={resumeGame} disabled={!hasResume}>ادامه بازی</Button>
        <div className="home-secondary"><Button tone="ghost" onClick={() => setModal("rules")}>قوانین بازی</Button>{renderPersonalLibrary ? <Button tone="ghost" onClick={() => setScreen("LIBRARY")}>کلمات من</Button> : <Button tone="ghost" onClick={openSettings}>تنظیمات</Button>}</div>
      </div>
  </div>;

  const renderReady = () => team && game ? <div className="screen" key="READY">
    {header(`دور ${game.currentRound} از ${game.roundCount}`)}
    <div className="turn-center ready-center">
      <div className="turn-team-pill"><i style={{ background: COLOR_VALUES[team.colorKey] }} /> نوبت این تیمه</div>
      <TeamAvatar avatarId={team.avatarId ?? TEAM_AVATARS[team.position % 8][0]} colorKey={team.colorKey} size={132} />
      <h1 className="ready-title"><span>گوشی رو بده به</span><strong>{team.name}</strong></h1>
      <p className="copy turn-copy hint-copy">فقط بازیگر صفحه بعد رو ببینه؛ آماده شدی، بزن بریم.</p>
    </div>
    <div className="turn-footer"><Button onClick={() => void openCategorySelection()} disabled={choicesLoading}>{choicesLoading ? "موضوع‌ها رو می‌چینیم…" : "آماده‌ام"}</Button></div>
  </div> : null;

  const renderCategory = () => {
    if (!team) return null;
    const used = new Set(usedChoices
      .filter((item): item is GameChoiceDTO & { categoryId: number; points: 2 | 4 | 6 } => item.teamId === team.id && item.categoryId !== null && item.points !== 30)
      .map((item) => choiceKey(item.categoryId, item.points)));
    const thirtyUsedByTeam = usedChoices.some((item) => item.teamId === team.id && item.points === 30);
    const thirtyAvailable = !thirtyUsedByTeam && availableWords.some(word => activeCategoryIds.includes(word.categoryId) && word.points === 6);
    const playableCategories = categories.filter((category) => activeCategoryIds.includes(category.id));
    const anyNormalChoice = playableCategories.some(category => ([2, 4, 6] as const).some(points => !used.has(choiceKey(category.id, points)) && availableWords.some(word => word.categoryId === category.id && word.points === points)));
    const shownCategories = randomCategoryEnabled && selectedCategoryId
      ? playableCategories.filter((category) => category.id === selectedCategoryId)
      : playableCategories;

    const pointButton = (category: CategoryDTO, points: 2 | 4 | 6) => {
      const count = availableWords.filter(word => word.categoryId === category.id && word.points === points).length;
      const alreadyUsed = used.has(choiceKey(category.id, points));
      const disabled = busy || alreadyUsed || count <= 0;
      return <button
        key={points}
        className={`category-point ${alreadyUsed ? "used" : ""}`}
        disabled={disabled}
        onClick={() => void chooseCategoryPoints(category.id, points)}
        aria-label={`${category.name} ${points} امتیازی${alreadyUsed ? "، استفاده شده" : ""}`}
      >
        <b className="number">{points}</b><small>{alreadyUsed ? "رفته" : "امتیاز"}</small>
      </button>;
    };

    return <div className="screen" key="CATEGORY">
      {header("موضوع", () => setScreen("READY"))}
      <div className="category-choice-head">
        <div><div className="eyebrow">{team.name}</div><h1 className="title-lg">موضوع + امتیاز</h1></div>
        <p className="copy hint-copy">هر تیم هر ترکیب موضوع + امتیاز رو فقط یک‌بار می‌تونه انتخاب کنه.</p>
      </div>

      <button
        className={`thirty-risk-card ${thirtyUsedByTeam ? "used" : ""}`}
        disabled={busy || !thirtyAvailable}
        onClick={() => void chooseCategoryPoints(null, 30)}
      >
        <span className="thirty-risk-copy"><small>ریسک ویژه</small><strong>۳۰ امتیاز</strong><em>{thirtyUsedByTeam ? "استفاده شده" : !thirtyAvailable ? "کلمه‌ای باقی نمونده" : "اگه نگیری، این تیم می‌بازه"}</em></span>
        <span className="thirty-risk-mark number">30</span>
      </button>

      {choicesLoading ? <div className="loading-lines category-choice-loading">{Array.from({length:5}).map((_,i)=><i key={i}/>)}</div> :
        <div className={`category-choice-list ${randomCategoryEnabled ? "random-mode" : ""}`}>
          {shownCategories.map((category) => <div className="category-choice-card" key={category.id}>
            <div className="category-choice-name"><span className="category-icon">{category.icon || "•"}</span><strong>{category.name}</strong></div>
            <div className="category-points">{([2,4,6] as const).map((points) => pointButton(category, points))}</div>
          </div>)}
          {!shownCategories.length && <div className="empty-choice"><strong>موضوعی باقی نمونده</strong><span>ریسک ۳۰ هنوز می‌تونه گزینه آخر باشه.</span></div>}
        </div>}
      {randomCategoryEnabled && shownCategories.length > 0 && <p className="random-choice-note">موضوع عادی این نوبت تصادفی انتخاب شده؛ امتیازش با خودته.</p>}
      {!anyNormalChoice && !thirtyAvailable && <div className="turn-footer"><p className="hint-copy">کلمه‌های قابل انتخاب تموم شدن؛ این نوبت بدون امتیاز می‌گذره.</p><Button onClick={() => { if (!game) return; setLastRoundSummary({ ...emptyStats }); setLastTeamName(team.name); setGame(advanceGameLocally(game)); setScreen("ROUND_RESULT"); }}>ادامه بدون امتیاز</Button></div>}
    </div>;
  };

  const renderReveal = () => currentWord && team ? <div className="screen" key="REVEAL">
    {header("کلمه")}
    <div className="turn-center reveal-center">
      {wordVisible ? <div className={`card word-reveal-card ${selectedPoints === 30 ? "special-word-card" : ""}`}>
        <div className="word-label">{selectedPoints === 30 ? "ریسک ۳۰" : "کلمه تو"}</div>
        <div className="word-title">{currentWord.title}</div>
        <div className="word-meta"><span>{currentWord.categoryName}</span><span>•</span><b>{selectedPoints} امتیاز</b></div>
      </div> : <div className="card word-reveal-card hidden-word-card"><span className="hidden-word-mark" aria-hidden="true">✦</span><h1 className="title-lg">فقط بازیگر ببینه</h1><p className="copy hint-copy">گوشی دست {team.name} باشه؛ بعد کلمه رو نمایش بده.</p></div>}
      <Mascot mood="look-up" />
      <p className="copy hint-copy">{pausedRemainingMs !== null ? `${Math.ceil(pausedRemainingMs / 1000)} ثانیه از این نوبت باقی مونده.` : "زمان فقط وقتی خودت بزنی شروع می‌شه."}</p>
      {wordVisible && pausedRemainingMs === null && <button className={`change-word-btn ${changeUsed ? "used" : ""}`} onClick={() => void changeWord()} disabled={busy || changeUsed}>
        <span>{changeUsed ? "تعویض استفاده شد" : "تعویض کلمه"}</span><b>{changeUsed ? "✓" : "−۱ امتیاز"}</b>
      </button>}
    </div>
    <div className="turn-footer"><Button onClick={wordVisible ? startTimer : () => setWordVisible(true)} disabled={busy}>{busy ? "یک لحظه…" : !wordVisible ? "نمایش کلمه" : pausedRemainingMs !== null ? "ادامه زمان" : "شروع زمان"}</Button></div>
  </div> : null;

  const renderPlaying = () => game && team ? <div className={`screen playing-screen ${playFeedback ? `play-feedback-${playFeedback}` : ""}`} key="PLAYING">
    <div className="play-feedback-layer" aria-hidden="true" />
    <div className="play-home-row"><button className="icon-btn" onClick={goHome} disabled={Boolean(playFeedback)} aria-label="خانه و ذخیره بازی">{icon("home")}</button><span className="faint">خروج به خانه، با حفظ نوبت</span></div>
    <div className="playing-head"><div className="round-pill">دور <b className="number">{game.currentRound}/{game.roundCount}</b></div><button className="score-pill score-pill-button" onClick={() => setModal("score")} aria-label="دیدن امتیازهای فعلی"><TeamAvatar avatarId={team.avatarId ?? TEAM_AVATARS[team.position % 8][0]} colorKey={team.colorKey} size={28} />{team.name} <b className="number">{team.score}</b>{icon("score")}</button></div>
    <div className="playing-main">
      <TimerRing remaining={remaining} total={game.roundDuration} />
      {currentWord ? <><div className="word-title">{currentWord.title}</div><div className="playing-category">{currentWord.categoryName} · {selectedPoints} امتیاز{game.playMode === "SINGLE" && selectedPoints !== 30 ? " + سرعت" : ""}</div><Mascot mood={remaining <= 10 ? "tense" : "look-up"} size="sm" /></> : <><Mascot mood="thinking" /><p className="copy hint-copy">کلمه بعدی داره آماده می‌شه…</p></>}
      {playFeedback === "success" && <div className="play-feedback-copy success">گرفتین!</div>}
      {playFeedback === "failure" && <div className="play-feedback-copy failure">وقت تموم شد</div>}
    </div>
    <div className="screen-footer"><div className="fault-row"><button className="fault-btn" disabled={Boolean(playFeedback) || roundEndingRef.current} onClick={registerFault}>خطا <b>−۱</b></button><small>{roundStats.faultCount ? `${roundStats.faultCount} خطا` : "هر بار خطا: ۱−"}</small></div>
    <div className="play-actions">
      {game.playMode === "CONTINUOUS" && selectedPoints !== 30 && <button className="btn answer-skip" disabled={!currentWord || Boolean(playFeedback) || roundEndingRef.current} onClick={() => registerAnswer("SKIPPED")}>رد کردن</button>}
      <button className="btn answer-correct" disabled={!currentWord || Boolean(playFeedback) || roundEndingRef.current} onClick={() => registerAnswer("CORRECT")}>درست گفتن</button>
    </div>
    </div>
  </div> : null;

  const renderRoundResult = () => lastRoundSummary && game ? <div className="screen" key="ROUND_RESULT">
    {header("نتیجه نوبت")}
    <div className="turn-center">
      <Mascot mood={lastRoundSummary.forfeited ? "sad" : lastRoundSummary.correctCount > 0 ? "celebrate" : "sad"} />
      <div className="eyebrow">{lastTeamName || "این تیم"}</div>
      <h1 className="title-lg">{lastRoundSummary.forfeited ? "ریسک ۳۰ نگرفت!" : lastRoundSummary.correctCount > 0 ? "گرفتینش!" : "این یکی نشد"}</h1>
      {lastRoundSummary.forfeited ? <div className="forfeit-badge">این تیم از بازی خارج شد</div> : <div className="result-score">{lastRoundSummary.score >= 0 ? "+" : ""}{lastRoundSummary.score}</div>}
      <div className="result-stats">
        {lastRoundSummary.correctCount > 0 && lastRoundSummary.basePoints ? <div className="result-stat"><strong className="number">{lastRoundSummary.basePoints}</strong><span>پایه</span></div> : null}
        {lastRoundSummary.correctCount > 0 && lastRoundSummary.speedBonus ? <div className="result-stat"><strong className="number">+{lastRoundSummary.speedBonus}</strong><span>سرعت</span></div> : null}
        {(lastRoundSummary.changePenalty ?? 0) > 0 ? <div className="result-stat"><strong className="number">−1</strong><span>تعویض</span></div> : null}
        {(lastRoundSummary.faultCount ?? 0) > 0 ? <div className="result-stat"><strong className="number">−{lastRoundSummary.faultCount}</strong><span>خطا</span></div> : null}
      </div>
    </div>
    <div className="turn-footer"><Button onClick={continueAfterResult}>دیدن امتیازها</Button></div>
  </div> : null;

  const renderScoreboard = () => game ? <div className="screen" key="SCOREBOARD">
    {header("جدول امتیازها")}
    <div className="scoreboard-head"><div><div className="eyebrow">وضعیت بازی</div><h1 className="title-lg">فعلاً کی جلوئه؟</h1><p className="copy hint-copy">رتبه‌ها بعد از هر نوبت به‌روز می‌شن.</p></div><div className="scoreboard-round"><span>دور</span><strong className="number">{game.currentRound}/{game.roundCount}</strong></div></div>
    <div className="scoreboard-summary"><span><b className="number">{leaderboard.filter(item => !item.forfeited).length}</b> تیم فعال</span><span>بیشترین امتیاز: <b className="number">{leaderboard[0]?.score ?? 0}</b></span></div>
    <div className="scoreboard">{leaderboard.map((item, index) => <div className={`score-row ${index === 0 && !item.forfeited ? "leader" : ""} ${item.forfeited ? "forfeited" : ""}`} key={item.id}><span className={`rank rank-${Math.min(index + 1, 3)}`}>{index + 1}</span><div className="score-team"><strong><TeamAvatar avatarId={item.avatarId ?? TEAM_AVATARS[item.position % 8][0]} colorKey={item.colorKey} size={32} />{item.name}</strong><small>{item.forfeited ? "از بازی خارج شده" : index === 0 ? "فعلاً صدرنشین" : `تیم شماره ${item.position + 1}`}</small></div><span className="score-value"><b className="number">{item.score}</b><small>امتیاز</small></span></div>)}</div>
    <div className="turn-footer"><Button onClick={continueAfterScoreboard}>{game.status === "FINISHED" ? "اعلام برنده" : game.currentTeamId ? `نوبت ${currentTeam(game)?.name ?? "تیم بعد"}` : "ادامه"}</Button></div>
  </div> : null;

  const renderWinner = () => {
    const winner = leaderboard.find((item) => !item.forfeited) ?? leaderboard[0];
    if (!winner) return null;
    return <div className="screen" key="WINNER">
      {header("برنده بازی")}
      <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }).map((_, index) => <i key={index} style={{ left: `${5 + (index * 89) % 92}%`, animationDelay: `${(index % 6) * .08}s`, "--x": `${(index % 2 ? 1 : -1) * (20 + index * 3)}px` } as CSSProperties} />)}</div>
      <div className="turn-center"><TeamAvatar avatarId={winner.avatarId ?? TEAM_AVATARS[winner.position % 8][0]} colorKey={winner.colorKey} size={132} /><div className="winner-trophy">🏆</div><div className="eyebrow">برنده بازی</div><h1 className="title-xl">{winner.name}</h1><p className="copy">با <strong className="number">{winner.score}</strong> امتیاز بازی رو برد!</p><div className="scoreboard" style={{ width: "100%" }}>{leaderboard.filter((item) => !item.forfeited).slice(0,3).map((item,index)=><div className={`score-row ${index===0?"leader":""}`} key={item.id}><span className="rank">{index+1}</span><div className="score-team"><strong><TeamAvatar avatarId={item.avatarId ?? TEAM_AVATARS[item.position % 8][0]} colorKey={item.colorKey} size={32} />{item.name}</strong></div><span className="score-value">{item.score}</span></div>)}</div></div>
      <div className="home-actions screen-footer"><Button onClick={() => { void createGame(); }} disabled={busy}>{busy ? "داریم می‌چینیم…" : "دوباره با همین تیم‌ها"}</Button><Button tone="secondary" onClick={resetForNewGame}>بازی جدید</Button><Button tone="ghost" onClick={goHome}>برگشت به خانه</Button></div>
    </div>;
  };

  return <AppShell>
    {screen === "HOME" && renderHome()}
    {screen === "LIBRARY" && renderPersonalLibrary?.(() => { setScreen("HOME"); void loadCategories(runtimeMode); })}
    {screen === "SETUP" && renderSetup()}
    {screen === "READY" && renderReady()}
    {screen === "CATEGORY" && renderCategory()}
    {screen === "REVEAL" && renderReveal()}
    {screen === "PLAYING" && renderPlaying()}
    {screen === "ROUND_RESULT" && renderRoundResult()}
    {screen === "SCOREBOARD" && renderScoreboard()}
    {screen === "WINNER" && renderWinner()}

    {modal === "rules" && <Modal title="قانون بازی خیلی ساده‌ست" onClose={() => setModal(null)}><div className="rules-list"><div className="rule"><b>۱</b><span>حالت عادی هر نوبت فقط یک کلمه داره.</span></div><div className="rule"><b>۲</b><span>موضوع و امتیاز رو قبل هر نوبت انتخاب می‌کنید؛ جواب سریع‌تر تا ۳ امتیاز جایزه داره.</span></div><div className="rule"><b>۳</b><span>هر نوبت یک تعویض با جریمه ۱ امتیاز دارید و هر خطا هم ۱ امتیاز کم می‌کنه.</span></div><div className="rule"><b>۴</b><span>ریسک ۳۰ برای هر تیم فقط یک‌باره؛ اگه نگیره، از بازی خارج می‌شه.</span></div></div></Modal>}

    {modal === "settings" && <Modal title="تنظیمات" onClose={() => setModal(null)}>
      {renderPersonalLibrary && screen === "HOME" && <Button tone="secondary" onClick={() => { setModal(null); setScreen("LIBRARY"); }}>کلمات و موضوع‌های من</Button>}
      <div className="settings-section-label">حالت اجرا</div>
      <div className="runtime-mode-options">
        <button className={`runtime-mode-card ${runtimeMode === "online" ? "selected" : ""}`} onClick={() => setRuntimeMode("online")}>
          <span><strong>Online</strong><small>دیتابیس + Sync پس‌زمینه</small></span><i className={`connection-dot ${online ? "online" : "offline"}`} />
        </button>
        <button className={`runtime-mode-card ${runtimeMode === "local" ? "selected" : ""}`} onClick={() => setRuntimeMode("local")}>
          <span><strong>Local</strong><small>کاملاً روی همین گوشی · بدون اینترنت</small></span><b>⚡</b>
        </button>
      </div>
      <p className="runtime-mode-note">{game ? "تغییر حالت برای بازی بعدی اعمال می‌شه." : runtimeMode === "local" ? "هیچ رویداد بازی به سرور ارسال نمی‌شه." : "روند بازی محلی و فوریه؛ Sync دیتابیس پشت‌صحنه انجام می‌شه."}</p>
      <div className="settings-section-label">ظاهر</div>
      <div className="theme-options">{(["light","dark","system"] as ThemePreference[]).map((value) => <button key={value} className={`theme-option ${theme === value ? "selected" : ""}`} onClick={() => setTheme(value)}>{value === "light" ? "روشن" : value === "dark" ? "تیره" : "سیستم"}</button>)}</div>
      <div className="setting-row"><span>{icon("sound")} صداهای بازی</span><button role="switch" aria-checked={soundEnabled} className={`switch ${soundEnabled ? "on" : ""}`} onClick={() => setSoundEnabled((enabled) => !enabled)} aria-label="تغییر وضعیت صدا"><i /></button></div>
      <div className="settings-section-label">موسیقی زمان اجرا</div>
      <div className="music-options">{(["neon", "playful", "off"] as MusicTrack[]).map(value => <button key={value} aria-pressed={musicTrack === value} className={`music-option ${musicTrack === value ? "selected" : ""}`} onClick={() => setMusicTrack(value)}><strong>{value === "neon" ? "نئون بونس" : value === "playful" ? "تعقیب بامزه" : "بدون موسیقی"}</strong><small>{value === "neon" ? "الکترو فانک · پرانرژی" : value === "playful" ? "ماریمبا · بازیگوش" : "فقط افکت‌های بازی"}</small></button>)}</div>
      <label className="audio-level">بلندی افکت‌ها <b>{Math.round(effectsVolume * 100)}٪</b><input type="range" min="0" max="100" value={Math.round(effectsVolume * 100)} aria-label="بلندی افکت‌ها" onChange={event => setEffectsVolume(Number(event.target.value) / 100)} /></label>
      <label className="audio-level">بلندی موسیقی <b>{Math.round(musicVolume * 100)}٪</b><input type="range" min="0" max="100" value={Math.round(musicVolume * 100)} aria-label="بلندی موسیقی" onChange={event => setMusicVolume(Number(event.target.value) / 100)} /></label>
      <button className="text-btn" disabled={!soundEnabled} onClick={() => playTone("start")}>آزمایش صدای شروع</button>
      <p className="team-style-hint">موسیقی فقط هنگام اجرا پخش می‌شه؛ در ۱۰ ثانیه آخر کم می‌شه تا تیک‌تاک واضح باشه.</p>
      <div className="setting-row"><span className="setting-copy"><strong>موضوع تصادفی هر نوبت</strong><small>به‌جای انتخاب موضوع، بازی خودش یکی رو نشون می‌ده.</small></span><button role="switch" aria-checked={randomCategoryEnabled} className={`switch ${randomCategoryEnabled ? "on" : ""}`} onClick={() => setRandomCategoryEnabled((enabled) => !enabled)} aria-label="موضوع تصادفی"><i /></button></div>
      <div className="setting-row"><span className="setting-copy"><strong>حالت چندکلمه‌ای</strong><small>{game ? "برای بازی بعدی؛ " : ""}تا پایان زمان چند کلمه پشت‌سرهم بازی کن.</small></span><button role="switch" aria-checked={continuousModeEnabled} className={`switch ${continuousModeEnabled ? "on" : ""}`} onClick={() => setContinuousModeEnabled((enabled) => !enabled)} aria-label="حالت چندکلمه‌ای"><i /></button></div>
      <div className="settings-category-head"><div><div className="settings-section-label">دسته‌های بازی</div><small>{game ? "برای بازی بعدی" : "برای بازی جدید"}</small></div><button className="text-btn" onClick={() => setConfig((current) => ({ ...current, categoryIds: categories.map((item) => item.id) }))} disabled={!categories.length || config.categoryIds.length === categories.length}>{config.categoryIds.length === categories.length && categories.length ? "همه انتخابن" : "انتخاب همه"}</button></div>
      {categoriesLoading ? <div className="loading-lines compact-loading">{Array.from({length:4}).map((_,i)=><i key={i}/>)}</div> : <div className="category-grid settings-category-grid">{categories.map((category) => {
        const selected = config.categoryIds.includes(category.id);
        return <button key={category.id} className={`category-chip ${selected ? "selected" : ""}`} onClick={() => {
          if (selected && config.categoryIds.length === 1) return showToast("حداقل یه دسته باید روشن بمونه.");
          setConfig((current) => ({ ...current, categoryIds: selected ? current.categoryIds.filter((id) => id !== category.id) : [...current.categoryIds, category.id] }));
        }}><span className="category-icon">{category.icon || "•"}</span><strong>{category.name}</strong></button>;
      })}</div>}
      {!categoriesLoading && !config.categoryIds.length && <p className="settings-warning">حداقل یک دسته برای بازی جدید انتخاب کن.</p>}
    </Modal>}

    {modal === "score" && game && <Modal title="امتیازها الان" onClose={() => setModal(null)}><div className="scoreboard score-peek-board">{leaderboard.map((item, index) => <div className={`score-row ${index === 0 && !item.forfeited ? "leader" : ""} ${item.forfeited ? "forfeited" : ""}`} key={item.id}><span className="rank">{index + 1}</span><div className="score-team"><strong><TeamAvatar avatarId={item.avatarId ?? TEAM_AVATARS[item.position % 8][0]} colorKey={item.colorKey} size={32} />{item.name}</strong><small>{item.forfeited ? "از بازی خارج شده" : item.id === game.currentTeamId ? "نوبت فعلی" : index === 0 ? "فعلاً جلوئه" : ""}</small></div><span className="score-value">{item.score}</span></div>)}</div></Modal>}

    {modal === "team-style" && editingTeam !== null && <Modal title={`ظاهر ${config.teamNames[editingTeam]}`} onClose={() => setModal(null)}>
      <div className="team-style-preview"><TeamAvatar {...teamStyle(config, editingTeam)} size={112} /><strong>{config.teamNames[editingTeam]}</strong></div>
      <div className="settings-section-label">آواتار اختصاصی</div>
      <div className="avatar-options">{TEAM_AVATARS.map(([id, name]) => <button key={id} aria-label={name} aria-pressed={teamStyle(config, editingTeam).avatarId === id} className={teamStyle(config, editingTeam).avatarId === id ? "selected" : ""} onClick={() => setConfig(current => ({ ...current, teamStyles: current.teamNames.map((_, index) => ({ ...teamStyle(current, index), ...(index === editingTeam ? { avatarId: id } : {}) })) }))}><TeamAvatar avatarId={id} colorKey={teamStyle(config, editingTeam).colorKey} size={58} /><span>{name}</span></button>)}</div>
      <div className="settings-section-label">رنگ تیم</div>
      <div className="team-color-options">{TEAM_COLORS.map((color, colorIndex) => <button key={color} aria-label={COLOR_NAMES[colorIndex]} aria-pressed={teamStyle(config, editingTeam).colorKey === color} style={{ background: COLOR_VALUES[color] }} onClick={() => setConfig(current => ({ ...current, teamStyles: current.teamNames.map((_, index) => ({ ...teamStyle(current, index), ...(index === editingTeam ? { colorKey: color } : {}) })) }))}>{teamStyle(config, editingTeam).colorKey === color ? "✓" : ""}</button>)}</div>
    </Modal>}
    {modal === "new-game" && <Modal title="بازی جدید شروع کنیم؟" onClose={() => setModal(null)}><p>بازی ذخیره‌شده با بازی جدید جایگزین می‌شه.</p><Button onClick={resetForNewGame}>بله، بازی جدید</Button></Modal>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </AppShell>;
}
