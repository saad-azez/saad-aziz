/**
 * A line set word by word, each word its own span with its place in the line
 * (--i, counted on from `from`), so the stylesheet can bring the words in one
 * after another with whatever reveal the line is under (--reveal).
 */
export default function Words({ text, from = 0 }) {
  const words = text.split(' ');
  return words.map((word, i) => (
    <span className="w" style={{ '--i': from + i }} key={i}>{word}{i < words.length - 1 ? ' ' : ''}</span>
  ));
}
