"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none text-sm">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-3 mb-1.5 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-2 mb-1 text-foreground">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 text-muted-foreground leading-relaxed">{children}</p>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs mb-3">{children}</pre>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-2 text-muted-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-2 text-muted-foreground">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary pl-3 italic text-muted-foreground mb-2">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
