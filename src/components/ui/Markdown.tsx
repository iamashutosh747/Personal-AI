import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders AI or user Markdown safely: raw HTML is never interpreted. */
export function Markdown({ children, preserveBreaks }: { children: string; preserveBreaks?: boolean }) {
  return (
    <div className={preserveBreaks ? "prose-inner preserve" : "prose-inner"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
