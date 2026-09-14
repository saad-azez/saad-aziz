import Sheet from '../sheet/Sheet.jsx';
import { WORK, SHEETS } from '../../content/site.js';
import { isPlaceholder } from '../../lib/reveal.js';
import './Work.css';

/**
 * Sheet 01 — selected work.
 *
 * Each project is a plate: a ruled frame with a number tab, and the record
 * beneath it. A plate without an image is hatched and stamped "not yet
 * issued", the way an unfinished drawing is — so a placeholder looks like
 * one, instead of like a broken image.
 */
const sheet = SHEETS.find(s => s.id === 'work');

function Plate({ project }) {
  const pending = !project.plate;
  const cls = value => `plate__value${isPlaceholder(value) ? ' ph' : ''}`;
  return (
    <a className="plate" href={project.href} data-rise>
      <span className="plate__frame">
        <span className="plate__no">{project.n}</span>
        {pending
          ? <>
              <span className="plate__hatch" aria-hidden="true" />
              <span className="plate__stamp">Plate not yet issued</span>
            </>
          : <img className="plate__img" src={project.plate} alt="" loading="lazy" />}
      </span>
      <span className="plate__row">
        <span className={`plate__title ${cls(project.title)}`}>{project.title}</span>
        <span className="plate__meta">
          <span className={cls(project.client)}>{project.client}</span>
          <span className="plate__dot" aria-hidden="true">·</span>
          <span className={cls(project.year)}>{project.year}</span>
        </span>
      </span>
      <span className={`plate__summary ${cls(project.summary)}`}>{project.summary}</span>
      <span className="plate__tags">
        {project.tags.map((tag, i) => (
          <span className="plate__tag" key={tag}>
            {i > 0 && <span className="plate__dot" aria-hidden="true">·</span>}
            {tag}
          </span>
        ))}
        <svg className="plate__arrow" viewBox="0 0 18 9" aria-hidden="true" focusable="false">
          <path d="M0 4.5 H16 M12.5 1 L16 4.5 L12.5 8" />
        </svg>
      </span>
    </a>
  );
}

export default function Work() {
  return (
    <Sheet id={sheet.id} index={sheet.index} eyebrow={WORK.eyebrow} title={WORK.title} intro={WORK.intro} night>
      <div className="work__grid">
        {WORK.projects.map(project => <Plate project={project} key={project.n} />)}
      </div>
    </Sheet>
  );
}
