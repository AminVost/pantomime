export type CategoryDTO = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  counts: { points2: number; points4: number; points6: number };
};

export type TeamDTO = {
  id: string;
  name: string;
  colorKey: string;
  avatarId?: string;
  score: number;
  position: number;
  forfeited: boolean;
};

export type WordDTO = {
  id: number;
  title: string;
  points: 2 | 4 | 6;
  categoryName: string;
};

export type PlayMode = "SINGLE" | "CONTINUOUS";

export type GameDTO = {
  id: string;
  roundCount: number;
  roundDuration: number;
  currentRound: number;
  currentTeamId: string | null;
  playMode: PlayMode;
  status: "SETUP" | "ACTIVE" | "FINISHED" | "ABANDONED";
  teams: TeamDTO[];
};

export type RoundSummary = {
  score: number;
  correctCount: number;
  skippedCount: number;
  faultCount?: number;
  speedBonus?: number;
  basePoints?: number;
  specialThirty?: boolean;
  forfeited?: boolean;
  changePenalty?: number;
};

export type GameChoiceDTO = {
  categoryId: number | null;
  points: 2 | 4 | 6 | 30;
  teamId: string;
  roundNumber: number;
};

export type RuntimeMode = "online" | "local";

export type CatalogWordDTO = {
  id: number;
  title: string;
  categoryId: number;
  points: 2 | 4 | 6;
  categoryName: string;
};

export type CatalogPackDTO = {
  version: number;
  categories: CategoryDTO[];
  words: CatalogWordDTO[];
};
