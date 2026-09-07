import type { Subject } from './api.ts';

/** Original, local line drawings. The adjacent subject label provides the name. */
export function SubjectMark({ subject, className = '' }: { subject: Subject; className?: string }) {
  return <svg className={`dm-subject-mark ${className}`} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {subject === 'math' ? <>
      <rect x="7" y="8" width="25" height="30" rx="5" fill="#f4dfba" />
      <path d="M15 18h9m-4.5-4.5v9M15 29h9" />
      <rect x="28" y="24" width="13" height="16" rx="3" fill="#fffaf0" transform="rotate(8 34 32)" />
      <path d="m32 30 5 1m-5 4 5 1" />
    </> : subject === 'korean' ? <>
      <path d="M24 13C18 8 10 9 5 12v25c6-3 13-3 19 1 6-4 13-4 19-1V12c-5-3-13-4-19 1Z" fill="#e6eedb" />
      <path d="M24 13v25M11 18l7 1m-7 6 7 1m12-7 7-1m-7 8 7-1" />
      <path d="M32 7v8l3-2 3 2V7" fill="#e3ad73" />
    </> : <>
      <path d="M8 8h26a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H23l-9 7v-7H8a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5Z" fill="#deedf0" />
      <path d="m12 27 6-13 6 13m-9-5h6m9-8v13m0-17v.5" />
    </>}
  </svg>;
}
