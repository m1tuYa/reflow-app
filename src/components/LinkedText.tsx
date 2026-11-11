import { Fragment } from "react";

const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
const URL_ONE = /^https?:\/\//;

// 本文中のURLをクリックできるリンクにして表示する(#9)
export function LinkedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_SPLIT);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        URL_ONE.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 dark:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </p>
  );
}
