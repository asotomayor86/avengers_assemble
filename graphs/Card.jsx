import { CARD_DEFS, buildDeck } from "./deck";
import {
  Bot, Zap, Dumbbell, Star, Sparkles, Gem,
  Hand, Hammer, Grab, Shield,
  Cpu, Crown, Biohazard, VenetianMask, Infinity,
  Target, Crosshair, Feather, PawPrint,
  Wand2, EyeOff,
} from "lucide-react";

export { CARD_DEFS, buildDeck };

// --- Icono de avispa a medida (lucide no trae uno; acepta size/color/strokeWidth como lucide) ---
function Wasp({ size = 24, color = "currentColor", strokeWidth = 1.8, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.7 3.1 Q9.4 1.3 8.2 1.5 M13.3 3.1 Q14.6 1.3 15.8 1.5" />
      <circle cx="12" cy="4.6" r="2" />
      <ellipse cx="12" cy="8.6" rx="2.4" ry="2.1" />
      <ellipse cx="12" cy="15.6" rx="3.2" ry="5.6" />
      <path d="M9.2 13.4 H14.8 M8.9 15.7 H15.1 M9.6 18 H14.4" />
      <path d="M12 21.2 V22.7" />
      <path d="M10 8 C5.6 5.6 3.6 8.6 5.6 10.6 C6.8 11.7 9 10.8 10 9.4" />
      <path d="M14 8 C18.4 5.6 20.4 8.6 18.4 10.6 C17.2 11.7 15 10.8 14 9.4" />
    </svg>
  );
}

// --- Icono por carta (editable: cambia cualquier valor por otro de lucide-react) ---
export const ICON_MAP = {
  "Iron Man": Bot, "Thor": Zap, "Hulk": Dumbbell,
  "Capitán América": Star, "Capitana Marvel": Sparkles, "Visión": Gem,
  "Guante de Iron Man": Hand, "Mjölnir": Hammer, "Puño de Hulk": Grab,
  "Escudo del Capitán América": Shield,
  "Ultron": Cpu, "Loki": Crown, "Abominación": Biohazard,
  "Barón Zemo": VenetianMask, "Thanos": Infinity,
  "Hawkeye": Target, "Bucky Barnes": Crosshair, "Falcon": Feather,
  "Black Panther": PawPrint, "Avispa": Wasp,
  "Nick Furia": EyeOff, "Doctor Strange": Wand2, "Viuda Negra": Star,
  "Wanda": Crown, "Guantelete de Thanos": Gem,
};

// --- Paleta por color de facción ---
const COLOR = {
  red:    { tint: "#FCEBEB", ink: "#A32D2D", deep: "#501313", label: "Rojo" },
  yellow: { tint: "#FAEEDA", ink: "#854F0B", deep: "#412402", label: "Amarillo" },
  green:  { tint: "#EAF3DE", ink: "#3B6D11", deep: "#173404", label: "Verde" },
  blue:   { tint: "#E6F1FB", ink: "#0C447C", deep: "#042C53", label: "Azul" },
  gray:   { tint: "#F1EFE8", ink: "#444441", deep: "#2C2C2A", label: "Gris" },
  purple: { tint: "#EEEDFE", ink: "#3C3489", deep: "#26215C", label: "Morado" },
  multicolor: { tint: "#F1EFE8", ink: "#26215C", deep: "#26215C", label: "Multicolor" },
};
const QUAD = ["#F7C1C1", "#FAC775", "#C0DD97", "#B5D4F4"]; // rojo, amarillo, verde, azul

const TYPE_LABEL = { hero: "Héroe", power: "Poder", villain: "Villano", ally: "Aliado", action: "Acción" };
const EFFECT_LABEL = { recruit: "Reclutar", counter: "Contrarrestar", spy: "Espiar", swap: "Alterar la realidad", snap: "Chasquido" };

// --- Componente Card ---
// card = { type, name, color?, colors?, effect?, imageUrl?, iconColor?, iconCount?, iconColors? }
export function Card({ card, count, size = 130, onClick, selected = false }) {
  const Icon = ICON_MAP[card.name] || Sparkles;
  const pal = COLOR[card.color] || COLOR.gray;
  const isMulti = card.color === "multicolor";
  const isAlly = card.type === "ally" && Array.isArray(card.colors);
  const w = size, art = Math.round(size * 0.68);

  // Subtítulo del pie
  let sub = pal.label;
  if (isAlly) sub = card.colors.map((c) => COLOR[c]?.label ?? c).join(" + ");
  else if (card.type === "action") sub = EFFECT_LABEL[card.effect] || "Acción";
  if (count != null) sub += ` · ×${count}`;

  // Zona del icono (admite 1 icono o varios pequeños, con color propio)
  const renderIcons = () => {
    const n = card.iconCount && card.iconCount > 1 ? card.iconCount : 1;
    const col = card.iconColor || pal.ink;
    const cols = card.iconColors || null;
    if (n === 1) {
      return <Icon size={Math.round(art * 0.42)} color={col} strokeWidth={1.8} aria-hidden />;
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: art * 0.82, justifyContent: "center" }}>
        {Array.from({ length: n }).map((_, i) => (
          <Icon key={i} size={Math.round(art * 0.24)} color={cols ? cols[i % cols.length] : col} strokeWidth={2} aria-hidden />
        ))}
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        width: w, background: "#fff", borderRadius: 14, overflow: "hidden",
        border: selected ? "2px solid #185FA5" : "0.5px solid rgba(0,0,0,0.14)",
        boxShadow: selected ? "0 0 0 3px rgba(24,95,165,0.15)" : "0 1px 2px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        cursor: onClick ? "pointer" : "default", userSelect: "none",
        transition: "transform .12s ease, box-shadow .12s ease",
      }}
    >
      <div style={{ padding: "9px 10px 0" }}>
        <span style={{
          background: pal.tint, color: pal.ink, fontSize: 11, fontWeight: 500,
          padding: "3px 9px", borderRadius: 999, display: "inline-block",
        }}>{TYPE_LABEL[card.type]}</span>
      </div>

      <div style={{ position: "relative", margin: "9px 10px", height: art, borderRadius: 10, overflow: "hidden" }}>
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name}
               style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <>
            {isMulti && (
              <div style={{ position: "absolute", inset: 0, display: "grid",
                            gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
                {QUAD.map((c, i) => <div key={i} style={{ background: c }} />)}
              </div>
            )}
            {isAlly && (
              <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ background: COLOR[card.colors[0]]?.tint ?? "#eee" }} />
                <div style={{ background: COLOR[card.colors[1]]?.tint ?? "#eee" }} />
              </div>
            )}
            {!isMulti && !isAlly && (
              <div style={{ position: "absolute", inset: 0, background: pal.tint }} />
            )}
            <div style={{ position: "absolute", inset: 0, display: "flex",
                          alignItems: "center", justifyContent: "center" }}>
              {renderIcons()}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: "0 10px", fontWeight: 500, fontSize: 14, color: pal.deep, lineHeight: 1.2 }}>
        {card.name}
      </div>
      <div style={{ padding: "3px 10px 11px", fontSize: 12, color: "#5F5E5A" }}>{sub}</div>
    </div>
  );
}

// --- Galería de prueba (export por defecto) ---
export default function CardGallery() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 16, background: "#f6f5f1" }}>
      {CARD_DEFS.map((c) => <Card key={c.name} card={{ ...c, imageUrl: null }} count={c.copies} />)}
    </div>
  );
}
