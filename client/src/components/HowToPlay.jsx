// Modal de reglas. Contenido fiel al motor (deck.js / gameEngine.js).
export default function HowToPlay({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal howto" onClick={(e) => e.stopPropagation()}>
        <h2>¿Cómo se juega?</h2>

        <p className="howto-goal">
          🎯 Sé el primero en tener <strong>4 héroes preparados</strong> en tu equipo.
        </p>

        <h3>En tu turno</h3>
        <p>
          Juega <strong>una carta</strong> (sobre un héroe tuyo o de un rival) o{' '}
          <strong>descarta</strong> las que quieras. Después robas hasta tener{' '}
          <strong>3 cartas</strong>. Las cartas <strong>multicolor</strong> te dan{' '}
          <strong>turno extra</strong>.
        </p>

        <h3>Las cartas</h3>
        <ul className="howto-list">
          <li>
            <strong>🦸 Héroes</strong> — forman tu equipo, uno de cada color (Iron Man rojo,
            Thor amarillo, Hulk verde, Cap. América azul). Capitana Marvel es multicolor;
            Visión es intangible: nadie puede atacarla y siempre cuenta.
          </li>
          <li>
            <strong>🛡️ Poderes</strong> — refuerzan un héroe de su color: 1 poder lo deja{' '}
            <em>protegido</em>; 2 poderes, <em>blindado</em> (inmune).
          </li>
          <li>
            <strong>👿 Villanos</strong> — bloquean un héroe rival de su color (deja de contar).
            Sobre uno protegido destruyen el poder; no afectan al blindado. Thanos ataca a
            cualquier color.
          </li>
          <li>
            <strong>🤝 Aliados</strong> — blindan a un héroe al instante (inmune).
          </li>
          <li>
            <strong>🟣 Acciones</strong>:
            <ul>
              <li>
                <strong>Doctor Strange</strong>: anula la carta que un rival juega contra ti.
              </li>
              <li>
                <strong>Nick Furia</strong>: roba a un rival un héroe que no esté blindado.
              </li>
              <li>
                <strong>Viuda Negra</strong>: mira la mano de un rival y juega una de sus cartas.
              </li>
              <li>
                <strong>Wanda</strong>: intercambia tu equipo entero con el de otro jugador.
              </li>
              <li>
                <strong>Guantelete de Thanos</strong>: cada jugador elimina la mitad de sus héroes.
              </li>
            </ul>
          </li>
        </ul>

        <h3>Estados del héroe</h3>
        <p className="muted">
          Libre · Protegido (1 poder) · Blindado (2 poderes o aliado; inmune) · Bloqueado
          (villano; no cuenta). Ganas con <strong>4 preparados</strong>: cualquier estado
          menos bloqueado.
        </p>

        <div className="modal-btns">
          <button className="btn btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
