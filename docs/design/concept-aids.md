# Concrete concept aids

## Purpose and ownership

Both clients can illustrate a delivered public mathematics expression inside optional
learning help. This is a counting model, not a new generated question, answer key,
client-side grader, curriculum approval, or claim of mastery. Server guidance remains
repository-authored candidate material. The diagram illustrates only the expression;
it does not imply external review of that material.

The integration seam is `LearningHelp({ support, item? })`, where `item` needs only
`Pick<WorksheetItem, 'subject' | 'stem'>`. Missing support renders nothing. Missing or
unsupported expressions retain all supplied objectives, materials, and two hint steps.
Neither component reads answers, solutions, parameters, scoring, or teacher endpoints.

## Deliberately narrow grammar

Accept only mathematics stems containing two canonical whole-number operands and one
`+`, `-`, `−`, `×`, or `*` operator. Whitespace and an optional trailing `= □` or `= ?`
are allowed. Each operand is 0 through 10. Addition is capped at 20 dots; subtraction
requires the first operand to be at least the second. Multiplication has at most 10
groups of at most 10 dots. Interpret `a × b` as **a dots per group, b groups**.

Reject signed numbers, decimals, fractions, leading zeroes, division, chains,
parentheses, equations with a supplied result, missing operands, word problems, and
non-mathematics subjects. Parse the entire expression explicitly; never evaluate code
or infer operations from prose. Bounds constrain the physical model, not grading.

## Child-facing representation

- Addition: two separately labelled quantities, a plus sign, and one enclosing bracket
  invite the child to count both sets together.
- Subtraction: show the original quantity in a ten-frame; cross out the given number
  of dots. Crosses, not color alone, distinguish taking away. Count uncrossed dots.
- Multiplication: show the second operand's number of brackets, each containing the
  first operand's quantity in a ten-frame. Count equal groups without printing a total.
- Zero remains an explicit given quantity. Empty frames represent an empty set;
  zero groups show no invented group.

Only given operand numerals appear: no computed result numeral, result field, correctness
feedback, or answer announcement. Accessible image descriptions state given quantities
and the operation/counting action, not the computed answer. Decorative dots are hidden
from assistive technology to avoid reading a long list of meaningless shapes.

## Disclosure and layout

The existing outer help starts closed. A second native disclosure offers the concrete
picture independently of the two sequential server hints. No autoplay, timer, reward,
participation callback, or forced reveal is attached. State remains item-local; the
existing worksheet fingerprint/item keys reset it for new sheets.

Use restrained mathematics green and ink, labelled quantities, round versus outlined
markers for addition, crossed-out subtraction markers, and spatial grouping/brackets.
Short counting instructions and a simple legend accompany the picture rather than a
new wall of explanatory text. Keep server-authored guidance intact.

Disclosure and hint controls retain 48px minimum touch targets and visible focus.
Ten-frames use five flexible columns with bounded width; quantity groups wrap rather
than making the worksheet wider. At 320px and 375px the content must remain readable
without horizontal scrolling. No animation is needed. Hide all help, including the
picture, in print using the existing help boundary. Do not alter the 30/50 presets,
item volume, worksheet grouping, answers, or print writing space.

Multiplication groups use an adaptive grid with a 100px minimum group width and a
140px maximum ten-frame width. This shows two groups per row where space permits
instead of leaving half a narrow help card empty, while stacking on tighter screens.

## Verification and integration

Component tests first exercise grammar bounds, actual group/dot counts, subtraction
marks, zero, unsupported fallbacks, public-field-only access, accessible given-number
descriptions, independent disclosures, and the unchanged two hints. Test machine state
and quantities rather than pinning instructional prose.

Both callers should pass the public item alongside support:

```tsx
<LearningHelp support={item.learningSupport} item={item} />
```

The caller-owning lead integrates this seam and checks the real worksheet surface at
320px/375px, keyboard disclosure, print hiding, and 30/50-item sheets. This component
work does not modify worksheet callers or the garden's rewards/3D systems.
