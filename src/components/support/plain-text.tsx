/** Plain-text bodies: blank lines separate paragraphs; consecutive "1." lines form a list. */
export function PlainText({ body }: { body: string }) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="space-y-4 leading-relaxed text-text-soft">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l) => (
                <li key={l}>{l.replace(/^\d+\.\s/, "")}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}
