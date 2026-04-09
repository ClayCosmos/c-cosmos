import { cn } from "@/lib/utils";

type PetAvatarProps = {
  species: string;
  colorPrimary?: string;
  colorSecondary?: string;
  mood?: number;
  size?: "sm" | "md" | "lg" | "xl";
  evolutionStage?: string;
  className?: string;
};

const SIZES = {
  sm: { container: "w-8 h-8", svg: 32 },
  md: { container: "w-12 h-12", svg: 48 },
  lg: { container: "w-16 h-16", svg: 64 },
  xl: { container: "w-20 h-20", svg: 80 },
};

function getMouthPath(mood: number): string {
  if (mood > 70) return "M 16 24 Q 20 28 24 24"; // smile
  if (mood > 40) return "M 16 25 L 24 25"; // neutral
  return "M 16 27 Q 20 23 24 27"; // sad
}

function getEyeStyle(mood: number) {
  if (mood > 70) return { ry: 1.5, ey: 16 }; // happy squint
  return { ry: 2.5, ey: 15 }; // normal
}

function LobsterSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  const eye = getEyeStyle(mood);
  return (
    <g>
      {/* Claws */}
      <ellipse cx={8} cy={22} rx={5} ry={4} fill={secondary} className="animate-[claw-snap_3s_ease-in-out_infinite]" style={{ transformOrigin: "8px 26px" }} />
      <ellipse cx={32} cy={22} rx={5} ry={4} fill={secondary} className="animate-[claw-snap_3s_ease-in-out_infinite_0.5s]" style={{ transformOrigin: "32px 26px" }} />
      {/* Body */}
      <ellipse cx={20} cy={22} rx={10} ry={12} fill={primary} />
      {/* Head */}
      <circle cx={20} cy={12} r={8} fill={primary} />
      {/* Eyes */}
      <ellipse cx={16} cy={eye.ey} rx={2} ry={eye.ry} fill="white" />
      <ellipse cx={24} cy={eye.ey} rx={2} ry={eye.ry} fill="white" />
      <circle cx={16} cy={eye.ey} r={1} fill="#333" />
      <circle cx={24} cy={eye.ey} r={1} fill="#333" />
      {/* Mouth */}
      <path d={getMouthPath(mood)} fill="none" stroke="#333" strokeWidth={1} strokeLinecap="round" />
      {/* Antennae */}
      <line x1={14} y1={5} x2={10} y2={1} stroke={secondary} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={26} y1={5} x2={30} y2={1} stroke={secondary} strokeWidth={1.5} strokeLinecap="round" />
      {/* Tail segments */}
      <ellipse cx={20} cy={32} rx={6} ry={3} fill={secondary} />
      <ellipse cx={20} cy={36} rx={4} ry={2} fill={secondary} />
    </g>
  );
}

function OctopusSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  const eye = getEyeStyle(mood);
  return (
    <g>
      {/* Head */}
      <ellipse cx={20} cy={14} rx={12} ry={10} fill={primary} />
      {/* Tentacles */}
      {[6, 12, 18, 24, 30, 34].map((x, i) => (
        <path key={i} d={`M ${x} 22 Q ${x + (i % 2 === 0 ? 3 : -3)} 30 ${x} 38`} fill="none" stroke={secondary} strokeWidth={2.5} strokeLinecap="round" />
      ))}
      {/* Eyes */}
      <ellipse cx={15} cy={eye.ey} rx={2.5} ry={eye.ry} fill="white" />
      <ellipse cx={25} cy={eye.ey} rx={2.5} ry={eye.ry} fill="white" />
      <circle cx={15} cy={eye.ey} r={1.2} fill="#333" />
      <circle cx={25} cy={eye.ey} r={1.2} fill="#333" />
      {/* Mouth */}
      <path d={getMouthPath(mood)} fill="none" stroke="#333" strokeWidth={1} strokeLinecap="round" />
      {/* Spots */}
      <circle cx={12} cy={10} r={1.5} fill={secondary} opacity={0.5} />
      <circle cx={27} cy={8} r={1.5} fill={secondary} opacity={0.5} />
    </g>
  );
}

function CatSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  const eye = getEyeStyle(mood);
  return (
    <g>
      {/* Body */}
      <ellipse cx={20} cy={28} rx={10} ry={8} fill={primary} />
      {/* Head */}
      <circle cx={20} cy={16} r={9} fill={primary} />
      {/* Ears */}
      <polygon points="11,10 8,2 15,8" fill={primary} />
      <polygon points="29,10 32,2 25,8" fill={primary} />
      <polygon points="12,9 10,4 15,8" fill={secondary} />
      <polygon points="28,9 30,4 25,8" fill={secondary} />
      {/* Eyes */}
      <ellipse cx={16} cy={eye.ey} rx={2} ry={eye.ry} fill="#8BC34A" />
      <ellipse cx={24} cy={eye.ey} rx={2} ry={eye.ry} fill="#8BC34A" />
      <ellipse cx={16} cy={eye.ey} rx={0.8} ry={eye.ry} fill="#333" />
      <ellipse cx={24} cy={eye.ey} rx={0.8} ry={eye.ry} fill="#333" />
      {/* Nose */}
      <polygon points="20,19 18.5,20.5 21.5,20.5" fill={secondary} />
      {/* Whiskers */}
      <line x1={7} y1={19} x2={16} y2={20} stroke="#999" strokeWidth={0.5} />
      <line x1={7} y1={21} x2={16} y2={21} stroke="#999" strokeWidth={0.5} />
      <line x1={33} y1={19} x2={24} y2={20} stroke="#999" strokeWidth={0.5} />
      <line x1={33} y1={21} x2={24} y2={21} stroke="#999" strokeWidth={0.5} />
      {/* Tail */}
      <path d="M 30 28 Q 36 22 34 16" fill="none" stroke={primary} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

function GooseSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  const eye = getEyeStyle(mood);
  return (
    <g>
      {/* Body */}
      <ellipse cx={22} cy={28} rx={12} ry={9} fill={primary} />
      {/* Neck */}
      <path d="M 16 22 Q 12 12 14 6" fill="none" stroke={primary} strokeWidth={5} strokeLinecap="round" />
      {/* Head */}
      <circle cx={14} cy={6} r={5} fill={primary} />
      {/* Beak */}
      <polygon points="9,6 5,5 9,8" fill="#FF9800" />
      {/* Eye */}
      <ellipse cx={13} cy={eye.ey - 10} rx={1.5} ry={Math.min(eye.ry, 2)} fill="white" />
      <circle cx={13} cy={eye.ey - 10} r={0.8} fill="#333" />
      {/* Wing */}
      <ellipse cx={25} cy={25} rx={8} ry={5} fill={secondary} />
      {/* Feet */}
      <path d="M 18 36 L 16 39 L 20 39" fill="#FF9800" />
      <path d="M 26 36 L 24 39 L 28 39" fill="#FF9800" />
    </g>
  );
}

function CapybaraSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  const eye = getEyeStyle(mood);
  return (
    <g>
      {/* Body */}
      <ellipse cx={20} cy={28} rx={13} ry={9} fill={primary} />
      {/* Head */}
      <ellipse cx={20} cy={14} rx={10} ry={9} fill={primary} />
      {/* Ears */}
      <ellipse cx={12} cy={7} rx={3} ry={2} fill={secondary} />
      <ellipse cx={28} cy={7} rx={3} ry={2} fill={secondary} />
      {/* Eyes - always calm */}
      <ellipse cx={16} cy={eye.ey} rx={2} ry={Math.min(eye.ry, 2)} fill="white" />
      <ellipse cx={24} cy={eye.ey} rx={2} ry={Math.min(eye.ry, 2)} fill="white" />
      <circle cx={16} cy={eye.ey} r={1} fill="#333" />
      <circle cx={24} cy={eye.ey} r={1} fill="#333" />
      {/* Nose */}
      <ellipse cx={20} cy={19} rx={3} ry={2} fill={secondary} />
      {/* Mouth - always slightly smiling */}
      <path d="M 17 22 Q 20 24 23 22" fill="none" stroke="#333" strokeWidth={0.8} strokeLinecap="round" />
      {/* Feet */}
      <ellipse cx={13} cy={36} rx={3} ry={1.5} fill={secondary} />
      <ellipse cx={27} cy={36} rx={3} ry={1.5} fill={secondary} />
    </g>
  );
}

function MushroomSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  const eye = getEyeStyle(mood);
  return (
    <g>
      {/* Cap */}
      <ellipse cx={20} cy={14} rx={14} ry={10} fill={primary} />
      {/* Cap spots */}
      <circle cx={14} cy={10} r={2.5} fill="white" opacity={0.7} />
      <circle cx={24} cy={8} r={2} fill="white" opacity={0.7} />
      <circle cx={20} cy={14} r={1.5} fill="white" opacity={0.7} />
      {/* Stem */}
      <rect x={14} y={20} width={12} height={14} rx={4} fill={secondary} />
      {/* Face */}
      <ellipse cx={17} cy={eye.ey + 10} rx={1.5} ry={eye.ry * 0.8} fill="white" />
      <ellipse cx={23} cy={eye.ey + 10} rx={1.5} ry={eye.ry * 0.8} fill="white" />
      <circle cx={17} cy={eye.ey + 10} r={0.8} fill="#333" />
      <circle cx={23} cy={eye.ey + 10} r={0.8} fill="#333" />
      {/* Mouth */}
      <path d={mood > 70 ? "M 18 29 Q 20 31 22 29" : mood > 40 ? "M 18 30 L 22 30" : "M 18 31 Q 20 29 22 31"} fill="none" stroke="#333" strokeWidth={0.8} strokeLinecap="round" />
    </g>
  );
}

function RobotSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  return (
    <g>
      {/* Antenna */}
      <line x1={20} y1={4} x2={20} y2={8} stroke={secondary} strokeWidth={1.5} />
      <circle cx={20} cy={3} r={2} fill={mood > 60 ? "#4CAF50" : "#FF5722"} />
      {/* Head */}
      <rect x={10} y={8} width={20} height={14} rx={3} fill={primary} />
      {/* Eyes - LED style */}
      <rect x={14} y={12} width={4} height={3} rx={1} fill={mood > 40 ? "#00E5FF" : "#FF1744"} />
      <rect x={22} y={12} width={4} height={3} rx={1} fill={mood > 40 ? "#00E5FF" : "#FF1744"} />
      {/* Mouth - LED bar */}
      <rect x={15} y={18} width={10} height={2} rx={1} fill={secondary} />
      {/* Body */}
      <rect x={12} y={24} width={16} height={10} rx={2} fill={primary} />
      {/* Chest display */}
      <rect x={16} y={26} width={8} height={4} rx={1} fill={secondary} opacity={0.5} />
      {/* Arms */}
      <rect x={6} y={25} width={5} height={3} rx={1.5} fill={secondary} />
      <rect x={29} y={25} width={5} height={3} rx={1.5} fill={secondary} />
      {/* Legs */}
      <rect x={14} y={34} width={4} height={4} rx={1} fill={secondary} />
      <rect x={22} y={34} width={4} height={4} rx={1} fill={secondary} />
    </g>
  );
}

function BlobSvg({ primary, secondary, mood }: { primary: string; secondary: string; mood: number }) {
  const eye = getEyeStyle(mood);
  return (
    <g>
      {/* Blob body - organic shape */}
      <path
        d="M 10 24 Q 6 16 12 10 Q 18 4 26 8 Q 34 12 34 22 Q 34 32 26 36 Q 18 38 10 32 Z"
        fill={primary}
        className="animate-[blob-wobble_4s_ease-in-out_infinite]"
      />
      {/* Sheen */}
      <ellipse cx={16} cy={14} rx={4} ry={3} fill="white" opacity={0.2} />
      {/* Eyes */}
      <ellipse cx={16} cy={eye.ey + 3} rx={2} ry={eye.ry} fill="white" />
      <ellipse cx={24} cy={eye.ey + 3} rx={2} ry={eye.ry} fill="white" />
      <circle cx={16} cy={eye.ey + 3} r={1} fill="#333" />
      <circle cx={24} cy={eye.ey + 3} r={1} fill="#333" />
      {/* Mouth */}
      <path d={getMouthPath(mood).replace(/\d+/g, (m, i) => i > 40 ? m : String(Number(m) + 2))} fill="none" stroke="#333" strokeWidth={1} strokeLinecap="round" />
      {/* Blush */}
      {mood > 60 && (
        <>
          <ellipse cx={12} cy={22} rx={2.5} ry={1.5} fill={secondary} opacity={0.3} />
          <ellipse cx={28} cy={22} rx={2.5} ry={1.5} fill={secondary} opacity={0.3} />
        </>
      )}
    </g>
  );
}

const SPECIES_RENDERERS: Record<string, typeof LobsterSvg> = {
  lobster: LobsterSvg,
  octopus: OctopusSvg,
  cat: CatSvg,
  goose: GooseSvg,
  capybara: CapybaraSvg,
  mushroom: MushroomSvg,
  robot: RobotSvg,
  blob: BlobSvg,
};

function getEvolutionStyles(stage: string | undefined, colorPrimary: string): { className: string; style: React.CSSProperties } {
  switch (stage) {
    case "teen":
      return {
        className: "ring-2 ring-primary/20",
        style: {},
      };
    case "adult":
      return {
        className: "shadow-lg",
        style: { boxShadow: `0 4px 14px ${colorPrimary}30` },
      };
    case "elder":
      return {
        className: "",
        style: { boxShadow: "0 0 15px rgba(234,179,8,0.3)" },
      };
    default:
      return { className: "", style: {} };
  }
}

export function PetAvatar({
  species,
  colorPrimary = "#E74C3C",
  colorSecondary = "#C0392B",
  mood = 80,
  size = "md",
  evolutionStage,
  className,
}: PetAvatarProps) {
  const Renderer = SPECIES_RENDERERS[species];
  const s = SIZES[size];
  const evo = getEvolutionStyles(evolutionStage, colorPrimary);

  if (!Renderer) {
    return (
      <div className={cn(s.container, "rounded-full bg-muted flex items-center justify-center text-lg", evo.className, className)} style={evo.style}>
        🐾
      </div>
    );
  }

  return (
    <div className={cn(s.container, "relative rounded-full overflow-hidden flex items-center justify-center", evo.className, className)}
         style={{ backgroundColor: colorPrimary + "15", ...evo.style }}>
      <svg viewBox="0 0 40 40" width={s.svg} height={s.svg}>
        <Renderer primary={colorPrimary} secondary={colorSecondary} mood={mood} />
      </svg>
      {evolutionStage === "elder" && (
        <span className="absolute -top-0.5 -right-0.5 text-[10px] leading-none">&#9733;</span>
      )}
    </div>
  );
}
