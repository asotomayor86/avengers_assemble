import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot, Zap, Dumbbell, Star, Sparkles, Gem,
  Hand as HandIcon, Hammer, Grab, Shield,
  Cpu, Crown, Biohazard, VenetianMask, Infinity as InfinityIcon,
  Target, Crosshair, Feather, PawPrint,
  Wand2, EyeOff,
} from 'lucide-react';

// Texto de ayuda para las cartas de acción (se muestra al pasar el cursor por la etiqueta).
const ACTION_INFO = {
  recruit: 'Reclutar (Nick Furia): roba un héroe de otra persona (libre, protegido o bloqueado; los blindados no) y añádelo a tu equipo. No puedes tener dos héroes del mismo color.',
  counter: 'Contrarrestar (Doctor Strange): se juega en el turno rival para evitar el efecto de una carta jugada contra ti. No se puede contrarrestar un Contrarrestar. Tras jugarlo, no robas.',
  spy: 'Espiar (Viuda Negra): mira la mano de otra persona y, si puedes, juega una de sus cartas. Esa persona no roba ese turno.',
  swap: 'Alterar la realidad (Wanda): intercambia todo tu equipo con el de otra persona, incluidos los héroes blindados.',
  snap: 'Chasquido (Guantelete de Thanos): cada persona elimina la mitad de sus héroes (redondeando abajo), a su elección. Aquí cualquier héroe puede ser destruido.',
};

// Componente de carta. Hoy dibuja un icono + color de facción (placeholder);
// si `card.imageUrl` existe, muestra la imagen sin tocar nada más.
// Diseño basado en la propuesta de graphs/Card.jsx, adaptado a la API del juego
// (size: 'sm'|'md'|'lg' o número en px; selectable; selected) y con modo compacto
// para las cartas pequeñas del tablero.

// Icono de Avispa a medida (lucide no trae uno).
function Wasp({ size = 24, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
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

const ICON_MAP = {
  'Iron Man': Bot, Thor: Zap, Hulk: Dumbbell,
  'Capitán América': Star, 'Capitana Marvel': Sparkles, 'Visión': Gem,
  'Guante de Iron Man': HandIcon, 'Mjölnir': Hammer, 'Puño de Hulk': Grab,
  'Escudo del Capitán América': Shield,
  Ultron: Cpu, Loki: Crown, 'Abominación': Biohazard,
  'Barón Zemo': VenetianMask, Thanos: InfinityIcon,
  Hawkeye: Target, 'Bucky Barnes': Crosshair, Falcon: Feather,
  'Black Panther': PawPrint, Avispa: Wasp, 'Ant-Man': Bot,
  'Nick Furia': EyeOff, 'Doctor Strange': Wand2, 'Viuda Negra': Star,
  Wanda: Crown, 'Guantelete de Thanos': Gem,
};

// Cosméticos de icono que viven en el cliente (no ensucian el deck del servidor).
const COSMETIC = {
  'Guantelete de Thanos': {
    iconCount: 5,
    iconColors: ['#7F77DD', '#378ADD', '#E24B4A', '#BA7517', '#639922'],
  },
};

const COLOR = {
  red: { tint: '#FCEBEB', ink: '#A32D2D', deep: '#501313', label: 'Rojo' },
  yellow: { tint: '#FAEEDA', ink: '#854F0B', deep: '#412402', label: 'Amarillo' },
  green: { tint: '#EAF3DE', ink: '#3B6D11', deep: '#173404', label: 'Verde' },
  blue: { tint: '#E6F1FB', ink: '#0C447C', deep: '#042C53', label: 'Azul' },
  gray: { tint: '#F1EFE8', ink: '#444441', deep: '#2C2C2A', label: 'Gris' },
  purple: { tint: '#EEEDFE', ink: '#3C3489', deep: '#26215C', label: 'Morado' },
  multicolor: { tint: '#F1EFE8', ink: '#26215C', deep: '#26215C', label: 'Multicolor' },
};
const QUAD = ['#F7C1C1', '#FAC775', '#C0DD97', '#B5D4F4'];

// Fondos fuertes por facción (para el arte), pensados para iconos en trazo BLANCO.
const STRONG = {
  red: '#d12d2d',
  yellow: '#c8901a',
  green: '#2e9e46',
  blue: '#2b6fb8',
  gray: '#e3995a', // Visión: naranja suave (su color de facción)
  purple: '#6c3aa6',
  multicolor: '#6b7280',
};
const QUAD_STRONG = ['#e24b4a', '#e0a52b', '#4fae4f', '#3f8fd6']; // rojo, amarillo, verde, azul

const TYPE_LABEL = { hero: 'Héroe', power: 'Poder', villain: 'Villano', ally: 'Aliado', action: 'Acción' };
const EFFECT_LABEL = { recruit: 'Reclutar', counter: 'Contrarrestar', spy: 'Espiar', swap: 'Alterar la realidad', snap: 'Chasquido' };

// Color propio por TIPO de carta (independiente de la facción) para reconocerlo de un vistazo.
const TYPE_BADGE = {
  hero: { label: 'Héroe', bg: '#1d6fb3' },
  power: { label: 'Poder', bg: '#2e8b57' },
  villain: { label: 'Villano', bg: '#7a1f1f' },
  ally: { label: 'Aliado', bg: '#b8860b' },
  action: { label: 'Acción', bg: '#5b3a9b' },
};

const SIZE_PX = { sm: 84, md: 108, lg: 136 };

export default function Card({ card, size = 'md', count, onClick, selectable, selected, fluid, state }) {
  const [tip, setTip] = useState(null);
  if (!card) return null;
  const w = typeof size === 'number' ? size : SIZE_PX[size] || 96;
  const compact = w < 100;
  const pal = COLOR[card.color] || COLOR.gray;
  const isMulti = card.color === 'multicolor';
  const isAlly = card.type === 'ally' && Array.isArray(card.colors);
  const Icon = ICON_MAP[card.name] || Sparkles;
  const cos = COSMETIC[card.name] || {};
  const art = Math.round(w * (compact ? 0.78 : 0.66));

  const ring = selected
    ? '2px solid #185FA5'
    : selectable
      ? '2px solid rgba(24,95,165,0.45)'
      : '0.5px solid rgba(0,0,0,0.14)';

  // Tooltip de la etiqueta "Acción": muestra cómo funciona la carta al pasar el cursor.
  const info = card.type === 'action' ? ACTION_INFO[card.effect] : null;
  const showTip = (e) => {
    if (!info) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: Math.min(r.left, window.innerWidth - 232), y: r.bottom + 6 });
  };
  const hideTip = () => setTip(null);
  const tipPortal =
    tip && info
      ? createPortal(
          <div className="card-tip" style={{ left: tip.x, top: tip.y }}>{info}</div>,
          document.body
        )
      : null;

  // Modo fluido: la carta ocupa el 100% de su hueco y escala con unidades de contenedor
  // (cqw). Se usa en la mesa para que hasta 6 héroes quepan en una sola fila.
  if (fluid) {
    const isBlocked = state === 'bloqueado';
    const isShielded = state === 'blindado';
    const isSoft = card.type === 'power' || card.type === 'action';
    const SHIELD_BG = '#5a3296'; // fondo blindado (morado, algo más oscuro)
    const factionColor = STRONG[card.color] || '#888';
    const col = isSoft && !isBlocked ? pal.ink : '#fff'; // iconos en blanco
    const letter = card.type === 'hero' ? 'H' : card.type === 'villain' ? 'V' : null;
    const badgeF = TYPE_BADGE[card.type] || { label: card.type, bg: '#555' };
    // Borde grueso: protegido = morado oscuro; bloqueado/blindado = color de facción;
    // libre = blanco fino.
    const isProtected = state === 'protegido';
    const framed = isShielded || isBlocked || isProtected;
    const borderColor = isProtected ? '#3b2566' : framed ? factionColor : '#ffffff';
    const borderWidth = framed ? 4 : 2.5;
    const border = `${borderWidth}px solid ${borderColor}`;
    const boxShadow = selected
      ? '0 0 0 3px #185FA5'
      : selectable
        ? '0 0 0 2px rgba(24,95,165,0.55)'
        : '0 1px 3px rgba(0,0,0,0.3)';
    return (
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        style={{
          width: '100%', containerType: 'inline-size', position: 'relative',
          aspectRatio: '1 / 0.98', // proporción fija → altura siempre igual
          borderRadius: 9, overflow: 'hidden', border, background: '#fff',
          boxShadow,
          cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
        }}
      >
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <>
            {/* Fondo: morado si blindado; gris si bloqueado; si no, su color de facción */}
            {isShielded ? (
              <div style={{ position: 'absolute', inset: 0, background: SHIELD_BG }} />
            ) : isBlocked ? (
              <div style={{ position: 'absolute', inset: 0, background: '#6b7280' }} />
            ) : isMulti ? (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
                {QUAD_STRONG.map((c, i) => <div key={i} style={{ background: c }} />)}
              </div>
            ) : isAlly ? (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ background: STRONG[card.colors[0]] ?? '#888' }} />
                <div style={{ background: STRONG[card.colors[1]] ?? '#888' }} />
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: isSoft ? pal.tint : STRONG[card.color] || '#6b7280' }} />
            )}

            {/* Icono y letra de tipo, siempre visibles (también en gris) */}
            {letter && (
              <span style={{ position: 'absolute', right: '6%', top: '8%', lineHeight: 1, fontSize: '70cqw', fontWeight: 900, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }}>{letter}</span>
            )}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: '30%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '44cqw', height: '44cqw', display: 'flex' }}>
                <Icon size="100%" color={col} strokeWidth={2.2} />
              </span>
            </div>
          </>
        )}

        {/* Etiqueta de tipo (en acciones, muestra ayuda al pasar el cursor) */}
        <span
          onMouseEnter={info ? showTip : undefined}
          onMouseLeave={info ? hideTip : undefined}
          style={{ position: 'absolute', top: 3, left: 3, background: badgeF.bg, color: '#fff', fontSize: 'clamp(7px,12cqw,9px)', fontWeight: 700, padding: '1px 5px', borderRadius: 999, zIndex: 2, cursor: info ? 'help' : 'default' }}
        >
          {badgeF.label}
        </span>
        {tipPortal}

        {/* Nombre directamente sobre el color (1 o 2 líneas). Blanco en cartas fuertes,
            en color (oscuro) en poderes/acciones. Sin fondo: altura fija por aspect-ratio. */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 4px 4px',
          }}
        >
          <span
            style={{
              fontWeight: 800, fontSize: 'clamp(8px,13cqw,11px)',
              color: isSoft && !isBlocked ? pal.deep : '#fff',
              textShadow: isSoft && !isBlocked ? 'none' : '0 1px 2px rgba(0,0,0,0.55)',
              lineHeight: 1.05, textAlign: 'center',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {card.name}
          </span>
        </div>
      </div>
    );
  }

  const renderArt = () => {
    if (card.imageUrl) {
      return <img src={card.imageUrl} alt={card.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    const n = cos.iconCount && cos.iconCount > 1 ? cos.iconCount : 1;
    // Poderes y acciones: fondo suave + icono oscuro. Héroes/villanos/aliados: fondo fuerte + icono blanco.
    const isSoft = card.type === 'power' || card.type === 'action';
    const col = isSoft ? pal.ink : '#fff';
    const letter = card.type === 'hero' ? 'H' : card.type === 'villain' ? 'V' : null;
    return (
      <>
        {isMulti && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
            {QUAD_STRONG.map((c, i) => <div key={i} style={{ background: c }} />)}
          </div>
        )}
        {isAlly && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ background: STRONG[card.colors[0]] ?? '#888' }} />
            <div style={{ background: STRONG[card.colors[1]] ?? '#888' }} />
          </div>
        )}
        {!isMulti && !isAlly && (
          <div style={{ position: 'absolute', inset: 0, background: isSoft ? pal.tint : STRONG[card.color] || '#6b7280' }} />
        )}

        {/* Letra de tipo en el fondo (héroe = H, villano = V) */}
        {letter && (
          <span style={{
            position: 'absolute', right: '6%', bottom: '-14%', lineHeight: 1,
            fontSize: art * 0.92, fontWeight: 900, color: 'rgba(255,255,255,0.30)',
            pointerEvents: 'none', userSelect: 'none',
          }}>{letter}</span>
        )}

        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {n === 1 ? (
            <Icon size={Math.round(art * (compact ? 0.52 : 0.46))} color={col} strokeWidth={2.2} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: art * 0.82, justifyContent: 'center' }}>
              {Array.from({ length: n }).map((_, i) => (
                <Icon key={i} size={Math.round(art * 0.24)} color={cos.iconColors ? cos.iconColors[i % cos.iconColors.length] : col} strokeWidth={2} />
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  const badge = TYPE_BADGE[card.type] || { label: card.type, bg: '#555' };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        width: w, background: '#fff', borderRadius: compact ? 10 : 14, overflow: 'hidden',
        border: ring,
        boxShadow: selected ? '0 0 0 3px rgba(24,95,165,0.25)' : '0 1px 3px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      <div style={{ position: 'relative', margin: compact ? '5px 5px 0' : '9px 9px 0', height: art, borderRadius: 8, overflow: 'hidden' }}>
        {renderArt()}
        {/* Etiqueta de tipo (en acciones, muestra ayuda al pasar el cursor) */}
        <span
          onMouseEnter={info ? showTip : undefined}
          onMouseLeave={info ? hideTip : undefined}
          style={{
            position: 'absolute', top: 4, left: 4, zIndex: 2,
            background: badge.bg, color: '#fff',
            fontSize: compact ? 8 : 10, fontWeight: 700, letterSpacing: 0.2,
            padding: compact ? '1px 5px' : '2px 7px', borderRadius: 999,
            boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
            cursor: info ? 'help' : 'default',
          }}
        >
          {badge.label}
        </span>
      </div>
      {tipPortal}

      {/* Nombre justo bajo el arte (sin hueco encima). La 2ª línea crece hacia arriba
          porque las cartas se alinean por abajo en la fila (CSS). */}
      <div
        style={{
          padding: compact ? '3px 4px 4px' : '4px 9px 8px',
          fontWeight: 700,
          fontSize: compact ? 10 : 14,
          color: pal.deep,
          lineHeight: 1.12,
          textAlign: compact ? 'center' : 'left',
        }}
      >
        {card.name}
      </div>
    </div>
  );
}
