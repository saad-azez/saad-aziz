import './Rails.css';

/**
 * The drafting margins.
 *
 * Two fixed rails that mark where the content is allowed to live — the hairline
 * on each inner edge is the boundary, and nothing crosses it. They are ruled
 * like the margin of an engineering drawing, which is the same world the
 * cyanotype palette comes from.
 *
 * Deliberately empty. A margin is structure, not a shelf: the moment you park
 * text in it you are filling space rather than measuring it, and the words that
 * end up there are always the ones nobody would have written on purpose.
 * Everything worth reading sits inside the frame.
 */
export default function Rails({ visible }) {
  const state = visible ? ' rail--visible' : '';

  return (
    <>
      <div className={`rail rail--left${state}`} aria-hidden="true">
        <span className="rail__scale" />
      </div>
      <div className={`rail rail--right${state}`} aria-hidden="true">
        <span className="rail__scale" />
      </div>
    </>
  );
}
