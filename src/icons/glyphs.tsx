/**
 * 概念類別 → 通用單色字形（Heroicons solid，已是相依套件、會被 tree-shake）。
 * 用於沒有品牌 icon 時的分類圖示（例如各家網銀 → 銀行字形）。
 */
import type { ComponentType, SVGProps } from 'react';
import {
  BuildingLibraryIcon,
  EnvelopeIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  ShoppingBagIcon,
  PlayCircleIcon,
  BriefcaseIcon,
  CloudIcon,
  PuzzlePieceIcon,
  PaperAirplaneIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/solid';

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/** key 對應 semantic.ts 的概念 id。 */
export const CONCEPT_GLYPHS: Record<string, Glyph> = {
  banking: BuildingLibraryIcon,
  email: EnvelopeIcon,
  social: UsersIcon,
  messaging: ChatBubbleLeftRightIcon,
  shopping: ShoppingBagIcon,
  streaming: PlayCircleIcon,
  work: BriefcaseIcon,
  cloud: CloudIcon,
  gaming: PuzzlePieceIcon,
  travel: PaperAirplaneIcon,
  developer: CodeBracketIcon,
};
