// ↗ to the page a list item came from (items pasted in as links remember it)
export default function LinkOut({ url }) {
  if (!url) return null;
  return (
    <a className="link-out" href={url} target="_blank" rel="noopener noreferrer" title={url} aria-label="Open link">
      ↗
    </a>
  );
}
