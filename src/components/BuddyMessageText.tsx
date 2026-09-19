import { useMemo } from 'react';

/**
 * Lightweight markdown renderer for Campus Buddy chat messages.
 * Supports: bold **text**, headings ### / ##, bullet lists -, line breaks,
 * and inline links [text](url). Deliberately minimal — no raw HTML.
 *
 * Verification status lines (🟢/🟡/🔴) are rendered as colored badges.
 */

type StatusLevel = 'green' | 'yellow' | 'red' | null;

function detectStatus(text: string): StatusLevel {
  const head = text.slice(0, 300);
  if (head.includes('🔴') || head.toLowerCase().includes('warning')) return 'red';
  if (head.includes('🟢') || head.toLowerCase().includes('confirmed on campussync')) return 'green';
  if (head.includes('🟡') || head.toLowerCase().includes('not verified on campussync')) return 'yellow';
  return null;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    if (m[2]) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-slate-900 dark:text-slate-100">{m[2]}</strong>);
    } else if (m[3] && m[4]) {
      nodes.push(
        <a
          key={`${keyPrefix}-a-${i}`}
          href={m[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-600 dark:text-teal-400 font-medium hover:underline"
        >
          {m[3]}
        </a>
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const STATUS_BADGE_CLASSES: Record<NonNullable<StatusLevel>, string> = {
  green: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  yellow: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  red: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

function isStatusLine(line: string): StatusLevel {
  if (line.includes('🔴')) return 'red';
  if (line.includes('🟢')) return 'green';
  if (line.includes('🟡')) return 'yellow';
  return null;
}

export function getVerificationStatus(text: string): StatusLevel {
  return detectStatus(text);
}

export default function BuddyMessageText({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const lines = text.split('\n');
    const result: { type: 'h3' | 'h2' | 'bullet' | 'paragraph' | 'status'; status: StatusLevel; lines: string[] }[] = [];
    let current: { type: 'h3' | 'h2' | 'bullet' | 'paragraph'; lines: string[] } | null = null;

    const flush = () => {
      if (current) {
        result.push({ ...current, status: null });
        current = null;
      }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();

      const statusLevel = isStatusLine(line);
      if (statusLevel) {
        flush();
        result.push({ type: 'status', status: statusLevel, lines: [line] });
        continue;
      }

      if (line.startsWith('### ')) {
        flush();
        result.push({ type: 'h3', status: null, lines: [line.slice(4)] });
      } else if (line.startsWith('## ')) {
        flush();
        result.push({ type: 'h2', status: null, lines: [line.slice(3)] });
      } else if (/^[-•]\s+/.test(line)) {
        if (!current || current.type !== 'bullet') {
          flush();
          current = { type: 'bullet', lines: [] };
        }
        current.lines.push(line.replace(/^[-•]\s+/, ''));
      } else if (line === '') {
        flush();
      } else {
        if (!current || current.type !== 'paragraph') {
          flush();
          current = { type: 'paragraph', lines: [] };
        }
        current.lines.push(line);
      }
    }
    flush();
    return result;
  }, [text]);

  return (
    <div className="space-y-1.5">
      {blocks.map((block, bi) => {
        const key = `block-${bi}`;
        if (block.type === 'status' && block.status) {
          return (
            <div
              key={key}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${STATUS_BADGE_CLASSES[block.status]}`}
            >
              {renderInline(block.lines[0], key)}
            </div>
          );
        }
        if (block.type === 'h3') {
          return (
            <p key={key} className="font-semibold text-slate-900 dark:text-slate-100 text-sm pt-1">
              {renderInline(block.lines[0], key)}
            </p>
          );
        }
        if (block.type === 'h2') {
          return (
            <p key={key} className="font-bold text-slate-900 dark:text-slate-100 text-sm pt-1">
              {renderInline(block.lines[0], key)}
            </p>
          );
        }
        if (block.type === 'bullet') {
          return (
            <ul key={key} className="space-y-0.5 pl-1">
              {block.lines.map((line, li) => (
                <li key={`${key}-${li}`} className="flex gap-1.5 text-sm">
                  <span className="text-teal-500 flex-shrink-0">•</span>
                  <span className="flex-1">{renderInline(line, `${key}-${li}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className="text-sm leading-relaxed">
            {block.lines.map((line, li) => (
              <span key={`${key}-${li}`}>
                {li > 0 && <br />}
                {renderInline(line, `${key}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
